# Build System and CMake Configuration

## Table of Contents
1. [Overview](#overview)
2. [CMake Project Structure](#cmake-project-structure)
3. [Build Configuration](#build-configuration)
4. [Dependencies Management](#dependencies-management)
5. [Platform-Specific Builds](#platform-specific-builds)
6. [Build Targets](#build-targets)

## Overview

Project Nexus uses CMake as its build system to ensure cross-platform compatibility and modern C++ build practices. The build system is designed to handle complex dependencies including CEF, Python runtime, and various third-party libraries.

### Build System Features
- Cross-platform support (Windows, macOS, Linux)
- Modern CMake (3.20+) with target-based configuration
- Automatic dependency resolution
- Multiple build configurations
- Integrated testing support
- Package generation

## CMake Project Structure

### Root CMakeLists.txt

```cmake
cmake_minimum_required(VERSION 3.20)

# Project definition
project(NexusBrowser 
    VERSION 0.1.0
    DESCRIPTION "AI-Powered Chromium Browser"
    LANGUAGES CXX
)

# C++ Standard
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Build options
option(BUILD_TESTS "Build unit tests" ON)
option(BUILD_DOCS "Build documentation" OFF)
option(ENABLE_AI "Enable AI features" ON)
option(USE_ASAN "Enable Address Sanitizer" OFF)
option(USE_TSAN "Enable Thread Sanitizer" OFF)
option(ENABLE_LTO "Enable Link Time Optimization" ON)

# Build type
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE "Release" CACHE STRING "Build type" FORCE)
endif()

# Output directories
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)

# Include directories
include_directories(
    ${CMAKE_SOURCE_DIR}/include
    ${CMAKE_BINARY_DIR}/generated
)

# Compiler flags
include(cmake/CompilerFlags.cmake)

# Find dependencies
include(cmake/Dependencies.cmake)

# Subdirectories
add_subdirectory(src)
add_subdirectory(resources)

if(BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()

if(BUILD_DOCS)
    add_subdirectory(docs)
endif()

# Installation
include(cmake/Install.cmake)

# Package generation
include(cmake/Package.cmake)

# Print build configuration
include(cmake/PrintConfig.cmake)
```

### cmake/Dependencies.cmake

```cmake
# Find CEF (Chromium Embedded Framework)
find_package(CEF REQUIRED)

if(CEF_FOUND)
    message(STATUS "Found CEF: ${CEF_VERSION}")
    include_directories(${CEF_INCLUDE_DIR})
    
    # Add CEF helper executables
    if(OS_LINUX)
        add_subdirectory(${CEF_LIBCEF_DLL_WRAPPER_PATH} libcef_dll_wrapper)
    endif()
endif()

# Find SQLite3
find_package(SQLite3 REQUIRED)
if(SQLite3_FOUND)
    message(STATUS "Found SQLite3: ${SQLite3_VERSION}")
endif()

# Find Python
find_package(Python3 REQUIRED 
    COMPONENTS Interpreter Development
)
if(Python3_FOUND)
    message(STATUS "Found Python3: ${Python3_VERSION}")
    include_directories(${Python3_INCLUDE_DIRS})
endif()

# Find OpenGL (for GPU process)
if(NOT APPLE)
    find_package(OpenGL REQUIRED)
endif()

# Find Threads
find_package(Threads REQUIRED)

# Third-party libraries via FetchContent
include(FetchContent)

# nlohmann/json
FetchContent_Declare(
    json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.2
)
FetchContent_MakeAvailable(json)

# spdlog
FetchContent_Declare(
    spdlog
    GIT_REPOSITORY https://github.com/gabime/spdlog.git
    GIT_TAG v1.12.0
)
FetchContent_MakeAvailable(spdlog)

# fmt
FetchContent_Declare(
    fmt
    GIT_REPOSITORY https://github.com/fmtlib/fmt.git
    GIT_TAG 10.1.1
)
FetchContent_MakeAvailable(fmt)

# Google Test (for testing)
if(BUILD_TESTS)
    FetchContent_Declare(
        googletest
        GIT_REPOSITORY https://github.com/google/googletest.git
        GIT_TAG v1.14.0
    )
    FetchContent_MakeAvailable(googletest)
endif()
```

### cmake/CompilerFlags.cmake

```cmake
# Warning flags
if(MSVC)
    # Visual Studio
    add_compile_options(
        /W4                 # Warning level 4
        /WX                 # Warnings as errors
        /permissive-        # Standards conformance
        /Zc:__cplusplus     # Correct __cplusplus macro
    )
    
    # Disable specific warnings
    add_compile_options(
        /wd4251             # DLL interface warning
        /wd4275             # Non DLL-interface base class
    )
    
else()
    # GCC/Clang
    add_compile_options(
        -Wall
        -Wextra
        -Werror
        -pedantic
        -Wno-unused-parameter
    )
    
    # Additional GCC warnings
    if(CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
        add_compile_options(
            -Wsuggest-override
            -Wduplicated-cond
        )
    endif()
    
    # Additional Clang warnings
    if(CMAKE_CXX_COMPILER_ID STREQUAL "Clang")
        add_compile_options(
            -Wthread-safety
            -Wimplicit-fallthrough
        )
    endif()
endif()

# Optimization flags
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    if(MSVC)
        add_compile_options(/O2 /Ob2)
    else()
        add_compile_options(-O3 -march=native)
    endif()
    
    # Link Time Optimization
    if(ENABLE_LTO)
        set(CMAKE_INTERPROCEDURAL_OPTIMIZATION TRUE)
    endif()
endif()

# Debug flags
if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    if(MSVC)
        add_compile_options(/Od /Zi)
    else()
        add_compile_options(-O0 -g3)
    endif()
endif()

# Sanitizers
if(USE_ASAN AND NOT MSVC)
    add_compile_options(-fsanitize=address -fno-omit-frame-pointer)
    add_link_options(-fsanitize=address)
endif()

if(USE_TSAN AND NOT MSVC)
    add_compile_options(-fsanitize=thread)
    add_link_options(-fsanitize=thread)
endif()

# Position Independent Code
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
```

### src/CMakeLists.txt

```cmake
# Main executable
add_executable(nexus_browser
    main.cpp
)

# Add subdirectories
add_subdirectory(browser)
add_subdirectory(ai)
add_subdirectory(ui)
add_subdirectory(database)
add_subdirectory(ipc)

# Link libraries
target_link_libraries(nexus_browser
    PRIVATE
        nexus_browser_lib
        nexus_ai_lib
        nexus_ui_lib
        nexus_database_lib
        nexus_ipc_lib
        CEF::cef_dll_wrapper
        CEF::libcef
        SQLite::SQLite3
        Python3::Python
        nlohmann_json::nlohmann_json
        spdlog::spdlog
        fmt::fmt
        Threads::Threads
)

# Platform-specific linking
if(WIN32)
    target_link_libraries(nexus_browser PRIVATE
        comctl32
        rpcrt4
        shlwapi
    )
elseif(APPLE)
    target_link_libraries(nexus_browser PRIVATE
        "-framework Cocoa"
        "-framework AppKit"
    )
elseif(UNIX)
    target_link_libraries(nexus_browser PRIVATE
        X11
        ${GTK3_LIBRARIES}
    )
endif()

# Set properties
set_target_properties(nexus_browser PROPERTIES
    OUTPUT_NAME "nexus"
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
)

# Copy resources
add_custom_command(TARGET nexus_browser POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        ${CMAKE_SOURCE_DIR}/resources
        $<TARGET_FILE_DIR:nexus_browser>/resources
)

# Copy CEF resources
if(CEF_FOUND)
    add_custom_command(TARGET nexus_browser POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory
            ${CEF_BINARY_DIR}/Resources
            $<TARGET_FILE_DIR:nexus_browser>
    )
endif()

# Install target
install(TARGETS nexus_browser
    RUNTIME DESTINATION bin
)
```

### src/browser/CMakeLists.txt

```cmake
add_library(nexus_browser_lib STATIC
    browser_manager.cpp
    tab_manager.cpp
    window_manager.cpp
    session_manager.cpp
    process_manager.cpp
    extension_manager.cpp
    settings_manager.cpp
)

target_include_directories(nexus_browser_lib
    PUBLIC
        ${CMAKE_SOURCE_DIR}/include/browser
)

target_link_libraries(nexus_browser_lib
    PUBLIC
        CEF::cef_dll_wrapper
        nlohmann_json::nlohmann_json
        spdlog::spdlog
)

# Platform-specific sources
if(WIN32)
    target_sources(nexus_browser_lib PRIVATE
        platform/windows/window_impl_win.cpp
    )
elseif(APPLE)
    target_sources(nexus_browser_lib PRIVATE
        platform/macos/window_impl_mac.mm
    )
    set_source_files_properties(
        platform/macos/window_impl_mac.mm
        PROPERTIES COMPILE_FLAGS "-x objective-c++"
    )
elseif(UNIX)
    target_sources(nexus_browser_lib PRIVATE
        platform/linux/window_impl_linux.cpp
    )
endif()
```

### src/ai/CMakeLists.txt

```cmake
add_library(nexus_ai_lib STATIC
    ai_orchestrator.cpp
    model_manager.cpp
    inference_engine.cpp
    content_analyzer.cpp
)

target_include_directories(nexus_ai_lib
    PUBLIC
        ${CMAKE_SOURCE_DIR}/include/ai
    PRIVATE
        ${Python3_INCLUDE_DIRS}
)

target_link_libraries(nexus_ai_lib
    PUBLIC
        Python3::Python
        nlohmann_json::nlohmann_json
        spdlog::spdlog
    PRIVATE
        nexus_ipc_lib
)

# Copy Python scripts
add_custom_command(TARGET nexus_ai_lib POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        ${CMAKE_SOURCE_DIR}/python
        $<TARGET_FILE_DIR:nexus_browser>/python
)
```

## Build Configuration

### Configuration Types

```cmake
# Define build configurations
set(CMAKE_CONFIGURATION_TYPES "Debug;Release;RelWithDebInfo;MinSizeRel")

# Debug configuration
set(CMAKE_CXX_FLAGS_DEBUG "-O0 -g3 -DDEBUG")

# Release configuration
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -DNDEBUG")

# Release with debug info
set(CMAKE_CXX_FLAGS_RELWITHDEBINFO "-O2 -g -DNDEBUG")

# Minimum size release
set(CMAKE_CXX_FLAGS_MINSIZEREL "-Os -DNDEBUG")
```

### Build Commands

```bash
# Configure
cmake -S . -B build \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_TESTS=ON \
    -DENABLE_AI=ON

# Build
cmake --build build --config Release -j$(nproc)

# Test
ctest --test-dir build --output-on-failure

# Install
cmake --install build --prefix /opt/nexus

# Package
cd build
cpack
```

## Dependencies Management

### Using Conan

```ini
# conanfile.txt
[requires]
sqlite3/3.40.0
nlohmann_json/3.11.2
fmt/9.1.0
spdlog/1.11.0

[generators]
CMakeDeps
CMakeToolchain

[options]
sqlite3:threadsafe=1
spdlog:header_only=True
```

```bash
# Install dependencies
conan install . --output-folder=build --build=missing

# Configure with Conan
cmake -S . -B build \
    -DCMAKE_TOOLCHAIN_FILE=build/conan_toolchain.cmake

# Build
cmake --build build
```

### Using vcpkg

```json
// vcpkg.json
{
    "name": "nexus-browser",
    "version": "0.1.0",
    "dependencies": [
        "sqlite3",
        "nlohmann-json",
        "fmt",
        "spdlog",
        {
            "name": "python3",
            "platform": "!uwp"
        }
    ]
}
```

```bash
# Install dependencies
vcpkg install

# Configure with vcpkg
cmake -S . -B build \
    -DCMAKE_TOOLCHAIN_FILE=/path/to/vcpkg/scripts/buildsystems/vcpkg.cmake

# Build
cmake --build build
```

## Platform-Specific Builds

### Windows (Visual Studio)

```cmake
# cmake/Windows.cmake
if(WIN32)
    # Windows-specific settings
    add_definitions(-DUNICODE -D_UNICODE)
    add_definitions(-DNOMINMAX)
    add_definitions(-DWIN32_LEAN_AND_MEAN)
    
    # Set subsystem
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} /SUBSYSTEM:WINDOWS")
    
    # Manifest file
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} /MANIFEST:EMBED")
    
    # Resource file
    target_sources(nexus_browser PRIVATE
        ${CMAKE_SOURCE_DIR}/resources/windows/nexus.rc
    )
endif()
```

```bash
# Build with Visual Studio
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```

### macOS (Xcode)

```cmake
# cmake/macOS.cmake
if(APPLE)
    # macOS-specific settings
    set(MACOSX_BUNDLE_INFO_STRING "Nexus Browser")
    set(MACOSX_BUNDLE_GUI_IDENTIFIER "com.nexus.browser")
    set(MACOSX_BUNDLE_BUNDLE_NAME "Nexus")
    set(MACOSX_BUNDLE_BUNDLE_VERSION "0.1.0")
    set(MACOSX_BUNDLE_SHORT_VERSION_STRING "0.1")
    
    # Create app bundle
    set_target_properties(nexus_browser PROPERTIES
        MACOSX_BUNDLE TRUE
        MACOSX_BUNDLE_INFO_PLIST ${CMAKE_SOURCE_DIR}/resources/macos/Info.plist
    )
    
    # Code signing
    set(CMAKE_XCODE_ATTRIBUTE_CODE_SIGN_IDENTITY "Developer ID Application")
    
    # Frameworks
    target_link_libraries(nexus_browser PRIVATE
        "-framework Cocoa"
        "-framework AppKit"
        "-framework Security"
    )
endif()
```

```bash
# Build with Xcode
cmake -S . -B build -G Xcode
cmake --build build --config Release
```

### Linux

```cmake
# cmake/Linux.cmake
if(UNIX AND NOT APPLE)
    # Find GTK3
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(GTK3 REQUIRED gtk+-3.0)
    
    include_directories(${GTK3_INCLUDE_DIRS})
    link_directories(${GTK3_LIBRARY_DIRS})
    
    target_link_libraries(nexus_browser PRIVATE
        ${GTK3_LIBRARIES}
        X11
        Xrandr
    )
    
    # Desktop entry
    install(FILES ${CMAKE_SOURCE_DIR}/resources/linux/nexus.desktop
        DESTINATION share/applications
    )
    
    # Icon
    install(FILES ${CMAKE_SOURCE_DIR}/resources/icons/nexus.png
        DESTINATION share/icons/hicolor/256x256/apps
    )
endif()
```

```bash
# Build on Linux
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
```

## Build Targets

### Main Targets

```cmake
# Main executable
add_executable(nexus_browser ...)

# Helper processes (for CEF)
add_executable(nexus_helper ...)

# Installer/packager
add_custom_target(package
    COMMAND ${CMAKE_CPACK_COMMAND}
    DEPENDS nexus_browser
)

# Documentation
add_custom_target(docs
    COMMAND doxygen ${CMAKE_SOURCE_DIR}/Doxyfile
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
)

# Code formatting
add_custom_target(format
    COMMAND clang-format -i ${ALL_SOURCE_FILES}
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
)

# Static analysis
add_custom_target(analyze
    COMMAND clang-tidy ${ALL_SOURCE_FILES}
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
)
```

### Testing Targets

```cmake
# Unit tests
add_executable(nexus_tests
    tests/browser_tests.cpp
    tests/ai_tests.cpp
    tests/database_tests.cpp
)

target_link_libraries(nexus_tests
    PRIVATE
        nexus_browser_lib
        nexus_ai_lib
        nexus_database_lib
        GTest::gtest_main
)

# Add tests
include(GoogleTest)
gtest_discover_tests(nexus_tests)

# Integration tests
add_test(NAME integration_tests
    COMMAND ${CMAKE_SOURCE_DIR}/tests/run_integration_tests.sh
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR}
)
```

### Installation Target

```cmake
# cmake/Install.cmake

# Install executable
install(TARGETS nexus_browser
    RUNTIME DESTINATION bin
    BUNDLE DESTINATION .
)

# Install resources
install(DIRECTORY ${CMAKE_SOURCE_DIR}/resources/
    DESTINATION share/nexus
    PATTERN "*.md" EXCLUDE
)

# Install Python scripts
install(DIRECTORY ${CMAKE_SOURCE_DIR}/python/
    DESTINATION share/nexus/python
)

# Install desktop file (Linux)
if(UNIX AND NOT APPLE)
    install(FILES resources/linux/nexus.desktop
        DESTINATION share/applications
    )
endif()

# Install CEF dependencies
if(CEF_FOUND)
    install(DIRECTORY ${CEF_BINARY_DIR}/Resources/
        DESTINATION share/nexus
    )
    install(DIRECTORY ${CEF_BINARY_DIR}/Release/
        DESTINATION lib/nexus
    )
endif()
```

### Package Target

```cmake
# cmake/Package.cmake

include(CPack)

set(CPACK_PACKAGE_NAME "Nexus Browser")
set(CPACK_PACKAGE_VENDOR "Nexus Project")
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "AI-Powered Chromium Browser")
set(CPACK_PACKAGE_VERSION ${PROJECT_VERSION})

set(CPACK_PACKAGE_INSTALL_DIRECTORY "Nexus")

# Platform-specific packaging
if(WIN32)
    set(CPACK_GENERATOR "WIX;ZIP")
    set(CPACK_WIX_UPGRADE_GUID "...")
    set(CPACK_WIX_PRODUCT_ICON "${CMAKE_SOURCE_DIR}/resources/icons/nexus.ico")
elseif(APPLE)
    set(CPACK_GENERATOR "DragNDrop;productbuild")
    set(CPACK_DMG_VOLUME_NAME "Nexus Browser")
elseif(UNIX)
    set(CPACK_GENERATOR "DEB;RPM;TGZ")
    set(CPACK_DEBIAN_PACKAGE_MAINTAINER "maintainer@nexus.com")
    set(CPACK_RPM_PACKAGE_LICENSE "MIT")
endif()
```

## Build Optimization

### Precompiled Headers

```cmake
# Add precompiled header
target_precompile_headers(nexus_browser_lib
    PUBLIC
        <memory>
        <string>
        <vector>
        <map>
    PRIVATE
        <include/cef_app.h>
        <nlohmann/json.hpp>
        <spdlog/spdlog.h>
)
```

### Unity Build

```cmake
# Enable unity build for faster compilation
set_target_properties(nexus_browser_lib PROPERTIES
    UNITY_BUILD ON
    UNITY_BUILD_BATCH_SIZE 8
)
```

### Ccache

```cmake
# Use ccache if available
find_program(CCACHE_PROGRAM ccache)
if(CCACHE_PROGRAM)
    set(CMAKE_CXX_COMPILER_LAUNCHER "${CCACHE_PROGRAM}")
    message(STATUS "Using ccache: ${CCACHE_PROGRAM}")
endif()
```

## Continuous Integration

### GitHub Actions

```yaml
# .github/workflows/build.yml
name: Build

on: [push, pull_request]

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        build_type: [Debug, Release]
    
    runs-on: ${{ matrix.os }}
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Install dependencies
      run: |
        # Platform-specific dependency installation
    
    - name: Configure
      run: |
        cmake -S . -B build \
          -DCMAKE_BUILD_TYPE=${{ matrix.build_type }} \
          -DBUILD_TESTS=ON
    
    - name: Build
      run: cmake --build build --config ${{ matrix.build_type }}
    
    - name: Test
      run: ctest --test-dir build --config ${{ matrix.build_type }}
    
    - name: Package
      run: cd build && cpack
```
