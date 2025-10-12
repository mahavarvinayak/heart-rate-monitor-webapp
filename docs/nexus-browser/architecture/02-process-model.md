# Process Model

## Table of Contents
1. [Overview](#overview)
2. [Process Types](#process-types)
3. [Process Lifecycle](#process-lifecycle)
4. [Process Communication](#process-communication)
5. [Resource Management](#resource-management)

## Overview

Project Nexus implements a multi-process architecture inspired by Chromium's security and stability model. This design isolates components into separate processes, providing:
- **Fault Isolation**: Crashes in one process don't affect others
- **Security**: Compromised renderer can't access system resources
- **Performance**: Parallel processing across CPU cores
- **Responsiveness**: Long-running tasks don't block UI

## Process Types

### 1. Main Process (Browser Process)

**Responsibility**: Core browser functionality and coordination

**Key Components**:
- Browser manager and window management
- Tab and navigation controller
- Extension and plugin coordinator
- Settings and preferences manager
- Database manager (SQLite)
- AI orchestrator
- Network coordinator

**Lifecycle**: 
- Starts on application launch
- Runs throughout application lifetime
- Terminates when application closes

**Resource Access**:
- Full file system access
- Network access
- System API access
- Database read/write
- Window system integration

**Code Structure**:
```cpp
// main_process.h
class MainProcess {
public:
    void Initialize();
    void Run();
    void Shutdown();
    
    // Process management
    void CreateRendererProcess(const std::string& url);
    void DestroyRendererProcess(int process_id);
    
    // AI coordination
    void ProcessAIRequest(const AIRequest& request);
    void HandleAIResponse(const AIResponse& response);
    
private:
    std::unique_ptr<BrowserManager> browser_manager_;
    std::unique_ptr<AIOrchestrator> ai_orchestrator_;
    std::unique_ptr<DatabaseManager> database_manager_;
    std::unique_ptr<ExtensionManager> extension_manager_;
};
```

### 2. Renderer Process

**Responsibility**: Web content rendering and JavaScript execution

**Key Components**:
- Blink rendering engine
- V8 JavaScript engine
- DOM and CSSOM implementation
- Web APIs (Canvas, WebGL, WebAudio, etc.)
- Content security enforcement

**Lifecycle**:
- Created when new tab/window opens
- Multiple instances (one per site/tab typically)
- Destroyed when tab closes or crashes
- Can be pre-launched for performance

**Resource Access**:
- **Sandboxed** - no direct file system access
- Limited network access (through browser process)
- No system API access
- Read-only access to specific resources

**Process Isolation**:
```
Site A (process 1) ← Cannot access → Site B (process 2)
     ↓                                      ↓
Main Process (coordinates via IPC)
```

**Code Structure**:
```cpp
// renderer_process.h
class RendererProcess {
public:
    void Initialize(int process_id);
    void LoadURL(const std::string& url);
    void ExecuteJavaScript(const std::string& script);
    
    // Content rendering
    void Render();
    void HandleInput(const InputEvent& event);
    
    // IPC handlers
    void OnMessageFromBrowser(const IPCMessage& message);
    void SendMessageToBrowser(const IPCMessage& message);
    
private:
    std::unique_ptr<BlinkEngine> blink_;
    std::unique_ptr<V8Engine> v8_;
    int process_id_;
    bool sandboxed_ = true;
};
```

### 3. GPU Process

**Responsibility**: Hardware-accelerated graphics operations

**Key Components**:
- OpenGL/Vulkan/DirectX context management
- Skia 2D graphics library
- Texture and shader management
- Display compositor
- Video decode/encode acceleration

**Lifecycle**:
- Starts after main process initialization
- Single instance shared by all processes
- Restarts automatically if crashed
- Can be disabled for software rendering fallback

**Resource Access**:
- GPU/graphics API access
- Limited memory access for textures
- No file system access
- No network access

**Architecture**:
```
Renderer 1 ──┐
Renderer 2 ──┤
Renderer 3 ──┼──→ GPU Process ──→ Display Output
Main UI   ──┤
AI Viz    ──┘
```

**Code Structure**:
```cpp
// gpu_process.h
class GPUProcess {
public:
    void Initialize();
    void CreateContext(int context_id);
    void DestroyContext(int context_id);
    
    // Rendering operations
    void CompositeFrame(const CompositeRequest& request);
    void AccelerateDecoding(const VideoFrame& frame);
    
    // Shader compilation
    void CompileShader(const ShaderSource& source);
    
private:
    std::unique_ptr<GraphicsContext> context_;
    std::unique_ptr<DisplayCompositor> compositor_;
    std::map<int, RenderContext> render_contexts_;
};
```

### 4. AI Process

**Responsibility**: Machine learning inference and AI features

**Key Components**:
- Python runtime environment
- TensorFlow/PyTorch models
- Content analysis engines
- NLP processors
- Computer vision models
- Recommendation engine

**Lifecycle**:
- Starts on-demand when AI features are needed
- Can be pre-launched for performance
- Persistent for frequently used features
- Graceful degradation if unavailable

**Resource Access**:
- Model file access (read-only)
- Limited memory for inference
- CPU/GPU compute access
- No direct network access
- No file system write access

**Architecture**:
```
┌─────────────────────────────────────┐
│         AI Process                   │
│  ┌────────────────────────────────┐ │
│  │  Python Runtime (3.10+)        │ │
│  │  ┌──────────┐  ┌────────────┐ │ │
│  │  │TensorFlow│  │  PyTorch   │ │ │
│  │  └──────────┘  └────────────┘ │ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │  Model Manager                 │ │
│  │  - Content Analysis            │ │
│  │  - Recommendation System       │ │
│  │  - Intent Recognition          │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Code Structure**:
```cpp
// ai_process.h
class AIProcess {
public:
    void Initialize();
    void LoadModel(const std::string& model_path);
    void UnloadModel(const std::string& model_id);
    
    // Inference operations
    AIResponse ProcessInference(const AIRequest& request);
    void ProcessBatch(const std::vector<AIRequest>& requests);
    
    // Model management
    bool IsModelLoaded(const std::string& model_id);
    void WarmupModel(const std::string& model_id);
    
private:
    std::unique_ptr<PythonRuntime> python_;
    std::map<std::string, ModelInstance> loaded_models_;
    std::unique_ptr<InferenceQueue> inference_queue_;
};
```

### 5. Utility Processes

**Responsibility**: Specialized services and background tasks

**Types**:

#### Network Service Process
- HTTP/HTTPS request handling
- DNS resolution
- Certificate validation
- Cookie management
- Cache management

#### Storage Service Process
- IndexedDB operations
- LocalStorage management
- File system abstraction
- Cache storage

#### Audio Service Process
- Audio decoding and encoding
- Audio mixing and output
- Media session handling

**Code Structure**:
```cpp
// network_service.h
class NetworkService {
public:
    void Initialize();
    void ProcessRequest(const NetworkRequest& request);
    void HandleResponse(const NetworkResponse& response);
    
private:
    std::unique_ptr<HttpClient> http_client_;
    std::unique_ptr<CacheManager> cache_manager_;
    std::unique_ptr<DNSResolver> dns_resolver_;
};
```

## Process Lifecycle

### Process Creation

```cpp
// Process creation flow
class ProcessManager {
public:
    int CreateProcess(ProcessType type, const ProcessConfig& config) {
        // 1. Allocate process ID
        int process_id = AllocateProcessID();
        
        // 2. Set up sandbox configuration
        SandboxConfig sandbox = CreateSandboxConfig(type);
        
        // 3. Launch process with appropriate privileges
        ProcessHandle handle = LaunchProcess(type, process_id, sandbox);
        
        // 4. Initialize IPC channels
        SetupIPCChannels(process_id, handle);
        
        // 5. Register process for monitoring
        RegisterProcess(process_id, handle, type);
        
        return process_id;
    }
};
```

### Process States

```
┌──────────┐     Initialize     ┌──────────┐
│ Created  │ ─────────────────→ │  Ready   │
└──────────┘                    └──────────┘
                                      │
                                      │ Activate
                                      ↓
                                ┌──────────┐
                         Idle   │  Active  │
                    ┌──────────→│          │
                    │           └──────────┘
                    │                 │
                    │                 │ Suspend
                    │                 ↓
                    │           ┌──────────┐
                    └───────────│ Suspended│
                                └──────────┘
                                      │
                                      │ Terminate
                                      ↓
                                ┌──────────┐
                                │Terminated│
                                └──────────┘
```

### Process Monitoring

```cpp
class ProcessMonitor {
public:
    void MonitorProcessHealth() {
        for (auto& [pid, info] : processes_) {
            // Check for crashes
            if (info.has_crashed) {
                HandleCrash(pid, info);
            }
            
            // Monitor resource usage
            ResourceUsage usage = GetResourceUsage(pid);
            if (usage.memory > MEMORY_LIMIT) {
                HandleMemoryPressure(pid);
            }
            
            // Check responsiveness
            if (!IsResponsive(pid)) {
                HandleUnresponsiveProcess(pid);
            }
        }
    }
    
private:
    void HandleCrash(int pid, const ProcessInfo& info) {
        if (info.type == ProcessType::RENDERER) {
            // Show sad tab
            ShowCrashPage(info.tab_id);
        } else if (info.type == ProcessType::GPU) {
            // Fallback to software rendering
            FallbackToSoftwareRendering();
        }
        
        // Log crash for diagnostics
        LogCrash(pid, info);
        
        // Restart if appropriate
        if (ShouldRestart(info)) {
            RestartProcess(info);
        }
    }
};
```

## Process Communication

### IPC Message Types

```cpp
enum class MessageType {
    // Navigation
    NAVIGATE_TO_URL,
    NAVIGATION_COMPLETE,
    
    // Rendering
    RENDER_FRAME,
    FRAME_RENDERED,
    
    // AI
    AI_ANALYZE_CONTENT,
    AI_RESULT_READY,
    
    // Input
    INPUT_EVENT,
    
    // Resource
    LOAD_RESOURCE,
    RESOURCE_LOADED,
    
    // Lifecycle
    PROCESS_READY,
    PROCESS_TERMINATED,
};

struct IPCMessage {
    MessageType type;
    int sender_process_id;
    int recipient_process_id;
    std::string payload;
    uint64_t timestamp;
};
```

### Message Routing

```
Main Process
     │
     ├─→ Renderer 1 (tab 1)
     ├─→ Renderer 2 (tab 2)
     ├─→ GPU Process
     └─→ AI Process

Message: "Analyze this page"
Main → Renderer (get content) → Main → AI → Main → Renderer (show results)
```

## Resource Management

### Memory Limits

```cpp
constexpr size_t RENDERER_MEMORY_LIMIT = 512 * 1024 * 1024;  // 512 MB
constexpr size_t GPU_MEMORY_LIMIT = 1024 * 1024 * 1024;       // 1 GB
constexpr size_t AI_MEMORY_LIMIT = 2048 * 1024 * 1024;        // 2 GB
constexpr size_t MAIN_MEMORY_LIMIT = 1024 * 1024 * 1024;      // 1 GB

class ResourceLimiter {
public:
    bool CheckMemoryLimit(int process_id) {
        size_t current = GetMemoryUsage(process_id);
        size_t limit = GetMemoryLimit(GetProcessType(process_id));
        
        if (current > limit * 0.9) {
            // Approaching limit - trigger GC
            RequestGarbageCollection(process_id);
        }
        
        if (current > limit) {
            // Exceeded limit - terminate process
            TerminateProcess(process_id);
            return false;
        }
        
        return true;
    }
};
```

### Process Pool

```cpp
class ProcessPool {
public:
    // Pre-create processes for fast tab opening
    void WarmupPool(int count) {
        for (int i = 0; i < count; ++i) {
            int pid = CreateProcess(ProcessType::RENDERER, {});
            idle_renderers_.push(pid);
        }
    }
    
    int AcquireRenderer() {
        if (idle_renderers_.empty()) {
            return CreateProcess(ProcessType::RENDERER, {});
        }
        
        int pid = idle_renderers_.front();
        idle_renderers_.pop();
        return pid;
    }
    
    void ReleaseRenderer(int pid) {
        ResetProcessState(pid);
        idle_renderers_.push(pid);
    }
    
private:
    std::queue<int> idle_renderers_;
};
```

## Crash Recovery

### Automatic Recovery

```cpp
class CrashRecovery {
public:
    void HandleProcessCrash(int pid, ProcessType type) {
        // Log crash information
        CrashReport report = GenerateCrashReport(pid);
        SubmitCrashReport(report);
        
        // Recover based on process type
        switch (type) {
            case ProcessType::RENDERER:
                RecoverRendererCrash(pid);
                break;
            case ProcessType::GPU:
                RecoverGPUCrash(pid);
                break;
            case ProcessType::AI:
                RecoverAICrash(pid);
                break;
            default:
                // Main process crash - restart application
                RestartApplication();
        }
    }
    
private:
    void RecoverRendererCrash(int pid) {
        // Get associated tab
        int tab_id = GetTabForProcess(pid);
        
        // Show crash page
        ShowSadTab(tab_id);
        
        // User can reload to recover
        EnableTabReload(tab_id);
    }
};
```

## Performance Optimization

### Process Affinity

```cpp
class ProcessScheduler {
public:
    void OptimizeProcessPlacement() {
        // Pin GPU process to high-performance cores
        SetProcessAffinity(gpu_process_id_, HIGH_PERFORMANCE_CORES);
        
        // Pin AI process to separate cores
        SetProcessAffinity(ai_process_id_, AI_CORES);
        
        // Distribute renderers across remaining cores
        DistributeRenderers();
    }
    
private:
    std::vector<int> HIGH_PERFORMANCE_CORES = {0, 1, 2, 3};
    std::vector<int> AI_CORES = {4, 5, 6, 7};
};
```

### Priority Management

```cpp
enum class ProcessPriority {
    CRITICAL,    // Main process
    HIGH,        // Active tab renderer, GPU
    NORMAL,      // Background tab renderers
    LOW,         // Utility processes
    BACKGROUND   // AI batch processing
};

void SetProcessPriority(int pid, ProcessPriority priority) {
    // Adjust OS-level priority
    SetOSPriority(pid, ConvertToOSPriority(priority));
    
    // Adjust resource allocation
    AdjustResourceQuota(pid, priority);
}
```

## Security Considerations

### Sandbox Implementation

Each non-privileged process runs in a restricted environment:

```cpp
struct SandboxConfig {
    bool allow_file_read = false;
    bool allow_file_write = false;
    bool allow_network = false;
    bool allow_gpu = false;
    std::vector<std::string> allowed_directories;
    std::vector<std::string> allowed_syscalls;
};

SandboxConfig GetSandboxConfig(ProcessType type) {
    SandboxConfig config;
    
    switch (type) {
        case ProcessType::RENDERER:
            // Most restrictive
            config.allow_file_read = false;
            config.allow_file_write = false;
            config.allow_network = false;
            break;
            
        case ProcessType::GPU:
            // GPU API access only
            config.allow_gpu = true;
            break;
            
        case ProcessType::AI:
            // Model directory read access
            config.allow_file_read = true;
            config.allowed_directories = {"/models"};
            break;
    }
    
    return config;
}
```

## Monitoring and Debugging

### Process Inspector

```cpp
struct ProcessStats {
    int process_id;
    ProcessType type;
    size_t memory_usage;
    double cpu_usage;
    uint64_t uptime_ms;
    int ipc_messages_sent;
    int ipc_messages_received;
};

class ProcessInspector {
public:
    std::vector<ProcessStats> GetAllProcessStats() {
        std::vector<ProcessStats> stats;
        for (auto& [pid, info] : processes_) {
            stats.push_back(CollectStats(pid));
        }
        return stats;
    }
    
    void DumpProcessTree() {
        std::cout << "Process Tree:\n";
        std::cout << "  Main Process (PID: " << main_pid_ << ")\n";
        for (auto& [pid, info] : child_processes_) {
            std::cout << "    ├─ " << ProcessTypeName(info.type) 
                     << " (PID: " << pid << ")\n";
        }
    }
};
```
