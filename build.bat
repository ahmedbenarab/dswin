@echo off
echo ==========================================
echo DeepSeek Windows App - Quick Setup
echo ==========================================
echo.

REM Check if Node.js is installed
node --version > nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js found

REM Check if Rust is installed
rustc --version > nul 2>&1
if errorlevel 1 (
    echo [ERROR] Rust is not installed!
    echo Please download and install Rust from:
    echo https://rustup.rs/
    echo.
    echo Or run this command in PowerShell:
    echo iwr -useb https://win.rustup.rs ^| iex
    echo.
    pause
    exit /b 1
)
echo [OK] Rust found

REM Install dependencies
echo.
echo Installing Node.js dependencies...
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install npm dependencies
    pause
    exit /b 1
)

REM Build the app
echo.
echo Building the application...
call npm run tauri build
if errorlevel 1 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Build Complete!
echo ==========================================
echo.
echo Installer location:
echo   src-tauri\target\release\bundle\msi\
echo   src-tauri\target\release\bundle\nsis\
echo.
echo Run the .msi or .exe installer to install DeepSeek app
echo.
pause
