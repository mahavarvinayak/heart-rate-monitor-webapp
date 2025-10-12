# Architectural Diagrams

This document contains ASCII diagrams illustrating the Project Nexus architecture.

## 1. System Architecture Diagram

### High-Level System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEXUS BROWSER ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Tab Bar    │  │  Address Bar │  │  Bookmarks   │  │   Settings   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Web Content View                              │  │
│  │                     (Rendered Web Pages)                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ AI Insights  │  │  Developer   │  │  Extensions  │  │   Downloads  │   │
│  │    Panel     │  │    Tools     │  │    Panel     │  │    Manager   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MAIN PROCESS (Browser)                             │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                       Browser Manager                                 │  │
│  │  - Window Management    - Tab Management    - Session Management     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Extension  │  │   Settings   │  │      AI      │  │   Database   │   │
│  │   Manager   │  │   Manager    │  │ Orchestrator │  │   Manager    │   │
│  └─────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      IPC Message Router                               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                           │              │              │
                    ┌──────┴──────┐ ┌────┴─────┐ ┌─────┴──────┐
                    ↓             ↓             ↓              ↓
┌──────────────────────┐ ┌────────────────┐ ┌─────────────┐ ┌────────────────┐
│  RENDERER PROCESS    │ │  GPU PROCESS   │ │ AI PROCESS  │ │ UTILITY        │
│                      │ │                │ │             │ │ PROCESSES      │
│ ┌──────────────────┐ │ │ ┌────────────┐ │ │ ┌─────────┐ │ │ ┌────────────┐ │
│ │  Blink Engine    │ │ │ │  Graphics  │ │ │ │ Python  │ │ │ │  Network   │ │
│ │  (Rendering)     │ │ │ │  Context   │ │ │ │ Runtime │ │ │ │  Service   │ │
│ └──────────────────┘ │ │ └────────────┘ │ │ └─────────┘ │ │ └────────────┘ │
│ ┌──────────────────┐ │ │ ┌────────────┐ │ │ ┌─────────┐ │ │ ┌────────────┐ │
│ │   V8 Engine      │ │ │ │    Skia    │ │ │ │   ML    │ │ │ │  Storage   │ │
│ │  (JavaScript)    │ │ │ │  Graphics  │ │ │ │  Models │ │ │ │  Service   │ │
│ └──────────────────┘ │ │ └────────────┘ │ │ └─────────┘ │ │ └────────────┘ │
│ ┌──────────────────┐ │ │ ┌────────────┐ │ │ ┌─────────┐ │ │ ┌────────────┐ │
│ │  DOM/CSSOM       │ │ │ │ Compositor │ │ │ │Inference│ │ │ │   Audio    │ │
│ └──────────────────┘ │ │ └────────────┘ │ │ │ Engine  │ │ │ │  Service   │ │
│                      │ │                │ │ └─────────┘ │ │ └────────────┘ │
│  SANDBOXED ✓         │ │  SANDBOXED ✓   │ │SANDBOXED ✓  │ │  SANDBOXED ✓   │
└──────────────────────┘ └────────────────┘ └─────────────┘ └────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │    SQLite    │  │     Cache    │  │  IndexedDB   │  │  File System │   │
│  │   Database   │  │    Storage   │  │              │  │   (Downloads)│   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Process Model Diagram

### Multi-Process Architecture

```
                       ┌─────────────────────────────┐
                       │     MAIN PROCESS            │
                       │  (Browser Process)          │
                       │                             │
                       │  - Full System Access       │
                       │  - Process Coordinator      │
                       │  - Resource Manager         │
                       │  - IPC Hub                  │
                       └──────────┬──────────────────┘
                                  │
                    ┌─────────────┼─────────────┬────────────┐
                    │             │             │            │
        ┌───────────▼────┐  ┌────▼─────┐  ┌───▼──────┐  ┌─▼─────────┐
        │  RENDERER 1    │  │ RENDERER │  │   GPU    │  │    AI     │
        │   (Tab 1)      │  │    2     │  │ PROCESS  │  │  PROCESS  │
        │                │  │ (Tab 2)  │  │          │  │           │
        │  - Sandboxed   │  │          │  │          │  │           │
        │  - No FS Access│  │          │  │          │  │           │
        │  - IPC Only    │  │          │  │          │  │           │
        └────────────────┘  └──────────┘  └──────────┘  └───────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                          PROCESS LIFECYCLE                                │
└──────────────────────────────────────────────────────────────────────────┘

   User Opens Tab              Page Loads              Tab Closes
        │                           │                       │
        ▼                           ▼                       ▼
   ┌─────────┐               ┌─────────┐              ┌─────────┐
   │ Create  │──────────────▶│ Active  │─────────────▶│Terminate│
   │Renderer │               │Rendering│              │ Process │
   └─────────┘               └─────────┘              └─────────┘
        │                           │                       │
        │                           │                       │
   [Allocate PID]           [Render Pages]          [Cleanup Resources]
   [Setup IPC]              [Execute JS]            [Free Memory]
   [Initialize Sandbox]     [Handle Events]         [Close IPC]


┌──────────────────────────────────────────────────────────────────────────┐
│                       PROCESS ISOLATION                                   │
└──────────────────────────────────────────────────────────────────────────┘

    Renderer Process              Main Process           AI Process
    ┌──────────────┐             ┌──────────┐          ┌──────────┐
    │              │             │          │          │          │
    │   SANDBOX    │◄───IPC─────▶│   Hub    │◄──IPC──▶│ SANDBOX  │
    │              │             │          │          │          │
    │ ✗ File I/O   │             │ ✓ All    │          │ ✓ Models │
    │ ✗ Network    │             │   Access │          │ ✗ Network│
    │ ✗ System API │             │          │          │ ✗ Write  │
    └──────────────┘             └──────────┘          └──────────┘
```

## 3. IPC Flow Diagram

### Message Flow Patterns

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    REQUEST-RESPONSE PATTERN                               │
└──────────────────────────────────────────────────────────────────────────┘

Renderer Process              Main Process                AI Process
     │                             │                           │
     │──(1) AI Analysis Request───▶│                           │
     │    [URL, Content]            │                           │
     │                             │──(2) Forward Request──────▶│
     │                             │    [Processed Data]        │
     │                             │                           │
     │                             │                      (3) Inference
     │                             │                           │
     │                             │◄──(4) Results─────────────│
     │                             │    [Category, Score]       │
     │◄──(5) Response──────────────│                           │
     │    [Formatted Results]      │                           │
     │                             │                           │
     └──(6) Update UI───────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────┐
│                      PUBLISH-SUBSCRIBE PATTERN                            │
└──────────────────────────────────────────────────────────────────────────┘

              Main Process (Event Bus)
                     │
         ┌───────────┼───────────┬───────────┐
         │           │           │           │
    ┌────▼───┐  ┌───▼────┐  ┌──▼─────┐ ┌───▼────┐
    │Renderer│  │Renderer│  │  GPU   │ │   AI   │
    │   1    │  │   2    │  │Process │ │Process │
    └────────┘  └────────┘  └────────┘ └────────┘
         │           │           │           │
         └───────────┴───────────┴───────────┘
                     │
            Event: "bookmark_added"
                {url, title, folder}
            
            All subscribers notified


┌──────────────────────────────────────────────────────────────────────────┐
│                       STREAMING PATTERN                                   │
└──────────────────────────────────────────────────────────────────────────┘

Renderer                Main Process            AI Process
   │                          │                      │
   │─(1) Start Stream────────▶│                      │
   │    [stream_id]           │─(2) Init─────────────▶│
   │                          │                      │
   │                          │◄(3) Data Chunk 1─────│
   │◄(4) Update UI────────────│                      │
   │                          │                      │
   │                          │◄(5) Data Chunk 2─────│
   │◄(6) Update UI────────────│                      │
   │                          │                      │
   │                          │◄(7) End Stream───────│
   │◄(8) Complete─────────────│                      │
   │                          │                      │
```

## 4. Component Interaction Diagram

### Main Process Components

```
┌──────────────────────────────────────────────────────────────────────┐
│                        MAIN PROCESS                                   │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     Browser Manager                            │ │
│  │                                                                │ │
│  │  createBrowser() │ createTab() │ closeTab() │ switchTab()     │ │
│  └───────┬──────────────────┬───────────────┬────────────────────┘ │
│          │                  │               │                       │
│  ┌───────▼──────┐  ┌────────▼──────┐  ┌────▼──────────────┐       │
│  │   Process    │  │   Extension   │  │    Settings       │       │
│  │   Manager    │  │   Manager     │  │    Manager        │       │
│  └───────┬──────┘  └────────┬──────┘  └────┬──────────────┘       │
│          │                   │              │                       │
│  ┌───────▼───────────────────▼──────────────▼──────────────┐       │
│  │                  Event Bus                               │       │
│  └───────┬──────────────────────────────────────────────────┘       │
│          │                                                           │
│  ┌───────▼──────┐         ┌──────────────────┐                     │
│  │   Database   │         │       AI         │                     │
│  │   Manager    │         │   Orchestrator   │                     │
│  └──────────────┘         └──────────────────┘                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Flow for Page Loading

```
┌─────────────────────────────────────────────────────────────────────┐
│               PAGE LOAD AND ANALYSIS FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

(1) User enters URL
         │
         ▼
    [Browser Manager]
         │
         │ (2) Create/Select Tab
         ▼
    [Process Manager]
         │
         │ (3) Spawn Renderer
         ▼
  [Renderer Process]
         │
         │ (4) Load URL
         ├────────────┐
         │            │
         ▼            ▼
    [Network]    [Parse HTML]
         │            │
         │ (5) Resources
         ▼            ▼
    [Cache]      [Build DOM]
                      │
                      │ (6) Render
                      ▼
                 [GPU Process] ────┐
                      │            │
                      │ (7) Display
                      ▼            │
                 [Screen]          │
                                   │
    ┌──────────────────────────────┘
    │
    │ (8) Page Ready
    ▼
[Content Extractor]
    │
    │ (9) Extract Text/Metadata
    ▼
[IPC to Main Process]
    │
    │ (10) Analyze Request
    ▼
[AI Orchestrator]
    │
    │ (11) Forward to AI
    ▼
[AI Process]
    │
    │ (12) Inference
    ├─────────────┐
    │             │
    ▼             ▼
[Classification] [NER]
    │             │
    │ (13) Results
    └──────┬──────┘
           ▼
   [AI Orchestrator]
           │
           │ (14) Store Insights
           ▼
   [Database Manager]
           │
           │ (15) Send to Renderer
           ▼
   [Renderer Process]
           │
           │ (16) Update UI
           ▼
    [Display Insights]
```

## 5. AI Integration Architecture

### AI Processing Pipeline

```
┌──────────────────────────────────────────────────────────────────────┐
│                    AI PROCESSING PIPELINE                             │
└──────────────────────────────────────────────────────────────────────┘

┌────────────┐
│  Web Page  │
│  Content   │
└──────┬─────┘
       │
       ▼
┌─────────────────┐
│ Content         │
│ Extractor       │
│                 │
│ - Title         │
│ - Body Text     │
│ - Metadata      │
│ - Links/Images  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Preprocessor    │
│                 │
│ - Tokenization  │
│ - Normalization │
│ - Feature Eng.  │
└────────┬────────┘
         │
         ├──────────────┬──────────────┬──────────────┐
         │              │              │              │
         ▼              ▼              ▼              ▼
┌────────────┐  ┌──────────────┐  ┌─────────┐  ┌─────────┐
│ Content    │  │    Named     │  │Sentiment│  │ Language│
│Classification│ │   Entity     │  │Analysis │  │Detection│
│            │  │  Recognition │  │         │  │         │
│ [TF Model] │  │ [PyTorch]    │  │[NLTK]   │  │[spaCy]  │
└──────┬─────┘  └──────┬───────┘  └────┬────┘  └────┬────┘
       │                │               │            │
       └────────────────┴───────────────┴────────────┘
                        │
                        ▼
                ┌───────────────┐
                │  Aggregator   │
                │               │
                │  - Combine    │
                │  - Weight     │
                │  - Format     │
                └───────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │   Results     │
                │               │
                │  {            │
                │   category,   │
                │   entities,   │
                │   sentiment,  │
                │   language    │
                │  }            │
                └───────────────┘
```

### Model Loading Strategy

```
┌──────────────────────────────────────────────────────────────────────┐
│                    MODEL LOADING STRATEGY                             │
└──────────────────────────────────────────────────────────────────────┘

Application Start
      │
      ▼
┌─────────────┐
│ Load Core   │  ← Essential models (content classification)
│ Models      │    Loaded immediately
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Warm Cache  │  ← Frequently used models
│             │    Pre-loaded in background
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ On-Demand   │  ← Specialized models
│ Loading     │    Loaded when needed
└─────────────┘

Memory Management:
┌────────────────────────────────────────────────┐
│ Model Cache (2GB Limit)                        │
│                                                │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │  Core    │ │ Frequent │ │On-Demand │       │
│ │ Models   │ │  Models  │ │  Models  │       │
│ │ (Pinned) │ │  (LRU)   │ │  (LRU)   │       │
│ └──────────┘ └──────────┘ └──────────┘       │
│                                                │
│ When limit reached: Evict LRU models           │
└────────────────────────────────────────────────┘
```

## 6. Security Architecture

### Sandbox Model

```
┌──────────────────────────────────────────────────────────────────────┐
│                        SECURITY LAYERS                                │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    MAIN PROCESS (Privileged)                         │
│                                                                      │
│  ✓ File System Access        ✓ Network Access                      │
│  ✓ System APIs               ✓ Database Access                     │
│  ✓ Create Processes          ✓ User Data Access                    │
└─────────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  RENDERER    │    │     GPU      │    │      AI      │
│  (Sandboxed) │    │  (Sandboxed) │    │  (Sandboxed) │
│              │    │              │    │              │
│ ✗ File I/O   │    │ ✗ File I/O   │    │ ✓ Model Read │
│ ✗ Network    │    │ ✗ Network    │    │ ✗ Network    │
│ ✗ System API │    │ ✓ GPU API    │    │ ✗ System API │
│ ✓ IPC Only   │    │ ✓ IPC Only   │    │ ✓ IPC Only   │
└──────────────┘    └──────────────┘    └──────────────┘

Security Boundaries:
═══════════════════
│ ═ Process Boundary (Strict Isolation)
│ ─ IPC Channel (Validated Communication)
│ ✓ Allowed Operation
│ ✗ Blocked Operation
```

### Permission Model

```
┌──────────────────────────────────────────────────────────────────────┐
│                      PERMISSION HIERARCHY                             │
└──────────────────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │   SYSTEM     │  (Level 0)
                    │  FULL ACCESS │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │     MAIN     │  (Level 1)
                    │   PROCESS    │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌─────▼──────┐ ┌──────▼──────┐
    │  RENDERER   │ │    GPU     │ │     AI      │  (Level 2)
    │  (Limited)  │ │  (Limited) │ │  (Limited)  │
    └─────────────┘ └────────────┘ └─────────────┘

Permission Check Flow:
─────────────────────
Operation Request
       │
       ▼
[Permission Check]
       │
       ├─ Allowed? ──Yes──▶ [Execute]
       │
       └─ No ──▶ [Reject] ──▶ [Log Security Event]
```

## 7. Build System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    BUILD SYSTEM STRUCTURE                             │
└──────────────────────────────────────────────────────────────────────┘

project_root/
│
├─ CMakeLists.txt ────────┐
│                         │
├─ src/                   │
│  ├─ main.cpp            │
│  ├─ browser/            │
│  │  └─ CMakeLists.txt ──┼─ Add to Build
│  ├─ ai/                 │
│  │  └─ CMakeLists.txt ──┼─ Add to Build
│  └─ ui/                 │
│     └─ CMakeLists.txt ──┼─ Add to Build
│                         │
├─ include/               │
│  ├─ browser/            │
│  ├─ ai/                 │
│  └─ ui/                 │
│                         │
├─ third_party/           │
│  ├─ cef/                │
│  ├─ sqlite/             │
│  └─ python/             │
│                         │
├─ resources/             │
│  ├─ icons/              │
│  ├─ ui/                 │
│  └─ models/             │
│                         │
└─ build/ ◄───────────────┘
   ├─ bin/
   │  └─ nexus_browser
   ├─ lib/
   └─ resources/

Build Process:
─────────────
CMake Configure → Generate Build Files → Compile → Link → Package
      │                  │                  │        │        │
      ▼                  ▼                  ▼        ▼        ▼
  [Config]         [Makefiles/         [.o/.obj]  [.exe/  [Installer]
  [Options]         VS Projects]        [files]    .app]
```

## 8. Deployment Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                  CROSS-PLATFORM DEPLOYMENT                            │
└──────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                         Windows                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  nexus_browser.exe                                           │ │
│  │  ├─ CEF Runtime (libcef.dll)                                 │ │
│  │  ├─ Resources (nexus.pak)                                    │ │
│  │  ├─ Python Runtime (python310.dll)                           │ │
│  │  └─ AI Models                                                │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  Installation: MSI Installer / MSIX Package                        │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                          macOS                                      │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Nexus.app/                                                  │ │
│  │  ├─ Contents/                                                │ │
│  │  │  ├─ MacOS/nexus_browser                                   │ │
│  │  │  ├─ Frameworks/ (CEF Framework)                           │ │
│  │  │  ├─ Resources/                                            │ │
│  │  │  └─ Python/                                               │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  Installation: DMG / App Store                                     │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                          Linux                                      │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  /opt/nexus/                                                 │ │
│  │  ├─ nexus_browser                                            │ │
│  │  ├─ lib/ (CEF libraries)                                     │ │
│  │  ├─ resources/                                               │ │
│  │  └─ python/                                                  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  Installation: .deb / .rpm / AppImage / Snap                       │
└────────────────────────────────────────────────────────────────────┘
```

## Legend

```
┌─────────────────────────────────────────────────────────────────┐
│                          DIAGRAM LEGEND                          │
├─────────────────────────────────────────────────────────────────┤
│  │  →  ▶  ▼  ◄        Flow direction                          │
│  ┌──┐  └──┘           Box (Component/Process)                  │
│  ═══                  Strong boundary (Security/Process)        │
│  ───                  Connection/Communication                  │
│  ✓                    Allowed/Enabled                           │
│  ✗                    Blocked/Disabled                          │
│  IPC                  Inter-Process Communication               │
│  [Component]          Named component or service                │
└─────────────────────────────────────────────────────────────────┘
```
