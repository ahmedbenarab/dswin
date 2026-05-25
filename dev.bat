@echo off
echo ==========================================
echo DeepSeek Windows App - Development Mode
echo ==========================================
echo.
echo This will start the app in development mode.
echo Press Ctrl+Shift+D to toggle the window.
echo.

REM Check prerequisites
node --version > nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed!
    echo Please install from https://nodejs.org/
    pause
    exit /b 1
)

rustc --version > nul 2>&1
if errorlevel 1 (
    echo [ERROR] Rust is not installed!
    echo Please install from https://rustup.rs/
    pause
    exit /b 1
)

REM Install deps if needed
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

echo Starting development server...
call npm run tauri dev

pause
