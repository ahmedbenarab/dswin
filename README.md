# DeepSeek Native Windows App

A native Windows 11 application for DeepSeek AI with quick-access global shortcut.

## Features

- **Native Windows App**: Built with Tauri (Rust + WebView2) for optimal performance
- **Global Hotkey**: Press `Ctrl + Shift + D` from anywhere to show/hide the app
- **Quick Input**: Type questions directly in the bottom input bar
- **System Tray Integration**: Close button minimizes to background, doesn't quit
- **Clean Interface**: Dark theme matching Windows 11 aesthetics

## Prerequisites

1. **Node.js** (v18 or later): [Download here](https://nodejs.org/)
2. **Rust**: Install from [rustup.rs](https://rustup.rs/)
3. **WebView2 Runtime**: Usually pre-installed on Windows 11

## Installation & Running

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Run in Development Mode

```bash
npm run tauri dev
```

### Step 3: Build for Production

```bash
npm run tauri build
```

This will create:
- `.msi` installer in `src-tauri/target/release/bundle/msi/`
- `.exe` installer in `src-tauri/target/release/bundle/nsis/`

## Usage

- **Open App**: Use the desktop shortcut or Start Menu
- **Quick Access**: Press `Ctrl + Shift + D` anywhere to toggle the window
- **Ask Questions**: Type in the bottom input bar and press Enter
- **Hide App**: Click × or use `Ctrl + Shift + D` - app runs in background
- **Close App**: Right-click system tray icon and select Quit

## Global Shortcut

The app registers a global hotkey `Ctrl + Shift + D` that works even when:
- The app is minimized
- The app is hidden
- You're in another application
- You're on the desktop

## Project Structure

```
dswin/
├── src/                    # Frontend source
│   └── main.ts            # Frontend logic
├── src-tauri/             # Rust backend
│   ├── src/
│   │   └── main.rs        # Rust main with hotkey logic
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── index.html             # Main HTML
├── package.json           # Node dependencies
└── vite.config.ts         # Vite config
```

## Customization

### Change Hotkey
Edit `src-tauri/src/main.rs` and modify the shortcut:
```rust
let shortcut = Shortcut::new(
    Some(tauri::Modifiers::CONTROL | tauri::Modifiers::ALT), 
    tauri::Key::KeyS  // Change to your preferred key
);
```

### Change Window Size
Edit `src-tauri/tauri.conf.json`:
```json
"width": 1400,
"height": 900
```

## Troubleshooting

### Build Errors
- Ensure Rust is installed: `rustc --version`
- Ensure Node.js is installed: `node --version`
- Run `npm install` again if dependencies are missing

### Hotkey Not Working
- The app needs to be running (check system tray)
- Some apps may intercept the hotkey first
- Try changing the hotkey combination

### WebView2 Not Found
- Download from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

## License

MIT
