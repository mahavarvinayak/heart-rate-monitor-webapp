# Inter-Process Communication (IPC) Architecture

## Table of Contents
1. [Overview](#overview)
2. [CEF IPC System](#cef-ipc-system)
3. [Message Types](#message-types)
4. [Communication Patterns](#communication-patterns)
5. [Message Routing](#message-routing)
6. [Performance Optimization](#performance-optimization)
7. [Security](#security)

## Overview

Project Nexus uses Chromium Embedded Framework's (CEF) built-in IPC system for inter-process communication. This system provides:
- **Type-safe messaging**: Structured message passing
- **Asynchronous communication**: Non-blocking operations
- **Process isolation**: Secure sandbox boundaries
- **Bi-directional communication**: Two-way message flow

## CEF IPC System

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      Main Process                             │
│                                                                │
│  ┌────────────────────┐         ┌────────────────────┐       │
│  │  CefBrowserHost    │◄────────┤  Message Router    │       │
│  └────────────────────┘         └────────────────────┘       │
│           │                              │                    │
└───────────┼──────────────────────────────┼────────────────────┘
            │                              │
            │ CEF IPC Channel              │
            │                              │
┌───────────▼──────────────────────────────▼────────────────────┐
│                    Renderer Process                           │
│                                                                │
│  ┌────────────────────┐         ┌────────────────────┐       │
│  │  CefBrowser        │◄────────┤  Message Handler   │       │
│  └────────────────────┘         └────────────────────┘       │
│           │                              │                    │
│  ┌────────▼──────────┐         ┌────────▼────────┐          │
│  │  V8 Context        │         │  CEF Bindings   │          │
│  └────────────────────┘         └─────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

### Core IPC Components

#### 1. CefProcessMessage
Basic message container for IPC:

```cpp
// Creating a message
CefRefPtr<CefProcessMessage> message = 
    CefProcessMessage::Create("ai_analyze_content");

// Get message arguments
CefRefPtr<CefListValue> args = message->GetArgumentList();
args->SetString(0, url);
args->SetString(1, content);

// Send from browser to renderer
browser->GetMainFrame()->SendProcessMessage(PID_RENDERER, message);
```

#### 2. Message Handler
Receiving and processing messages:

```cpp
class NexusMessageHandler : public CefClient {
public:
    bool OnProcessMessageReceived(
        CefRefPtr<CefBrowser> browser,
        CefRefPtr<CefFrame> frame,
        CefProcessId source_process,
        CefRefPtr<CefProcessMessage> message) override {
        
        const std::string& message_name = message->GetName();
        
        if (message_name == "ai_analyze_content") {
            HandleAIAnalyzeRequest(browser, message);
            return true;
        }
        else if (message_name == "ai_analysis_result") {
            HandleAIAnalysisResult(browser, message);
            return true;
        }
        
        return false;
    }
    
private:
    void HandleAIAnalyzeRequest(
        CefRefPtr<CefBrowser> browser,
        CefRefPtr<CefProcessMessage> message) {
        
        CefRefPtr<CefListValue> args = message->GetArgumentList();
        std::string url = args->GetString(0);
        std::string content = args->GetString(1);
        
        // Forward to AI process
        ai_orchestrator_->AnalyzeContent(url, content, 
            [browser](const AIResult& result) {
                SendAIResultToRenderer(browser, result);
            });
    }
};
```

#### 3. V8 Extensions
JavaScript bindings for renderer process:

```cpp
class NexusV8Handler : public CefV8Handler {
public:
    bool Execute(const CefString& name,
                CefRefPtr<CefV8Value> object,
                const CefV8ValueList& arguments,
                CefRefPtr<CefV8Value>& retval,
                CefString& exception) override {
        
        if (name == "analyzeContent") {
            if (arguments.size() != 2) {
                exception = "Invalid argument count";
                return true;
            }
            
            std::string url = arguments[0]->GetStringValue();
            std::string content = arguments[1]->GetStringValue();
            
            // Send IPC message to browser process
            CefRefPtr<CefProcessMessage> message =
                CefProcessMessage::Create("ai_analyze_content");
            
            CefRefPtr<CefListValue> args = message->GetArgumentList();
            args->SetString(0, url);
            args->SetString(1, content);
            
            CefRefPtr<CefBrowser> browser = 
                CefV8Context::GetCurrentContext()->GetBrowser();
            browser->GetMainFrame()->SendProcessMessage(
                PID_BROWSER, message);
            
            retval = CefV8Value::CreateBool(true);
            return true;
        }
        
        return false;
    }
    
    IMPLEMENT_REFCOUNTING(NexusV8Handler);
};

// Register V8 extension
void RegisterV8Extensions() {
    std::string extension_code =
        "var nexus;"
        "if (!nexus) nexus = {};"
        "(function() {"
        "  nexus.analyzeContent = function(url, content) {"
        "    native function analyzeContent();"
        "    return analyzeContent(url, content);"
        "  };"
        "})();";
    
    CefRegisterExtension("v8/nexus", extension_code, 
        new NexusV8Handler());
}
```

## Message Types

### 1. Navigation Messages

```cpp
// Navigation request
struct NavigationMessage {
    std::string url;
    int tab_id;
    bool new_window;
    bool incognito;
};

// Browser → Renderer
void SendNavigationRequest(CefRefPtr<CefBrowser> browser, 
                           const NavigationMessage& nav) {
    auto msg = CefProcessMessage::Create("navigate");
    auto args = msg->GetArgumentList();
    args->SetString(0, nav.url);
    args->SetInt(1, nav.tab_id);
    args->SetBool(2, nav.new_window);
    browser->GetMainFrame()->SendProcessMessage(PID_RENDERER, msg);
}

// Renderer → Browser (navigation complete)
void SendNavigationComplete(CefRefPtr<CefFrame> frame, 
                            const std::string& final_url) {
    auto msg = CefProcessMessage::Create("navigation_complete");
    auto args = msg->GetArgumentList();
    args->SetString(0, final_url);
    frame->SendProcessMessage(PID_BROWSER, msg);
}
```

### 2. AI Processing Messages

```cpp
// Content analysis request
struct AIAnalysisRequest {
    std::string url;
    std::string content;
    std::string content_type;
    std::vector<std::string> features;
};

// Browser → AI Process
void SendAIAnalysisRequest(const AIAnalysisRequest& req) {
    nlohmann::json payload = {
        {"url", req.url},
        {"content", req.content},
        {"content_type", req.content_type},
        {"features", req.features}
    };
    
    auto msg = CefProcessMessage::Create("ai_analyze");
    auto args = msg->GetArgumentList();
    args->SetString(0, payload.dump());
    
    // Send to AI process via custom routing
    ai_process_router_->SendMessage(msg);
}

// AI Process → Browser (results)
struct AIAnalysisResult {
    std::string url;
    std::string category;
    double confidence;
    std::vector<std::string> entities;
    std::map<std::string, double> sentiments;
};

void SendAIAnalysisResult(const AIAnalysisResult& result) {
    nlohmann::json payload = {
        {"url", result.url},
        {"category", result.category},
        {"confidence", result.confidence},
        {"entities", result.entities},
        {"sentiments", result.sentiments}
    };
    
    auto msg = CefProcessMessage::Create("ai_result");
    auto args = msg->GetArgumentList();
    args->SetString(0, payload.dump());
    
    browser_process_router_->SendMessage(msg);
}
```

### 3. UI Update Messages

```cpp
// Browser → Renderer (update UI)
struct UIUpdateMessage {
    std::string element_id;
    std::string property;
    std::string value;
};

void SendUIUpdate(CefRefPtr<CefBrowser> browser,
                 const UIUpdateMessage& update) {
    // Execute JavaScript directly
    std::string script = fmt::format(
        "document.getElementById('{}').{} = '{}';",
        update.element_id,
        update.property,
        update.value
    );
    
    browser->GetMainFrame()->ExecuteJavaScript(
        script,
        browser->GetMainFrame()->GetURL(),
        0
    );
}
```

### 4. Data Synchronization Messages

```cpp
// Synchronize data between processes
struct SyncMessage {
    std::string data_type;  // "bookmarks", "history", "settings"
    std::string action;     // "add", "update", "delete"
    nlohmann::json data;
};

void SendSyncMessage(const SyncMessage& sync) {
    auto msg = CefProcessMessage::Create("data_sync");
    auto args = msg->GetArgumentList();
    args->SetString(0, sync.data_type);
    args->SetString(1, sync.action);
    args->SetString(2, sync.data.dump());
    
    // Broadcast to all renderer processes
    BroadcastToAllRenderers(msg);
}
```

## Communication Patterns

### 1. Request-Response Pattern

```cpp
class IPCRequestHandler {
public:
    // Send request and register callback
    void SendRequest(const std::string& request_type,
                    const nlohmann::json& data,
                    std::function<void(const nlohmann::json&)> callback) {
        
        int request_id = GenerateRequestID();
        
        // Store callback
        pending_requests_[request_id] = callback;
        
        // Send message
        auto msg = CefProcessMessage::Create(request_type);
        auto args = msg->GetArgumentList();
        args->SetInt(0, request_id);
        args->SetString(1, data.dump());
        
        SendMessage(msg);
        
        // Set timeout
        SetTimeout(request_id, std::chrono::seconds(30));
    }
    
    // Handle response
    void HandleResponse(int request_id, const nlohmann::json& response) {
        auto it = pending_requests_.find(request_id);
        if (it != pending_requests_.end()) {
            it->second(response);
            pending_requests_.erase(it);
            CancelTimeout(request_id);
        }
    }
    
private:
    std::map<int, std::function<void(const nlohmann::json&)>> pending_requests_;
    int next_request_id_ = 1;
    
    int GenerateRequestID() {
        return next_request_id_++;
    }
};

// Usage
ipc_handler_->SendRequest("ai_analyze", 
    {{"url", url}, {"content", content}},
    [](const nlohmann::json& result) {
        // Handle AI analysis result
        std::string category = result["category"];
        double confidence = result["confidence"];
        UpdateUI(category, confidence);
    });
```

### 2. Publish-Subscribe Pattern

```cpp
class IPCEventBus {
public:
    // Subscribe to events
    void Subscribe(const std::string& event_type,
                  std::function<void(const nlohmann::json&)> handler) {
        subscribers_[event_type].push_back(handler);
    }
    
    // Publish events
    void Publish(const std::string& event_type,
                const nlohmann::json& data) {
        auto it = subscribers_.find(event_type);
        if (it != subscribers_.end()) {
            for (auto& handler : it->second) {
                handler(data);
            }
        }
        
        // Also send to other processes
        BroadcastEvent(event_type, data);
    }
    
private:
    std::map<std::string, 
             std::vector<std::function<void(const nlohmann::json&)>>> 
        subscribers_;
};

// Usage
event_bus_->Subscribe("tab_created", [](const nlohmann::json& data) {
    int tab_id = data["tab_id"];
    std::string url = data["url"];
    // Update UI
});

event_bus_->Publish("tab_created", {
    {"tab_id", tab_id},
    {"url", url}
});
```

### 3. Streaming Pattern

```cpp
class IPCStreamHandler {
public:
    // Start streaming data
    void StartStream(const std::string& stream_id,
                    std::function<void(const nlohmann::json&)> on_data,
                    std::function<void()> on_end) {
        
        Stream stream{on_data, on_end};
        active_streams_[stream_id] = stream;
        
        // Notify remote process
        auto msg = CefProcessMessage::Create("stream_start");
        auto args = msg->GetArgumentList();
        args->SetString(0, stream_id);
        SendMessage(msg);
    }
    
    // Handle incoming stream data
    void HandleStreamData(const std::string& stream_id,
                         const nlohmann::json& data) {
        auto it = active_streams_.find(stream_id);
        if (it != active_streams_.end()) {
            it->second.on_data(data);
        }
    }
    
    // End stream
    void EndStream(const std::string& stream_id) {
        auto it = active_streams_.find(stream_id);
        if (it != active_streams_.end()) {
            it->second.on_end();
            active_streams_.erase(it);
        }
    }
    
private:
    struct Stream {
        std::function<void(const nlohmann::json&)> on_data;
        std::function<void()> on_end;
    };
    
    std::map<std::string, Stream> active_streams_;
};

// Usage: Streaming AI inference results
stream_handler_->StartStream("ai_batch_inference",
    [](const nlohmann::json& result) {
        // Process each result as it arrives
        DisplayResult(result);
    },
    []() {
        // All results received
        UpdateUIComplete();
    });
```

## Message Routing

### Custom Message Router

```cpp
class MessageRouter {
public:
    // Register message handler
    void RegisterHandler(const std::string& message_type,
                        MessageHandler handler) {
        handlers_[message_type] = handler;
    }
    
    // Route message to appropriate handler
    bool RouteMessage(CefRefPtr<CefBrowser> browser,
                     CefRefPtr<CefProcessMessage> message) {
        
        const std::string& name = message->GetName();
        auto it = handlers_.find(name);
        
        if (it != handlers_.end()) {
            it->second(browser, message);
            return true;
        }
        
        return false;
    }
    
private:
    using MessageHandler = std::function<void(
        CefRefPtr<CefBrowser>,
        CefRefPtr<CefProcessMessage>)>;
    
    std::map<std::string, MessageHandler> handlers_;
};

// Setup routing
void SetupMessageRouting() {
    router_->RegisterHandler("ai_analyze", 
        [this](auto browser, auto message) {
            HandleAIAnalyze(browser, message);
        });
    
    router_->RegisterHandler("navigation_request",
        [this](auto browser, auto message) {
            HandleNavigationRequest(browser, message);
        });
    
    router_->RegisterHandler("sync_data",
        [this](auto browser, auto message) {
            HandleDataSync(browser, message);
        });
}
```

### Process-Specific Routing

```cpp
class ProcessRouter {
public:
    // Send to specific process type
    void SendToProcess(ProcessType type,
                      CefRefPtr<CefProcessMessage> message) {
        switch (type) {
            case ProcessType::RENDERER:
                SendToRenderer(message);
                break;
            case ProcessType::GPU:
                SendToGPU(message);
                break;
            case ProcessType::AI:
                SendToAI(message);
                break;
        }
    }
    
    // Broadcast to all processes of a type
    void BroadcastToProcessType(ProcessType type,
                               CefRefPtr<CefProcessMessage> message) {
        auto processes = GetProcessesByType(type);
        for (auto& process : processes) {
            SendToProcess(process.id, message);
        }
    }
    
private:
    void SendToRenderer(CefRefPtr<CefProcessMessage> message) {
        // Use CEF's browser process → renderer process IPC
        for (auto& browser : browsers_) {
            browser->GetMainFrame()->SendProcessMessage(
                PID_RENDERER, message);
        }
    }
    
    void SendToAI(CefRefPtr<CefProcessMessage> message) {
        // Use custom IPC for AI process (named pipes, sockets, etc.)
        ai_ipc_channel_->Send(message);
    }
};
```

## Performance Optimization

### 1. Message Batching

```cpp
class MessageBatcher {
public:
    void QueueMessage(CefRefPtr<CefProcessMessage> message) {
        pending_messages_.push_back(message);
        
        if (pending_messages_.size() >= BATCH_SIZE) {
            Flush();
        }
        else if (!flush_timer_active_) {
            // Flush after timeout
            StartFlushTimer(std::chrono::milliseconds(16));
        }
    }
    
    void Flush() {
        if (pending_messages_.empty()) return;
        
        // Create batch message
        auto batch = CefProcessMessage::Create("message_batch");
        auto args = batch->GetArgumentList();
        
        nlohmann::json batch_data;
        for (const auto& msg : pending_messages_) {
            batch_data.push_back(SerializeMessage(msg));
        }
        
        args->SetString(0, batch_data.dump());
        SendMessage(batch);
        
        pending_messages_.clear();
        flush_timer_active_ = false;
    }
    
private:
    static constexpr size_t BATCH_SIZE = 10;
    std::vector<CefRefPtr<CefProcessMessage>> pending_messages_;
    bool flush_timer_active_ = false;
};
```

### 2. Shared Memory

```cpp
class SharedMemoryIPC {
public:
    bool Initialize(size_t size) {
        // Create shared memory region
        shm_ = CreateSharedMemory(size);
        return shm_ != nullptr;
    }
    
    // Write large data to shared memory
    bool WriteData(const void* data, size_t size) {
        if (size > shm_->size()) return false;
        
        std::memcpy(shm_->data(), data, size);
        
        // Send notification via IPC
        auto msg = CefProcessMessage::Create("shm_data_ready");
        auto args = msg->GetArgumentList();
        args->SetInt(0, static_cast<int>(size));
        SendMessage(msg);
        
        return true;
    }
    
    // Read data from shared memory
    bool ReadData(void* buffer, size_t size) {
        if (size > shm_->size()) return false;
        std::memcpy(buffer, shm_->data(), size);
        return true;
    }
    
private:
    std::unique_ptr<SharedMemory> shm_;
};

// Usage for large AI model data
shared_mem_->WriteData(model_weights.data(), model_weights.size());
```

### 3. Message Compression

```cpp
class MessageCompressor {
public:
    CefRefPtr<CefProcessMessage> Compress(
        CefRefPtr<CefProcessMessage> message) {
        
        // Serialize message
        std::string serialized = SerializeMessage(message);
        
        // Compress if worthwhile
        if (serialized.size() > MIN_COMPRESSION_SIZE) {
            std::string compressed = ZlibCompress(serialized);
            
            auto msg = CefProcessMessage::Create("compressed_message");
            auto args = msg->GetArgumentList();
            args->SetString(0, message->GetName());
            args->SetBinary(1, CreateBinaryValue(compressed));
            
            return msg;
        }
        
        return message;
    }
    
private:
    static constexpr size_t MIN_COMPRESSION_SIZE = 1024;  // 1 KB
};
```

## Security

### 1. Message Validation

```cpp
class MessageValidator {
public:
    bool ValidateMessage(CefRefPtr<CefProcessMessage> message,
                        CefProcessId source) {
        const std::string& name = message->GetName();
        
        // Check message type is allowed from source
        if (!IsAllowedMessage(name, source)) {
            LOG(ERROR) << "Unauthorized message: " << name;
            return false;
        }
        
        // Validate message structure
        if (!ValidateStructure(message)) {
            LOG(ERROR) << "Invalid message structure: " << name;
            return false;
        }
        
        // Validate message size
        if (GetMessageSize(message) > MAX_MESSAGE_SIZE) {
            LOG(ERROR) << "Message too large: " << name;
            return false;
        }
        
        return true;
    }
    
private:
    static constexpr size_t MAX_MESSAGE_SIZE = 10 * 1024 * 1024;  // 10 MB
    
    bool IsAllowedMessage(const std::string& name, CefProcessId source) {
        // Define allowed messages per process type
        static const std::map<CefProcessId, std::set<std::string>> 
            allowed_messages = {
                {PID_RENDERER, {"navigation_request", "ai_analyze"}},
                {PID_BROWSER, {"navigation_complete", "ai_result"}}
            };
        
        auto it = allowed_messages.find(source);
        if (it == allowed_messages.end()) return false;
        
        return it->second.count(name) > 0;
    }
};
```

### 2. Rate Limiting

```cpp
class IPCRateLimiter {
public:
    bool CheckRateLimit(int process_id, const std::string& message_type) {
        auto key = std::make_pair(process_id, message_type);
        auto& state = rate_limit_state_[key];
        
        auto now = std::chrono::steady_clock::now();
        
        // Reset if window expired
        if (now - state.window_start > std::chrono::seconds(1)) {
            state.count = 0;
            state.window_start = now;
        }
        
        // Check limit
        if (state.count >= GetRateLimit(message_type)) {
            LOG(WARNING) << "Rate limit exceeded for " << message_type;
            return false;
        }
        
        state.count++;
        return true;
    }
    
private:
    struct RateLimitState {
        int count = 0;
        std::chrono::steady_clock::time_point window_start;
    };
    
    std::map<std::pair<int, std::string>, RateLimitState> rate_limit_state_;
    
    int GetRateLimit(const std::string& message_type) {
        static const std::map<std::string, int> limits = {
            {"ai_analyze", 10},      // 10 per second
            {"navigation_request", 5}, // 5 per second
            {"sync_data", 20}        // 20 per second
        };
        
        auto it = limits.find(message_type);
        return it != limits.end() ? it->second : 100;
    }
};
```

### 3. Message Encryption (for sensitive data)

```cpp
class SecureIPCChannel {
public:
    void SendSecureMessage(const std::string& message_type,
                          const nlohmann::json& data) {
        // Encrypt data
        std::string encrypted = EncryptData(data.dump());
        
        auto msg = CefProcessMessage::Create(message_type);
        auto args = msg->GetArgumentList();
        args->SetBinary(0, CreateBinaryValue(encrypted));
        
        SendMessage(msg);
    }
    
    nlohmann::json ReceiveSecureMessage(
        CefRefPtr<CefProcessMessage> message) {
        
        auto args = message->GetArgumentList();
        auto binary = args->GetBinary(0);
        
        std::vector<uint8_t> encrypted(binary->GetSize());
        binary->GetData(encrypted.data(), encrypted.size(), 0);
        
        std::string decrypted = DecryptData(encrypted);
        return nlohmann::json::parse(decrypted);
    }
    
private:
    std::string EncryptData(const std::string& data);
    std::string DecryptData(const std::vector<uint8_t>& encrypted);
};
```

## Debugging and Monitoring

### IPC Message Logger

```cpp
class IPCMessageLogger {
public:
    void LogMessage(const std::string& direction,
                   CefRefPtr<CefProcessMessage> message,
                   CefProcessId process) {
        
        if (!logging_enabled_) return;
        
        nlohmann::json log_entry = {
            {"timestamp", GetCurrentTimestamp()},
            {"direction", direction},
            {"message_type", message->GetName()},
            {"process", ProcessIdToString(process)},
            {"size", GetMessageSize(message)}
        };
        
        spdlog::debug("IPC: {}", log_entry.dump());
        
        // Store for debugging
        message_history_.push_back(log_entry);
        if (message_history_.size() > MAX_HISTORY_SIZE) {
            message_history_.pop_front();
        }
    }
    
private:
    bool logging_enabled_ = true;
    std::deque<nlohmann::json> message_history_;
    static constexpr size_t MAX_HISTORY_SIZE = 1000;
};
```
