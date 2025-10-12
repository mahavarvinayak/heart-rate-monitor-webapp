# Component Design

## Table of Contents
1. [Overview](#overview)
2. [Main Process Components](#main-process-components)
3. [Renderer Process Components](#renderer-process-components)
4. [AI Process Components](#ai-process-components)
5. [Shared Components](#shared-components)
6. [Component Interactions](#component-interactions)

## Overview

Project Nexus follows a modular component architecture with clear separation of concerns. Each component has a well-defined responsibility and interacts with other components through established interfaces.

### Design Principles
- **Single Responsibility**: Each component has one primary purpose
- **Dependency Injection**: Components receive dependencies rather than creating them
- **Interface-Based**: Components interact through abstract interfaces
- **Testability**: Components can be unit tested in isolation
- **Loose Coupling**: Minimal dependencies between components

## Main Process Components

### 1. Browser Manager

**Responsibility**: Manages browser instances, windows, and tabs

```cpp
// browser_manager.h
class IBrowserManager {
public:
    virtual ~IBrowserManager() = default;
    
    virtual int CreateBrowser(const BrowserConfig& config) = 0;
    virtual bool CloseBrowser(int browser_id) = 0;
    virtual CefRefPtr<CefBrowser> GetBrowser(int browser_id) = 0;
    
    virtual int CreateTab(int browser_id, const std::string& url) = 0;
    virtual bool CloseTab(int tab_id) = 0;
    virtual bool SwitchTab(int browser_id, int tab_id) = 0;
    
    virtual std::vector<TabInfo> GetAllTabs(int browser_id) = 0;
};

class BrowserManager : public IBrowserManager {
public:
    BrowserManager(std::shared_ptr<IProcessManager> process_manager,
                   std::shared_ptr<IExtensionManager> extension_manager)
        : process_manager_(process_manager),
          extension_manager_(extension_manager) {}
    
    int CreateBrowser(const BrowserConfig& config) override {
        int browser_id = AllocateBrowserID();
        
        // Create CEF browser
        CefWindowInfo window_info;
        ConfigureWindowInfo(window_info, config);
        
        CefBrowserSettings settings;
        ConfigureBrowserSettings(settings, config);
        
        CefRefPtr<NexusClient> client = new NexusClient(browser_id);
        
        CefRefPtr<CefBrowser> browser = CefBrowserHost::CreateBrowserSync(
            window_info,
            client,
            config.initial_url,
            settings,
            nullptr,
            nullptr
        );
        
        browsers_[browser_id] = {
            .browser = browser,
            .config = config,
            .tabs = {},
            .active_tab = -1
        };
        
        return browser_id;
    }
    
    int CreateTab(int browser_id, const std::string& url) override {
        auto it = browsers_.find(browser_id);
        if (it == browsers_.end()) return -1;
        
        int tab_id = AllocateTabID();
        
        // Create renderer process for tab
        int renderer_pid = process_manager_->CreateRendererProcess();
        
        TabInfo tab{
            .id = tab_id,
            .url = url,
            .title = "",
            .renderer_pid = renderer_pid,
            .loading = true
        };
        
        it->second.tabs[tab_id] = tab;
        
        // Load URL in renderer
        LoadURLInTab(tab_id, url);
        
        // Notify observers
        NotifyTabCreated(browser_id, tab_id);
        
        return tab_id;
    }
    
    bool CloseTab(int tab_id) override {
        auto [browser_id, tab] = FindTab(tab_id);
        if (!tab) return false;
        
        // Terminate renderer process
        process_manager_->TerminateProcess(tab->renderer_pid);
        
        // Remove from browser
        auto& browser = browsers_[browser_id];
        browser.tabs.erase(tab_id);
        
        // Switch to another tab if this was active
        if (browser.active_tab == tab_id) {
            if (!browser.tabs.empty()) {
                SwitchTab(browser_id, browser.tabs.begin()->first);
            }
        }
        
        NotifyTabClosed(browser_id, tab_id);
        return true;
    }
    
private:
    struct BrowserState {
        CefRefPtr<CefBrowser> browser;
        BrowserConfig config;
        std::map<int, TabInfo> tabs;
        int active_tab;
    };
    
    std::shared_ptr<IProcessManager> process_manager_;
    std::shared_ptr<IExtensionManager> extension_manager_;
    std::map<int, BrowserState> browsers_;
    
    int next_browser_id_ = 1;
    int next_tab_id_ = 1;
};
```

### 2. AI Orchestrator

**Responsibility**: Coordinates AI operations across processes

```cpp
// ai_orchestrator.h
class IAIOrchestrator {
public:
    virtual ~IAIOrchestrator() = default;
    
    virtual void AnalyzeContent(const std::string& url,
                               const std::string& content,
                               AICallback callback) = 0;
    
    virtual void GetRecommendations(int user_id,
                                   const UserContext& context,
                                   AICallback callback) = 0;
    
    virtual void ClassifyContent(const std::string& content,
                                AICallback callback) = 0;
};

class AIOrchestrator : public IAIOrchestrator {
public:
    AIOrchestrator(std::shared_ptr<IAIProcessManager> ai_manager,
                   std::shared_ptr<IModelCache> model_cache)
        : ai_manager_(ai_manager),
          model_cache_(model_cache) {}
    
    void AnalyzeContent(const std::string& url,
                       const std::string& content,
                       AICallback callback) override {
        
        // Check cache first
        if (auto cached = GetCachedResult(url)) {
            callback(*cached);
            return;
        }
        
        // Prepare AI request
        AIRequest request{
            .type = AIRequestType::CONTENT_ANALYSIS,
            .url = url,
            .content = content,
            .features = {"category", "entities", "sentiment"}
        };
        
        // Send to AI process
        ai_manager_->ProcessRequest(request,
            [this, url, callback](const AIResponse& response) {
                // Cache result
                CacheResult(url, response);
                
                // Return to caller
                callback(response);
            });
    }
    
    void GetRecommendations(int user_id,
                           const UserContext& context,
                           AICallback callback) override {
        
        // Load user profile
        UserProfile profile = LoadUserProfile(user_id);
        
        // Prepare recommendation request
        AIRequest request{
            .type = AIRequestType::RECOMMENDATION,
            .user_id = user_id,
            .context = SerializeContext(context),
            .user_profile = SerializeProfile(profile)
        };
        
        // Ensure recommendation model is loaded
        model_cache_->EnsureModelLoaded("recommendation_v1",
            [this, request, callback]() {
                ai_manager_->ProcessRequest(request, callback);
            });
    }
    
private:
    std::shared_ptr<IAIProcessManager> ai_manager_;
    std::shared_ptr<IModelCache> model_cache_;
    
    std::map<std::string, AIResponse> result_cache_;
    
    std::optional<AIResponse> GetCachedResult(const std::string& url) {
        auto it = result_cache_.find(url);
        if (it != result_cache_.end()) {
            // Check if cache is still valid (e.g., < 1 hour old)
            if (IsCacheValid(it->second)) {
                return it->second;
            }
        }
        return std::nullopt;
    }
    
    void CacheResult(const std::string& url, const AIResponse& response) {
        result_cache_[url] = response;
        
        // Limit cache size
        if (result_cache_.size() > MAX_CACHE_SIZE) {
            EvictOldestEntry();
        }
    }
    
    static constexpr size_t MAX_CACHE_SIZE = 1000;
};
```

### 3. Extension Manager

**Responsibility**: Manages browser extensions and their lifecycle

```cpp
// extension_manager.h
class IExtensionManager {
public:
    virtual ~IExtensionManager() = default;
    
    virtual bool LoadExtension(const std::string& path) = 0;
    virtual bool UnloadExtension(const std::string& extension_id) = 0;
    virtual std::vector<ExtensionInfo> GetInstalledExtensions() = 0;
    
    virtual bool ExecuteExtensionScript(const std::string& extension_id,
                                       const std::string& script) = 0;
};

class ExtensionManager : public IExtensionManager {
public:
    ExtensionManager(std::shared_ptr<IEventBus> event_bus)
        : event_bus_(event_bus) {}
    
    bool LoadExtension(const std::string& path) override {
        // Load manifest
        auto manifest = LoadManifest(path);
        if (!manifest) {
            LOG(ERROR) << "Failed to load extension manifest: " << path;
            return false;
        }
        
        // Validate extension
        if (!ValidateExtension(*manifest)) {
            LOG(ERROR) << "Extension validation failed: " << path;
            return false;
        }
        
        // Create extension instance
        Extension extension{
            .id = manifest->id,
            .name = manifest->name,
            .version = manifest->version,
            .path = path,
            .manifest = *manifest,
            .enabled = true
        };
        
        // Load background scripts
        for (const auto& script : manifest->background_scripts) {
            LoadBackgroundScript(extension.id, path + "/" + script);
        }
        
        // Register content scripts
        for (const auto& content_script : manifest->content_scripts) {
            RegisterContentScript(extension.id, content_script);
        }
        
        extensions_[extension.id] = extension;
        
        // Notify extension loaded
        event_bus_->Publish("extension_loaded", {
            {"id", extension.id},
            {"name", extension.name}
        });
        
        return true;
    }
    
    bool UnloadExtension(const std::string& extension_id) override {
        auto it = extensions_.find(extension_id);
        if (it == extensions_.end()) return false;
        
        // Remove content scripts
        UnregisterContentScripts(extension_id);
        
        // Unload background scripts
        UnloadBackgroundScripts(extension_id);
        
        extensions_.erase(it);
        
        event_bus_->Publish("extension_unloaded", {
            {"id", extension_id}
        });
        
        return true;
    }
    
private:
    struct Extension {
        std::string id;
        std::string name;
        std::string version;
        std::string path;
        ExtensionManifest manifest;
        bool enabled;
    };
    
    std::shared_ptr<IEventBus> event_bus_;
    std::map<std::string, Extension> extensions_;
};
```

### 4. Database Manager

**Responsibility**: Manages SQLite database operations

```cpp
// database_manager.h
class IDatabaseManager {
public:
    virtual ~IDatabaseManager() = default;
    
    virtual bool Initialize(const std::string& db_path) = 0;
    virtual void Shutdown() = 0;
    
    // History
    virtual bool AddHistoryEntry(const HistoryEntry& entry) = 0;
    virtual std::vector<HistoryEntry> GetHistory(const HistoryQuery& query) = 0;
    virtual bool DeleteHistoryEntry(int64_t id) = 0;
    
    // Bookmarks
    virtual bool AddBookmark(const Bookmark& bookmark) = 0;
    virtual std::vector<Bookmark> GetBookmarks(const std::string& folder) = 0;
    virtual bool UpdateBookmark(const Bookmark& bookmark) = 0;
    virtual bool DeleteBookmark(int64_t id) = 0;
    
    // Settings
    virtual bool SetSetting(const std::string& key, const std::string& value) = 0;
    virtual std::optional<std::string> GetSetting(const std::string& key) = 0;
};

class DatabaseManager : public IDatabaseManager {
public:
    bool Initialize(const std::string& db_path) override {
        int rc = sqlite3_open(db_path.c_str(), &db_);
        if (rc != SQLITE_OK) {
            LOG(ERROR) << "Failed to open database: " << sqlite3_errmsg(db_);
            return false;
        }
        
        // Enable WAL mode for better concurrency
        sqlite3_exec(db_, "PRAGMA journal_mode=WAL", nullptr, nullptr, nullptr);
        
        // Create tables
        if (!CreateTables()) {
            return false;
        }
        
        // Prepare statements
        if (!PrepareStatements()) {
            return false;
        }
        
        return true;
    }
    
    bool AddHistoryEntry(const HistoryEntry& entry) override {
        sqlite3_stmt* stmt = prepared_statements_["insert_history"];
        
        sqlite3_reset(stmt);
        sqlite3_bind_text(stmt, 1, entry.url.c_str(), -1, SQLITE_TRANSIENT);
        sqlite3_bind_text(stmt, 2, entry.title.c_str(), -1, SQLITE_TRANSIENT);
        sqlite3_bind_int64(stmt, 3, entry.visit_time);
        
        int rc = sqlite3_step(stmt);
        return rc == SQLITE_DONE;
    }
    
    std::vector<HistoryEntry> GetHistory(const HistoryQuery& query) override {
        std::vector<HistoryEntry> results;
        
        std::string sql = BuildHistoryQuery(query);
        sqlite3_stmt* stmt;
        
        int rc = sqlite3_prepare_v2(db_, sql.c_str(), -1, &stmt, nullptr);
        if (rc != SQLITE_OK) {
            LOG(ERROR) << "Failed to prepare query: " << sqlite3_errmsg(db_);
            return results;
        }
        
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            HistoryEntry entry;
            entry.id = sqlite3_column_int64(stmt, 0);
            entry.url = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
            entry.title = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
            entry.visit_time = sqlite3_column_int64(stmt, 3);
            entry.visit_count = sqlite3_column_int(stmt, 4);
            
            results.push_back(entry);
        }
        
        sqlite3_finalize(stmt);
        return results;
    }
    
private:
    sqlite3* db_ = nullptr;
    std::map<std::string, sqlite3_stmt*> prepared_statements_;
    
    bool CreateTables() {
        const char* schema = R"(
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                title TEXT,
                visit_time INTEGER NOT NULL,
                visit_count INTEGER DEFAULT 1,
                last_visit INTEGER NOT NULL
            );
            
            CREATE INDEX IF NOT EXISTS idx_history_url ON history(url);
            CREATE INDEX IF NOT EXISTS idx_history_visit_time ON history(visit_time);
            
            CREATE TABLE IF NOT EXISTS bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL UNIQUE,
                title TEXT,
                folder TEXT,
                created_at INTEGER NOT NULL,
                modified_at INTEGER
            );
            
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        )";
        
        char* error_msg;
        int rc = sqlite3_exec(db_, schema, nullptr, nullptr, &error_msg);
        
        if (rc != SQLITE_OK) {
            LOG(ERROR) << "Failed to create tables: " << error_msg;
            sqlite3_free(error_msg);
            return false;
        }
        
        return true;
    }
    
    bool PrepareStatements() {
        const std::map<std::string, std::string> statements = {
            {"insert_history", 
             "INSERT INTO history (url, title, visit_time, last_visit) "
             "VALUES (?, ?, ?, ?) "
             "ON CONFLICT(url) DO UPDATE SET "
             "visit_count = visit_count + 1, last_visit = ?"},
            
            {"insert_bookmark",
             "INSERT INTO bookmarks (url, title, folder, created_at) "
             "VALUES (?, ?, ?, ?)"},
            
            {"get_setting",
             "SELECT value FROM settings WHERE key = ?"},
            
            {"set_setting",
             "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"}
        };
        
        for (const auto& [name, sql] : statements) {
            sqlite3_stmt* stmt;
            int rc = sqlite3_prepare_v2(db_, sql.c_str(), -1, &stmt, nullptr);
            
            if (rc != SQLITE_OK) {
                LOG(ERROR) << "Failed to prepare statement: " << name;
                return false;
            }
            
            prepared_statements_[name] = stmt;
        }
        
        return true;
    }
};
```

### 5. Settings Manager

**Responsibility**: Manages user preferences and settings

```cpp
// settings_manager.h
class ISettingsManager {
public:
    virtual ~ISettingsManager() = default;
    
    virtual void LoadSettings() = 0;
    virtual void SaveSettings() = 0;
    
    template<typename T>
    T GetSetting(const std::string& key, const T& default_value = T{});
    
    template<typename T>
    void SetSetting(const std::string& key, const T& value);
    
    virtual void ResetToDefaults() = 0;
};

class SettingsManager : public ISettingsManager {
public:
    SettingsManager(std::shared_ptr<IDatabaseManager> db_manager)
        : db_manager_(db_manager) {
        InitializeDefaults();
    }
    
    void LoadSettings() override {
        // Load from database
        for (const auto& [key, default_value] : default_settings_) {
            if (auto value = db_manager_->GetSetting(key)) {
                settings_[key] = *value;
            } else {
                settings_[key] = default_value;
            }
        }
    }
    
    void SaveSettings() override {
        for (const auto& [key, value] : settings_) {
            db_manager_->SetSetting(key, value);
        }
    }
    
    template<typename T>
    T GetSetting(const std::string& key, const T& default_value) {
        auto it = settings_.find(key);
        if (it != settings_.end()) {
            return DeserializeValue<T>(it->second);
        }
        return default_value;
    }
    
    template<typename T>
    void SetSetting(const std::string& key, const T& value) {
        settings_[key] = SerializeValue(value);
        NotifySettingChanged(key);
    }
    
    void ResetToDefaults() override {
        settings_ = default_settings_;
        SaveSettings();
    }
    
private:
    std::shared_ptr<IDatabaseManager> db_manager_;
    std::map<std::string, std::string> settings_;
    std::map<std::string, std::string> default_settings_;
    
    void InitializeDefaults() {
        default_settings_ = {
            {"window.width", "1920"},
            {"window.height", "1080"},
            {"window.maximized", "false"},
            {"privacy.do_not_track", "true"},
            {"ai.enabled", "true"},
            {"ai.auto_analyze", "true"},
            {"appearance.theme", "light"},
            {"search.default_engine", "google"}
        };
    }
    
    template<typename T>
    T DeserializeValue(const std::string& str);
    
    template<typename T>
    std::string SerializeValue(const T& value);
};
```

## Renderer Process Components

### 1. Content Script Manager

**Responsibility**: Manages content scripts injection and execution

```cpp
// content_script_manager.h
class ContentScriptManager {
public:
    void RegisterContentScript(const std::string& extension_id,
                              const ContentScript& script) {
        content_scripts_.push_back({extension_id, script});
    }
    
    void OnDocumentReady(CefRefPtr<CefFrame> frame) {
        const std::string& url = frame->GetURL();
        
        // Find matching content scripts
        for (const auto& [ext_id, script] : content_scripts_) {
            if (MatchesPattern(url, script.matches)) {
                InjectScript(frame, script);
            }
        }
    }
    
private:
    struct ContentScriptEntry {
        std::string extension_id;
        ContentScript script;
    };
    
    std::vector<ContentScriptEntry> content_scripts_;
    
    void InjectScript(CefRefPtr<CefFrame> frame, const ContentScript& script) {
        for (const auto& js_file : script.js_files) {
            std::string code = ReadFile(js_file);
            frame->ExecuteJavaScript(code, frame->GetURL(), 0);
        }
    }
    
    bool MatchesPattern(const std::string& url, 
                       const std::vector<std::string>& patterns) {
        for (const auto& pattern : patterns) {
            if (std::regex_match(url, std::regex(PatternToRegex(pattern)))) {
                return true;
            }
        }
        return false;
    }
};
```

### 2. DOM Monitor

**Responsibility**: Monitors DOM changes and extracts content

```cpp
// dom_monitor.h
class DOMMonitor {
public:
    void Initialize(CefRefPtr<CefFrame> frame) {
        frame_ = frame;
        SetupMutationObserver();
    }
    
    void ExtractContent(std::function<void(const PageContent&)> callback) {
        const char* script = R"(
            (function() {
                return {
                    title: document.title,
                    text: document.body.innerText,
                    links: Array.from(document.querySelectorAll('a'))
                        .map(a => ({href: a.href, text: a.textContent})),
                    images: Array.from(document.querySelectorAll('img'))
                        .map(img => ({src: img.src, alt: img.alt})),
                    meta: Array.from(document.querySelectorAll('meta'))
                        .map(m => ({name: m.name, content: m.content}))
                };
            })();
        )";
        
        frame_->ExecuteJavaScript(script, frame_->GetURL(), 0);
        // Result handled in V8 context
    }
    
private:
    CefRefPtr<CefFrame> frame_;
    
    void SetupMutationObserver() {
        const char* script = R"(
            (function() {
                const observer = new MutationObserver(mutations => {
                    nexus.internal.onDOMChanged();
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            })();
        )";
        
        frame_->ExecuteJavaScript(script, frame_->GetURL(), 0);
    }
};
```

## AI Process Components

### 1. Model Manager

**Responsibility**: Manages AI model loading and lifecycle

```python
# model_manager.py
class ModelManager:
    def __init__(self, models_dir: str):
        self.models_dir = models_dir
        self.loaded_models: Dict[str, Any] = {}
        self.model_metadata: Dict[str, ModelMetadata] = {}
        
    def load_model(self, model_id: str) -> bool:
        """Load a model into memory"""
        if model_id in self.loaded_models:
            return True
        
        model_path = os.path.join(self.models_dir, model_id)
        
        try:
            # Load based on model type
            metadata = self.get_model_metadata(model_id)
            
            if metadata.framework == 'tensorflow':
                model = tf.keras.models.load_model(model_path)
            elif metadata.framework == 'pytorch':
                model = torch.load(model_path)
            else:
                raise ValueError(f"Unsupported framework: {metadata.framework}")
            
            self.loaded_models[model_id] = model
            return True
            
        except Exception as e:
            logging.error(f"Failed to load model {model_id}: {e}")
            return False
    
    def unload_model(self, model_id: str):
        """Unload a model from memory"""
        if model_id in self.loaded_models:
            del self.loaded_models[model_id]
            
            # Force garbage collection
            import gc
            gc.collect()
    
    def get_model(self, model_id: str) -> Optional[Any]:
        """Get a loaded model"""
        return self.loaded_models.get(model_id)
    
    def list_available_models(self) -> List[str]:
        """List all available models"""
        return [d for d in os.listdir(self.models_dir)
                if os.path.isdir(os.path.join(self.models_dir, d))]
```

### 2. Inference Engine

**Responsibility**: Executes AI model inference

```python
# inference_engine.py
class InferenceEngine:
    def __init__(self, model_manager: ModelManager):
        self.model_manager = model_manager
        self.preprocessors: Dict[str, Callable] = {}
        self.postprocessors: Dict[str, Callable] = {}
        
    def register_preprocessor(self, model_id: str, 
                             preprocessor: Callable):
        """Register preprocessing function for a model"""
        self.preprocessors[model_id] = preprocessor
    
    def register_postprocessor(self, model_id: str,
                              postprocessor: Callable):
        """Register postprocessing function for a model"""
        self.postprocessors[model_id] = postprocessor
    
    async def infer(self, model_id: str, input_data: Any) -> Any:
        """Run inference on input data"""
        # Ensure model is loaded
        if not self.model_manager.get_model(model_id):
            if not self.model_manager.load_model(model_id):
                raise RuntimeError(f"Failed to load model: {model_id}")
        
        model = self.model_manager.get_model(model_id)
        
        # Preprocess
        if model_id in self.preprocessors:
            input_data = self.preprocessors[model_id](input_data)
        
        # Inference
        output = await self._run_inference(model, input_data)
        
        # Postprocess
        if model_id in self.postprocessors:
            output = self.postprocessors[model_id](output)
        
        return output
    
    async def _run_inference(self, model: Any, input_data: Any) -> Any:
        """Run actual inference (framework-specific)"""
        # TensorFlow
        if hasattr(model, 'predict'):
            return model.predict(input_data)
        
        # PyTorch
        elif hasattr(model, 'forward'):
            with torch.no_grad():
                return model(input_data)
        
        else:
            raise ValueError("Unsupported model type")
    
    async def batch_infer(self, model_id: str, 
                         inputs: List[Any]) -> List[Any]:
        """Run batch inference"""
        # Batch preprocessing
        if model_id in self.preprocessors:
            inputs = [self.preprocessors[model_id](x) for x in inputs]
        
        # Batch inference
        model = self.model_manager.get_model(model_id)
        outputs = await self._run_inference(model, np.array(inputs))
        
        # Batch postprocessing
        if model_id in self.postprocessors:
            outputs = [self.postprocessors[model_id](x) for x in outputs]
        
        return outputs
```

## Shared Components

### 1. Event Bus

**Responsibility**: Publishes and subscribes to system events

```cpp
// event_bus.h
class IEventBus {
public:
    virtual ~IEventBus() = default;
    
    using EventHandler = std::function<void(const nlohmann::json&)>;
    
    virtual void Subscribe(const std::string& event_type,
                          EventHandler handler) = 0;
    
    virtual void Unsubscribe(const std::string& event_type,
                            int subscription_id) = 0;
    
    virtual void Publish(const std::string& event_type,
                        const nlohmann::json& data) = 0;
};

class EventBus : public IEventBus {
public:
    void Subscribe(const std::string& event_type,
                  EventHandler handler) override {
        int id = next_subscription_id_++;
        subscriptions_[event_type][id] = handler;
    }
    
    void Unsubscribe(const std::string& event_type,
                    int subscription_id) override {
        auto it = subscriptions_.find(event_type);
        if (it != subscriptions_.end()) {
            it->second.erase(subscription_id);
        }
    }
    
    void Publish(const std::string& event_type,
                const nlohmann::json& data) override {
        auto it = subscriptions_.find(event_type);
        if (it != subscriptions_.end()) {
            for (const auto& [id, handler] : it->second) {
                try {
                    handler(data);
                } catch (const std::exception& e) {
                    LOG(ERROR) << "Event handler error: " << e.what();
                }
            }
        }
    }
    
private:
    std::map<std::string, std::map<int, EventHandler>> subscriptions_;
    int next_subscription_id_ = 1;
};
```

### 2. Logger

**Responsibility**: Centralized logging across all processes

```cpp
// logger.h
class Logger {
public:
    static void Initialize(const std::string& log_path) {
        auto file_sink = std::make_shared<spdlog::sinks::rotating_file_sink_mt>(
            log_path, 1024 * 1024 * 10, 3);
        
        auto console_sink = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();
        
        std::vector<spdlog::sink_ptr> sinks{file_sink, console_sink};
        auto logger = std::make_shared<spdlog::logger>("nexus", sinks.begin(), sinks.end());
        
        spdlog::set_default_logger(logger);
        spdlog::set_level(spdlog::level::debug);
        spdlog::set_pattern("[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] [%t] %v");
    }
    
    template<typename... Args>
    static void Info(fmt::format_string<Args...> fmt, Args&&... args) {
        spdlog::info(fmt, std::forward<Args>(args)...);
    }
    
    template<typename... Args>
    static void Error(fmt::format_string<Args...> fmt, Args&&... args) {
        spdlog::error(fmt, std::forward<Args>(args)...);
    }
    
    template<typename... Args>
    static void Debug(fmt::format_string<Args...> fmt, Args&&... args) {
        spdlog::debug(fmt, std::forward<Args>(args)...);
    }
};
```

## Component Interactions

### Typical User Action Flow

```
User clicks link
       ↓
Browser Manager (detects click)
       ↓
Tab Manager (handle navigation)
       ↓
Renderer Process (load page)
       ↓
DOM Monitor (page loaded)
       ↓
Content Extractor (extract content)
       ↓
IPC Message to Main Process
       ↓
AI Orchestrator (analyze content)
       ↓
AI Process (run inference)
       ↓
AI Orchestrator (receive results)
       ↓
Database Manager (store insights)
       ↓
IPC Message to Renderer
       ↓
UI Update (show insights)
```

### Component Dependency Graph

```
                    ┌──────────────────┐
                    │  Browser Manager │
                    └────────┬─────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
        ┌───────▼──────┐ ┌──▼────────┐ ┌▼─────────────┐
        │   Process    │ │ Extension │ │      AI      │
        │   Manager    │ │  Manager  │ │ Orchestrator │
        └──────────────┘ └───────────┘ └──────┬───────┘
                                               │
                                        ┌──────▼─────────┐
                                        │   AI Process   │
                                        │     Manager    │
                                        └────────────────┘
        
        ┌────────────────┐
        │    Database    │
        │    Manager     │
        └────────┬───────┘
                 │
        ┌────────▼───────┐
        │    Settings    │
        │    Manager     │
        └────────────────┘
        
        All components depend on:
        - Event Bus
        - Logger
```
