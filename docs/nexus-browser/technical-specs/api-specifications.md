# API Specifications

## Table of Contents
1. [Overview](#overview)
2. [Internal APIs](#internal-apis)
3. [Extension APIs](#extension-apis)
4. [JavaScript Bindings](#javascript-bindings)
5. [IPC Message Protocols](#ipc-message-protocols)

## Overview

Project Nexus exposes several APIs for different purposes:
- **Internal APIs**: C++ interfaces for core components
- **Extension APIs**: JavaScript APIs for browser extensions
- **JavaScript Bindings**: Native bindings exposed to web content
- **IPC Protocols**: Message formats for inter-process communication

## Internal APIs

### Browser Manager API

```cpp
// browser_manager.h
namespace nexus {

class IBrowserManager {
public:
    virtual ~IBrowserManager() = default;
    
    /**
     * Create a new browser window
     * @param config Window configuration
     * @return Browser ID or -1 on failure
     */
    virtual int CreateBrowser(const BrowserConfig& config) = 0;
    
    /**
     * Close a browser window
     * @param browser_id Browser identifier
     * @return true if successful
     */
    virtual bool CloseBrowser(int browser_id) = 0;
    
    /**
     * Create a new tab
     * @param browser_id Parent browser
     * @param url Initial URL to load
     * @return Tab ID or -1 on failure
     */
    virtual int CreateTab(int browser_id, const std::string& url) = 0;
    
    /**
     * Close a tab
     * @param tab_id Tab identifier
     * @return true if successful
     */
    virtual bool CloseTab(int tab_id) = 0;
    
    /**
     * Navigate to URL
     * @param tab_id Tab identifier
     * @param url URL to navigate to
     * @return true if navigation started
     */
    virtual bool Navigate(int tab_id, const std::string& url) = 0;
    
    /**
     * Get all tabs in a browser
     * @param browser_id Browser identifier
     * @return List of tab information
     */
    virtual std::vector<TabInfo> GetTabs(int browser_id) = 0;
};

// Configuration structures
struct BrowserConfig {
    int width = 1920;
    int height = 1080;
    bool maximized = false;
    bool incognito = false;
    std::string profile_name = "default";
};

struct TabInfo {
    int id;
    std::string url;
    std::string title;
    bool loading;
    bool can_go_back;
    bool can_go_forward;
    int renderer_process_id;
};

} // namespace nexus
```

### AI Orchestrator API

```cpp
// ai_orchestrator.h
namespace nexus {

using AICallback = std::function<void(const AIResponse&)>;

class IAIOrchestrator {
public:
    virtual ~IAIOrchestrator() = default;
    
    /**
     * Analyze web content
     * @param url Page URL
     * @param content Page content
     * @param callback Callback when analysis completes
     */
    virtual void AnalyzeContent(
        const std::string& url,
        const std::string& content,
        AICallback callback) = 0;
    
    /**
     * Get recommendations for user
     * @param user_id User identifier
     * @param context Current context
     * @param callback Callback with recommendations
     */
    virtual void GetRecommendations(
        int user_id,
        const UserContext& context,
        AICallback callback) = 0;
    
    /**
     * Classify content into category
     * @param content Text content
     * @param callback Callback with classification
     */
    virtual void ClassifyContent(
        const std::string& content,
        AICallback callback) = 0;
};

struct AIResponse {
    bool success;
    std::string error_message;
    nlohmann::json data;
};

struct UserContext {
    std::vector<std::string> recent_urls;
    std::vector<std::string> interests;
    std::map<std::string, double> category_weights;
};

} // namespace nexus
```

### Database Manager API

```cpp
// database_manager.h
namespace nexus {

class IDatabaseManager {
public:
    virtual ~IDatabaseManager() = default;
    
    // History operations
    virtual bool AddHistory(const HistoryEntry& entry) = 0;
    virtual std::vector<HistoryEntry> SearchHistory(
        const std::string& query,
        int limit = 100) = 0;
    virtual bool DeleteHistory(int64_t id) = 0;
    virtual bool ClearHistory(int64_t start_time, int64_t end_time) = 0;
    
    // Bookmark operations
    virtual bool AddBookmark(const Bookmark& bookmark) = 0;
    virtual std::vector<Bookmark> GetBookmarks(
        const std::string& folder = "") = 0;
    virtual bool UpdateBookmark(const Bookmark& bookmark) = 0;
    virtual bool DeleteBookmark(int64_t id) = 0;
    
    // Settings operations
    virtual bool SetSetting(const std::string& key, 
                           const std::string& value) = 0;
    virtual std::optional<std::string> GetSetting(
        const std::string& key) = 0;
};

struct HistoryEntry {
    int64_t id = 0;
    std::string url;
    std::string title;
    int64_t visit_time;
    int visit_count = 1;
};

struct Bookmark {
    int64_t id = 0;
    std::string url;
    std::string title;
    std::string folder;
    int64_t created_at;
};

} // namespace nexus
```

## Extension APIs

### Extension Manifest

```json
{
  "manifest_version": 3,
  "name": "Example Extension",
  "version": "1.0.0",
  "description": "An example Nexus browser extension",
  "permissions": [
    "tabs",
    "storage",
    "ai"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  }
}
```

### Tabs API

```javascript
// nexus.tabs API
const nexus = {
  tabs: {
    /**
     * Create a new tab
     * @param {Object} createProperties
     * @returns {Promise<Tab>}
     */
    create: async function(createProperties) {
      // Implementation
    },
    
    /**
     * Get information about a tab
     * @param {number} tabId
     * @returns {Promise<Tab>}
     */
    get: async function(tabId) {
      // Implementation
    },
    
    /**
     * Query tabs
     * @param {Object} queryInfo
     * @returns {Promise<Tab[]>}
     */
    query: async function(queryInfo) {
      // Implementation
    },
    
    /**
     * Update tab properties
     * @param {number} tabId
     * @param {Object} updateProperties
     * @returns {Promise<Tab>}
     */
    update: async function(tabId, updateProperties) {
      // Implementation
    },
    
    /**
     * Close a tab
     * @param {number} tabId
     * @returns {Promise<void>}
     */
    remove: async function(tabId) {
      // Implementation
    },
    
    /**
     * Listen for tab events
     */
    onCreated: {
      addListener: function(callback) {}
    },
    onUpdated: {
      addListener: function(callback) {}
    },
    onRemoved: {
      addListener: function(callback) {}
    }
  }
};

// Tab object structure
interface Tab {
  id: number;
  url: string;
  title: string;
  active: boolean;
  windowId: number;
  index: number;
}
```

### AI API (Extension)

```javascript
// nexus.ai API - AI capabilities for extensions
const nexus = {
  ai: {
    /**
     * Analyze content
     * @param {string} content - Content to analyze
     * @param {Object} options - Analysis options
     * @returns {Promise<AnalysisResult>}
     */
    analyzeContent: async function(content, options = {}) {
      return await nexus.internal.sendMessage({
        type: 'ai_analyze',
        content: content,
        features: options.features || ['category', 'entities', 'sentiment']
      });
    },
    
    /**
     * Get recommendations
     * @param {Object} context - User context
     * @returns {Promise<Recommendation[]>}
     */
    getRecommendations: async function(context) {
      return await nexus.internal.sendMessage({
        type: 'ai_recommend',
        context: context
      });
    },
    
    /**
     * Classify text
     * @param {string} text
     * @returns {Promise<Classification>}
     */
    classify: async function(text) {
      return await nexus.internal.sendMessage({
        type: 'ai_classify',
        text: text
      });
    },
    
    /**
     * Extract entities from text
     * @param {string} text
     * @returns {Promise<Entity[]>}
     */
    extractEntities: async function(text) {
      return await nexus.internal.sendMessage({
        type: 'ai_extract_entities',
        text: text
      });
    }
  }
};

// Type definitions
interface AnalysisResult {
  category: string;
  confidence: number;
  entities: Entity[];
  sentiment: Sentiment;
}

interface Entity {
  text: string;
  type: string;
  start: number;
  end: number;
}

interface Sentiment {
  positive: number;
  negative: number;
  neutral: number;
}

interface Classification {
  category: string;
  confidence: number;
  subcategories: Array<{category: string, confidence: number}>;
}

interface Recommendation {
  url: string;
  title: string;
  score: number;
  reason: string;
}
```

### Storage API

```javascript
// nexus.storage API
const nexus = {
  storage: {
    local: {
      /**
       * Get items from storage
       * @param {string|string[]|null} keys
       * @returns {Promise<Object>}
       */
      get: async function(keys) {
        // Implementation
      },
      
      /**
       * Set items in storage
       * @param {Object} items
       * @returns {Promise<void>}
       */
      set: async function(items) {
        // Implementation
      },
      
      /**
       * Remove items from storage
       * @param {string|string[]} keys
       * @returns {Promise<void>}
       */
      remove: async function(keys) {
        // Implementation
      },
      
      /**
       * Clear all storage
       * @returns {Promise<void>}
       */
      clear: async function() {
        // Implementation
      }
    },
    
    sync: {
      // Same API as local, but syncs across devices
    }
  }
};
```

## JavaScript Bindings

### Native Bindings for Web Content

```javascript
// window.nexus - Available to web pages (with permission)
window.nexus = {
  /**
   * Check if Nexus browser
   * @returns {boolean}
   */
  isNexusBrowser: function() {
    return true;
  },
  
  /**
   * Get browser version
   * @returns {string}
   */
  getVersion: function() {
    return '0.1.0';
  },
  
  /**
   * Request AI analysis (requires permission)
   * @param {Object} options
   * @returns {Promise<AnalysisResult>}
   */
  requestAIAnalysis: async function(options) {
    // Requires user permission
    return await this.internal.sendMessage({
      type: 'request_ai_analysis',
      options: options
    });
  },
  
  /**
   * Get user preferences (requires permission)
   * @returns {Promise<Object>}
   */
  getUserPreferences: async function() {
    return await this.internal.sendMessage({
      type: 'get_user_preferences'
    });
  },
  
  // Internal communication (not exposed to scripts)
  internal: {
    sendMessage: function(message) {
      // Implemented in C++ via V8 binding
    }
  }
};
```

### V8 Binding Implementation

```cpp
// v8_bindings.cpp
void RegisterNexusBindings(CefRefPtr<CefV8Context> context) {
    CefRefPtr<CefV8Value> global = context->GetGlobal();
    
    // Create nexus object
    CefRefPtr<CefV8Value> nexus = CefV8Value::CreateObject(nullptr, nullptr);
    
    // Add isNexusBrowser function
    CefRefPtr<CefV8Value> isNexusBrowser = CefV8Value::CreateFunction(
        "isNexusBrowser", new NexusV8Handler());
    nexus->SetValue("isNexusBrowser", isNexusBrowser, V8_PROPERTY_ATTRIBUTE_NONE);
    
    // Add getVersion function
    CefRefPtr<CefV8Value> getVersion = CefV8Value::CreateFunction(
        "getVersion", new NexusV8Handler());
    nexus->SetValue("getVersion", getVersion, V8_PROPERTY_ATTRIBUTE_NONE);
    
    // Add to window
    global->SetValue("nexus", nexus, V8_PROPERTY_ATTRIBUTE_NONE);
}

class NexusV8Handler : public CefV8Handler {
public:
    bool Execute(const CefString& name,
                CefRefPtr<CefV8Value> object,
                const CefV8ValueList& arguments,
                CefRefPtr<CefV8Value>& retval,
                CefString& exception) override {
        
        if (name == "isNexusBrowser") {
            retval = CefV8Value::CreateBool(true);
            return true;
        }
        else if (name == "getVersion") {
            retval = CefV8Value::CreateString("0.1.0");
            return true;
        }
        else if (name == "requestAIAnalysis") {
            // Check permissions first
            if (!CheckPermission("ai")) {
                exception = "Permission denied";
                return true;
            }
            
            // Send IPC message to browser process
            SendIPCMessage("ai_analyze", arguments);
            
            // Return promise
            retval = CreatePromise();
            return true;
        }
        
        return false;
    }
    
    IMPLEMENT_REFCOUNTING(NexusV8Handler);
};
```

## IPC Message Protocols

### Message Format

```cpp
struct IPCMessage {
    std::string type;           // Message type
    int sender_id;              // Sender process ID
    int recipient_id;           // Recipient process ID
    uint64_t request_id;        // For request-response matching
    nlohmann::json payload;     // Message data
    uint64_t timestamp;         // Message timestamp
};
```

### Message Types

#### Navigation Messages

```json
// Navigate to URL
{
  "type": "navigate",
  "payload": {
    "tab_id": 1,
    "url": "https://example.com",
    "new_tab": false
  }
}

// Navigation complete
{
  "type": "navigation_complete",
  "payload": {
    "tab_id": 1,
    "url": "https://example.com",
    "title": "Example Domain",
    "status_code": 200
  }
}
```

#### AI Messages

```json
// AI analysis request
{
  "type": "ai_analyze",
  "request_id": 12345,
  "payload": {
    "url": "https://example.com",
    "content": "Page content...",
    "features": ["category", "entities", "sentiment"]
  }
}

// AI analysis response
{
  "type": "ai_result",
  "request_id": 12345,
  "payload": {
    "category": "news",
    "confidence": 0.89,
    "entities": [
      {"text": "Example", "type": "ORG"}
    ],
    "sentiment": {
      "positive": 0.7,
      "negative": 0.1,
      "neutral": 0.2
    }
  }
}
```

#### Tab Messages

```json
// Create tab
{
  "type": "create_tab",
  "payload": {
    "browser_id": 1,
    "url": "https://example.com",
    "active": true
  }
}

// Tab created
{
  "type": "tab_created",
  "payload": {
    "tab_id": 5,
    "browser_id": 1,
    "url": "https://example.com"
  }
}

// Close tab
{
  "type": "close_tab",
  "payload": {
    "tab_id": 5
  }
}

// Tab closed
{
  "type": "tab_closed",
  "payload": {
    "tab_id": 5
  }
}
```

#### Data Sync Messages

```json
// Sync bookmark
{
  "type": "sync_data",
  "payload": {
    "data_type": "bookmark",
    "action": "add",
    "data": {
      "url": "https://example.com",
      "title": "Example",
      "folder": "Work"
    }
  }
}

// Sync history
{
  "type": "sync_data",
  "payload": {
    "data_type": "history",
    "action": "add",
    "data": {
      "url": "https://example.com",
      "title": "Example",
      "visit_time": 1697000000
    }
  }
}
```

### Error Handling

```json
// Error response
{
  "type": "error",
  "request_id": 12345,
  "payload": {
    "error_code": "AI_MODEL_NOT_LOADED",
    "error_message": "Failed to load AI model",
    "details": {
      "model_id": "content_classifier_v1"
    }
  }
}
```

### Message Validation Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["type", "payload"],
  "properties": {
    "type": {
      "type": "string",
      "enum": [
        "navigate", "navigation_complete",
        "ai_analyze", "ai_result",
        "create_tab", "tab_created",
        "close_tab", "tab_closed",
        "sync_data", "error"
      ]
    },
    "sender_id": {"type": "integer"},
    "recipient_id": {"type": "integer"},
    "request_id": {"type": "integer"},
    "payload": {"type": "object"},
    "timestamp": {"type": "integer"}
  }
}
```

## API Usage Examples

### Extension Example

```javascript
// background.js
nexus.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Analyze page content when loaded
    nexus.tabs.executeScript(tabId, {
      code: 'document.body.innerText'
    }).then(results => {
      const content = results[0];
      
      // Request AI analysis
      nexus.ai.analyzeContent(content, {
        features: ['category', 'entities']
      }).then(analysis => {
        console.log('Page category:', analysis.category);
        console.log('Entities:', analysis.entities);
        
        // Store results
        nexus.storage.local.set({
          [`analysis_${tab.url}`]: analysis
        });
      });
    });
  }
});

// Handle toolbar button click
nexus.action.onClicked.addListener((tab) => {
  // Get stored analysis
  nexus.storage.local.get(`analysis_${tab.url}`).then(data => {
    const analysis = data[`analysis_${tab.url}`];
    if (analysis) {
      // Show popup with results
      nexus.action.setPopup({
        popup: 'results.html'
      });
    }
  });
});
```

### C++ Internal API Example

```cpp
// Using Browser Manager API
auto browser_manager = BrowserManager::Create();

// Create browser window
BrowserConfig config;
config.width = 1920;
config.height = 1080;
config.maximized = false;

int browser_id = browser_manager->CreateBrowser(config);

// Create tab
int tab_id = browser_manager->CreateTab(browser_id, "https://example.com");

// Navigate
browser_manager->Navigate(tab_id, "https://google.com");

// Using AI Orchestrator
auto ai_orchestrator = AIOrchestrator::Create();

ai_orchestrator->AnalyzeContent(
    "https://example.com",
    page_content,
    [](const AIResponse& response) {
        if (response.success) {
            std::string category = response.data["category"];
            double confidence = response.data["confidence"];
            
            LOG(INFO) << "Category: " << category 
                     << " (confidence: " << confidence << ")";
        }
    });
```
