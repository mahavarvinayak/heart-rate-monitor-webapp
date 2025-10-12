# AI Integration Specifications

## Table of Contents
1. [Overview](#overview)
2. [AI Models](#ai-models)
3. [Integration Architecture](#integration-architecture)
4. [Python-C++ Bridge](#python-c-bridge)
5. [Model Management](#model-management)
6. [Inference Pipeline](#inference-pipeline)
7. [Performance Optimization](#performance-optimization)

## Overview

Project Nexus integrates AI/ML capabilities through an embedded Python runtime that executes TensorFlow and PyTorch models. The AI features enhance browsing with intelligent content analysis, recommendations, and personalized experiences.

### Key AI Features
- **Content Classification**: Automatic categorization of web pages
- **Entity Recognition**: Extract key information from content
- **Sentiment Analysis**: Understand emotional tone of text
- **Smart Recommendations**: Personalized browsing suggestions
- **Anomaly Detection**: Identify unusual patterns or content
- **Language Detection**: Automatic language identification

## AI Models

### 1. Content Classification Model

**Purpose**: Categorize web pages into topics

**Architecture**: BERT-based text classifier
```python
# Model: content_classifier_v1
# Input: Text (max 512 tokens)
# Output: Category probabilities

Categories = [
    "news", "shopping", "social_media", "research",
    "entertainment", "education", "business", "technology",
    "health", "sports"
]

Model Architecture:
- BERT Embedding (768 dimensions)
- Dropout (0.1)
- Dense Layer (256 units, ReLU)
- Dropout (0.1)
- Dense Layer (10 units, Softmax)
```

**Model File**: `models/content_classifier_v1/model.h5`

**Usage**:
```python
from content_classifier import ContentClassifier

classifier = ContentClassifier('models/content_classifier_v1')
result = classifier.predict(text)
# result: {"category": "news", "confidence": 0.89}
```

### 2. Named Entity Recognition Model

**Purpose**: Extract entities (people, organizations, locations, etc.)

**Architecture**: spaCy NER pipeline
```python
# Model: ner_model_v1
# Input: Text
# Output: List of entities with types and positions

Entity Types = [
    "PERSON", "ORG", "GPE", "LOC", "DATE",
    "TIME", "MONEY", "PERCENT", "PRODUCT"
]
```

**Usage**:
```python
from ner_extractor import NERExtractor

ner = NERExtractor('models/ner_model_v1')
entities = ner.extract(text)
# entities: [
#     {"text": "Google", "type": "ORG", "start": 10, "end": 16},
#     {"text": "California", "type": "GPE", "start": 45, "end": 55}
# ]
```

### 3. Sentiment Analysis Model

**Purpose**: Determine emotional tone of content

**Architecture**: LSTM-based sentiment classifier
```python
# Model: sentiment_analyzer_v1
# Input: Text
# Output: Sentiment scores

Sentiments = {
    "positive": 0.0 - 1.0,
    "negative": 0.0 - 1.0,
    "neutral": 0.0 - 1.0
}
```

**Usage**:
```python
from sentiment_analyzer import SentimentAnalyzer

analyzer = SentimentAnalyzer('models/sentiment_analyzer_v1')
sentiment = analyzer.analyze(text)
# sentiment: {"positive": 0.75, "negative": 0.10, "neutral": 0.15}
```

### 4. Recommendation Engine

**Purpose**: Suggest relevant content based on user behavior

**Architecture**: Collaborative filtering + content-based hybrid
```python
# Model: recommendation_engine_v1
# Input: User profile + browsing history
# Output: Ranked list of recommendations

Features = {
    "user_interests": [embedding],
    "browsing_history": [url_embeddings],
    "time_patterns": [temporal_features],
    "content_features": [page_embeddings]
}
```

## Integration Architecture

### AI Process Architecture

```
┌──────────────────────────────────────────────┐
│           Main Process (C++)                  │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │     AI Orchestrator                     │ │
│  │  - Request queuing                      │ │
│  │  - Result caching                       │ │
│  │  - Error handling                       │ │
│  └──────────┬──────────────────────────────┘ │
└─────────────┼────────────────────────────────┘
              │ IPC
┌─────────────▼────────────────────────────────┐
│          AI Process (C++ + Python)            │
│                                               │
│  ┌──────────────────────────────────────┐   │
│  │   Python Runtime Manager (C++)       │   │
│  │  - Python interpreter lifecycle      │   │
│  │  - GIL management                    │   │
│  │  - Module loading                    │   │
│  └──────────┬───────────────────────────┘   │
│             │                                │
│  ┌──────────▼───────────────────────────┐   │
│  │   Model Manager (Python)             │   │
│  │  - Model loading/unloading           │   │
│  │  - Memory management                 │   │
│  │  - Version control                   │   │
│  └──────────┬───────────────────────────┘   │
│             │                                │
│  ┌──────────▼───────────────────────────┐   │
│  │   Inference Engine (Python)          │   │
│  │  - TensorFlow models                 │   │
│  │  - PyTorch models                    │   │
│  │  - Preprocessing/Postprocessing      │   │
│  └──────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```

## Python-C++ Bridge

### Embedding Python Runtime

```cpp
// python_runtime.h
class PythonRuntime {
public:
    static PythonRuntime& Instance() {
        static PythonRuntime instance;
        return instance;
    }
    
    bool Initialize(const std::string& python_home) {
        // Set Python home
        Py_SetPythonHome(Py_DecodeLocale(python_home.c_str(), nullptr));
        
        // Initialize interpreter
        Py_Initialize();
        
        if (!Py_IsInitialized()) {
            LOG(ERROR) << "Failed to initialize Python";
            return false;
        }
        
        // Setup sys.path
        SetupPythonPath();
        
        // Import required modules
        if (!ImportModules()) {
            return false;
        }
        
        LOG(INFO) << "Python runtime initialized";
        return true;
    }
    
    void Shutdown() {
        if (Py_IsInitialized()) {
            Py_Finalize();
        }
    }
    
    PyObject* CallFunction(const std::string& module_name,
                          const std::string& function_name,
                          PyObject* args) {
        PyGILState_STATE gstate = PyGILState_Ensure();
        
        // Import module
        PyObject* module = PyImport_ImportModule(module_name.c_str());
        if (!module) {
            PyErr_Print();
            PyGILState_Release(gstate);
            return nullptr;
        }
        
        // Get function
        PyObject* func = PyObject_GetAttrString(module, function_name.c_str());
        if (!func || !PyCallable_Check(func)) {
            Py_DECREF(module);
            PyGILState_Release(gstate);
            return nullptr;
        }
        
        // Call function
        PyObject* result = PyObject_CallObject(func, args);
        
        Py_DECREF(func);
        Py_DECREF(module);
        PyGILState_Release(gstate);
        
        return result;
    }
    
private:
    PythonRuntime() = default;
    ~PythonRuntime() { Shutdown(); }
    
    void SetupPythonPath() {
        PyRun_SimpleString(
            "import sys\n"
            "sys.path.append('python')\n"
            "sys.path.append('python/models')\n"
        );
    }
    
    bool ImportModules() {
        const std::vector<std::string> required_modules = {
            "numpy", "tensorflow", "torch", "spacy"
        };
        
        for (const auto& module_name : required_modules) {
            PyObject* module = PyImport_ImportModule(module_name.c_str());
            if (!module) {
                LOG(ERROR) << "Failed to import " << module_name;
                PyErr_Print();
                return false;
            }
            Py_DECREF(module);
        }
        
        return true;
    }
};
```

### Type Conversion Helpers

```cpp
// python_helpers.h
namespace PythonHelpers {

// Convert C++ string to Python string
PyObject* ToPyString(const std::string& str) {
    return PyUnicode_FromString(str.c_str());
}

// Convert Python string to C++ string
std::string FromPyString(PyObject* obj) {
    if (!PyUnicode_Check(obj)) return "";
    const char* str = PyUnicode_AsUTF8(obj);
    return str ? std::string(str) : "";
}

// Convert C++ JSON to Python dict
PyObject* ToPyDict(const nlohmann::json& json) {
    PyObject* dict = PyDict_New();
    
    for (auto& [key, value] : json.items()) {
        PyObject* py_key = ToPyString(key);
        PyObject* py_value = nullptr;
        
        if (value.is_string()) {
            py_value = ToPyString(value.get<std::string>());
        } else if (value.is_number_integer()) {
            py_value = PyLong_FromLong(value.get<int>());
        } else if (value.is_number_float()) {
            py_value = PyFloat_FromDouble(value.get<double>());
        } else if (value.is_boolean()) {
            py_value = PyBool_FromLong(value.get<bool>());
        } else if (value.is_array()) {
            py_value = ToPyList(value);
        } else if (value.is_object()) {
            py_value = ToPyDict(value);
        }
        
        if (py_value) {
            PyDict_SetItem(dict, py_key, py_value);
            Py_DECREF(py_value);
        }
        Py_DECREF(py_key);
    }
    
    return dict;
}

// Convert Python dict to C++ JSON
nlohmann::json FromPyDict(PyObject* dict) {
    nlohmann::json result;
    
    if (!PyDict_Check(dict)) return result;
    
    PyObject *key, *value;
    Py_ssize_t pos = 0;
    
    while (PyDict_Next(dict, &pos, &key, &value)) {
        std::string key_str = FromPyString(key);
        
        if (PyUnicode_Check(value)) {
            result[key_str] = FromPyString(value);
        } else if (PyLong_Check(value)) {
            result[key_str] = PyLong_AsLong(value);
        } else if (PyFloat_Check(value)) {
            result[key_str] = PyFloat_AsDouble(value);
        } else if (PyBool_Check(value)) {
            result[key_str] = (value == Py_True);
        } else if (PyList_Check(value)) {
            result[key_str] = FromPyList(value);
        } else if (PyDict_Check(value)) {
            result[key_str] = FromPyDict(value);
        }
    }
    
    return result;
}

} // namespace PythonHelpers
```

## Model Management

### Model Manager Implementation

```python
# model_manager.py
import os
import json
import logging
from typing import Dict, Any, Optional
import tensorflow as tf
import torch

class ModelManager:
    """Manages loading and lifecycle of AI models"""
    
    def __init__(self, models_dir: str):
        self.models_dir = models_dir
        self.loaded_models: Dict[str, Any] = {}
        self.model_metadata: Dict[str, dict] = {}
        self.logger = logging.getLogger(__name__)
        
        # Load model registry
        self._load_model_registry()
    
    def _load_model_registry(self):
        """Load model metadata from registry"""
        registry_path = os.path.join(self.models_dir, 'registry.json')
        if os.path.exists(registry_path):
            with open(registry_path, 'r') as f:
                self.model_metadata = json.load(f)
    
    def load_model(self, model_id: str) -> bool:
        """Load a model into memory"""
        if model_id in self.loaded_models:
            self.logger.info(f"Model {model_id} already loaded")
            return True
        
        metadata = self.model_metadata.get(model_id)
        if not metadata:
            self.logger.error(f"Model {model_id} not found in registry")
            return False
        
        model_path = os.path.join(self.models_dir, model_id)
        
        try:
            if metadata['framework'] == 'tensorflow':
                model = tf.keras.models.load_model(model_path)
            elif metadata['framework'] == 'pytorch':
                model = torch.load(model_path)
                model.eval()
            else:
                self.logger.error(f"Unsupported framework: {metadata['framework']}")
                return False
            
            self.loaded_models[model_id] = model
            self.logger.info(f"Loaded model {model_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to load model {model_id}: {e}")
            return False
    
    def unload_model(self, model_id: str):
        """Unload a model from memory"""
        if model_id in self.loaded_models:
            del self.loaded_models[model_id]
            
            # Force garbage collection
            import gc
            gc.collect()
            
            self.logger.info(f"Unloaded model {model_id}")
    
    def get_model(self, model_id: str) -> Optional[Any]:
        """Get a loaded model"""
        return self.loaded_models.get(model_id)
    
    def is_loaded(self, model_id: str) -> bool:
        """Check if model is loaded"""
        return model_id in self.loaded_models
    
    def list_available(self) -> list:
        """List all available models"""
        return list(self.model_metadata.keys())
    
    def get_metadata(self, model_id: str) -> dict:
        """Get model metadata"""
        return self.model_metadata.get(model_id, {})
    
    def get_memory_usage(self) -> dict:
        """Get memory usage statistics"""
        import sys
        total_size = sum(sys.getsizeof(model) for model in self.loaded_models.values())
        
        return {
            'loaded_models': len(self.loaded_models),
            'total_memory_mb': total_size / (1024 * 1024)
        }
```

### Model Registry

```json
{
  "content_classifier_v1": {
    "name": "Content Classifier",
    "version": "1.0.0",
    "framework": "tensorflow",
    "input_shape": [512],
    "output_shape": [10],
    "model_size_mb": 150,
    "priority": "high",
    "warmup": true
  },
  "ner_model_v1": {
    "name": "Named Entity Recognition",
    "version": "1.0.0",
    "framework": "spacy",
    "language": "en",
    "model_size_mb": 50,
    "priority": "medium",
    "warmup": false
  },
  "sentiment_analyzer_v1": {
    "name": "Sentiment Analyzer",
    "version": "1.0.0",
    "framework": "pytorch",
    "input_shape": [256],
    "output_shape": [3],
    "model_size_mb": 80,
    "priority": "low",
    "warmup": false
  }
}
```

## Inference Pipeline

### Inference Engine

```python
# inference_engine.py
import numpy as np
from typing import Any, Dict, List, Callable

class InferenceEngine:
    """Handles model inference operations"""
    
    def __init__(self, model_manager):
        self.model_manager = model_manager
        self.preprocessors: Dict[str, Callable] = {}
        self.postprocessors: Dict[str, Callable] = {}
    
    def register_preprocessor(self, model_id: str, func: Callable):
        """Register preprocessing function"""
        self.preprocessors[model_id] = func
    
    def register_postprocessor(self, model_id: str, func: Callable):
        """Register postprocessing function"""
        self.postprocessors[model_id] = func
    
    def infer(self, model_id: str, input_data: Any) -> Dict[str, Any]:
        """Run inference"""
        # Ensure model is loaded
        if not self.model_manager.is_loaded(model_id):
            if not self.model_manager.load_model(model_id):
                raise RuntimeError(f"Failed to load model: {model_id}")
        
        model = self.model_manager.get_model(model_id)
        metadata = self.model_manager.get_metadata(model_id)
        
        # Preprocessing
        if model_id in self.preprocessors:
            input_data = self.preprocessors[model_id](input_data)
        
        # Inference
        if metadata['framework'] == 'tensorflow':
            output = model.predict(input_data, verbose=0)
        elif metadata['framework'] == 'pytorch':
            import torch
            with torch.no_grad():
                input_tensor = torch.tensor(input_data, dtype=torch.float32)
                output = model(input_tensor).numpy()
        else:
            raise ValueError(f"Unsupported framework: {metadata['framework']}")
        
        # Postprocessing
        if model_id in self.postprocessors:
            output = self.postprocessors[model_id](output)
        
        return output
    
    def batch_infer(self, model_id: str, inputs: List[Any]) -> List[Dict[str, Any]]:
        """Run batch inference"""
        # Batch preprocessing
        if model_id in self.preprocessors:
            inputs = [self.preprocessors[model_id](x) for x in inputs]
        
        # Stack inputs
        batched_input = np.array(inputs)
        
        # Run inference
        model = self.model_manager.get_model(model_id)
        metadata = self.model_manager.get_metadata(model_id)
        
        if metadata['framework'] == 'tensorflow':
            outputs = model.predict(batched_input, verbose=0)
        elif metadata['framework'] == 'pytorch':
            import torch
            with torch.no_grad():
                input_tensor = torch.tensor(batched_input, dtype=torch.float32)
                outputs = model(input_tensor).numpy()
        
        # Batch postprocessing
        if model_id in self.postprocessors:
            outputs = [self.postprocessors[model_id](x) for x in outputs]
        
        return outputs
```

### Content Analyzer

```python
# content_analyzer.py
from typing import Dict, List
import numpy as np

class ContentAnalyzer:
    """High-level content analysis interface"""
    
    def __init__(self, inference_engine):
        self.inference_engine = inference_engine
        self._setup_preprocessors()
    
    def _setup_preprocessors(self):
        """Setup preprocessing functions"""
        from transformers import AutoTokenizer
        
        self.tokenizer = AutoTokenizer.from_pretrained('bert-base-uncased')
        
        def preprocess_text(text: str) -> np.ndarray:
            tokens = self.tokenizer.encode(
                text,
                max_length=512,
                padding='max_length',
                truncation=True
            )
            return np.array([tokens])
        
        self.inference_engine.register_preprocessor(
            'content_classifier_v1',
            preprocess_text
        )
    
    def analyze(self, url: str, content: str) -> Dict:
        """Analyze web page content"""
        results = {}
        
        # Content classification
        category_result = self.inference_engine.infer(
            'content_classifier_v1',
            content
        )
        results['category'] = category_result
        
        # Named entity recognition
        entities = self.inference_engine.infer(
            'ner_model_v1',
            content
        )
        results['entities'] = entities
        
        # Sentiment analysis
        sentiment = self.inference_engine.infer(
            'sentiment_analyzer_v1',
            content
        )
        results['sentiment'] = sentiment
        
        # Aggregate results
        return {
            'url': url,
            'analysis': results,
            'timestamp': self._get_timestamp()
        }
    
    def _get_timestamp(self) -> int:
        import time
        return int(time.time())
```

## Performance Optimization

### Model Caching Strategy

```python
# model_cache.py
from collections import OrderedDict
import time

class ModelCache:
    """LRU cache for models with memory management"""
    
    def __init__(self, max_size_mb: int = 2048):
        self.max_size_mb = max_size_mb
        self.cache = OrderedDict()
        self.access_times = {}
        self.model_sizes = {}
    
    def get(self, model_id: str):
        """Get model from cache"""
        if model_id in self.cache:
            # Move to end (most recently used)
            self.cache.move_to_end(model_id)
            self.access_times[model_id] = time.time()
            return self.cache[model_id]
        return None
    
    def put(self, model_id: str, model: Any, size_mb: float):
        """Add model to cache"""
        # Evict if necessary
        while self._get_total_size() + size_mb > self.max_size_mb:
            if not self.cache:
                break
            self._evict_lru()
        
        self.cache[model_id] = model
        self.model_sizes[model_id] = size_mb
        self.access_times[model_id] = time.time()
    
    def _evict_lru(self):
        """Evict least recently used model"""
        model_id, _ = self.cache.popitem(last=False)
        del self.model_sizes[model_id]
        del self.access_times[model_id]
    
    def _get_total_size(self) -> float:
        """Get total cache size"""
        return sum(self.model_sizes.values())
```

### Batch Processing

```cpp
// batch_processor.h
class BatchProcessor {
public:
    void QueueRequest(const AIRequest& request) {
        std::lock_guard<std::mutex> lock(mutex_);
        pending_requests_.push_back(request);
        
        if (pending_requests_.size() >= BATCH_SIZE) {
            ProcessBatch();
        } else if (!batch_timer_active_) {
            StartBatchTimer();
        }
    }
    
private:
    static constexpr size_t BATCH_SIZE = 8;
    static constexpr int BATCH_TIMEOUT_MS = 50;
    
    std::vector<AIRequest> pending_requests_;
    std::mutex mutex_;
    bool batch_timer_active_ = false;
    
    void ProcessBatch() {
        if (pending_requests_.empty()) return;
        
        // Group by model type
        std::map<std::string, std::vector<AIRequest>> batches;
        for (const auto& req : pending_requests_) {
            batches[req.model_id].push_back(req);
        }
        
        // Process each batch
        for (auto& [model_id, requests] : batches) {
            ProcessModelBatch(model_id, requests);
        }
        
        pending_requests_.clear();
    }
};
```

### GPU Acceleration

```python
# gpu_inference.py
import tensorflow as tf

class GPUInferenceEngine:
    """GPU-accelerated inference"""
    
    def __init__(self):
        # Configure GPU
        gpus = tf.config.list_physical_devices('GPU')
        if gpus:
            try:
                # Enable memory growth
                for gpu in gpus:
                    tf.config.experimental.set_memory_growth(gpu, True)
                
                # Set visible GPUs
                tf.config.set_visible_devices(gpus[0], 'GPU')
                
                self.gpu_available = True
            except RuntimeError as e:
                print(f"GPU configuration error: {e}")
                self.gpu_available = False
        else:
            self.gpu_available = False
    
    def infer(self, model, input_data):
        """Run inference on GPU if available"""
        if self.gpu_available:
            with tf.device('/GPU:0'):
                return model.predict(input_data)
        else:
            return model.predict(input_data)
```
