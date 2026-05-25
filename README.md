<div align="center">

<img src="https://raw.githubusercontent.com/ahmedbenarab/dswin/refs/heads/master/src-tauri/icons/icon.ico" alt="DeepSeek" width="96" height="96">

# DeepSeek for Windows

**Native Windows 11 desktop client for DeepSeek AI**

[![Windows](https://img.shields.io/badge/Windows%2011-0078D6?style=flat&logo=windows11&logoColor=white)](https://www.microsoft.com/windows)
[![Tauri](https://img.shields.io/badge/Tauri%202-FFC131?style=flat&logo=tauri&logoColor=black)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![DeepSeek](https://img.shields.io/badge/DeepSeek%20API-V4-4F8CFF?style=flat&logo=deepin&logoColor=white)](https://deepseek.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)

</div>

---

## ✨ Features

| | |
|---|---|
| 🪟 **Native Windows 11** | Mica material, acrylic blur, custom title bar |
| ⌨️ **Global Hotkey** | `Ctrl+Shift+D` toggles the window from anywhere |
| 🔍 **Screenshot OCR** | Area-select screenshots with real-time Windows OCR |
| 📄 **PDF Extraction** | Drop a PDF and the text is extracted automatically |
| 🖼️ **Image OCR** | Upload images and extract text via Windows.Media.Ocr |
| 🌙 **Dark & Light Mode** | Full theme support with CSS variables |
| 🧠 **DeepSeek V4** | Flash + Pro models with thinking/reasoning mode |
| 🗂️ **Conversations** | Persistent chat history with sidebar |
| 📝 **Markdown** | Full rendering with code blocks and syntax |
| 🔴 **Stop Generation** | Cancel in-progress AI responses |
| 🗃️ **Drag & Drop** | Drop images, PDFs, or text files directly |
| 🎒 **System Tray** | Minimizes to tray; close doesn't quit |
| ↕️ **RTL / Arabic** | Built-in right-to-left text direction support |
| 📌 **Sidebar Toggle** | Collapse the conversation panel for focus |

---

## 📥 Download

Get the latest release from the [Releases page](https://github.com/ahmedbenarab/dswin/releases):

| Installer | Type |
|-----------|------|
| `DeepSeek_1.0.0_x64-setup.exe` | NSIS installer (recommended) |
| `DeepSeek_1.0.0_x64_en-US.msi` | MSI installer |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | TypeScript, HTML5, CSS3, Vite |
| **Markdown** | [marked.js](https://marked.js.org) |
| **Icons** | [Lucide](https://lucide.dev) |
| **Backend** | Rust, [Tauri v2](https://v2.tauri.app) |
| **WebView** | WebView2 (Chromium-based) |
| **OCR** | Windows.Media.Ocr (native WinRT) |
| **PDF** | [pdf-extract](https://crates.io/crates/pdf-extract) |
| **Screenshots** | [screenshots](https://crates.io/crates/screenshots) crate |
| **API** | DeepSeek Chat Completions API |
| **Build** | cargo, vite, tauri-cli |

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs) (MSVC toolchain)
- Windows 10/11 with WebView2

### Development

```bash
# Clone
git clone https://github.com/ahmedbenarab/dswin.git
cd dswin

# Install dependencies
npm install

# Run in dev mode
npm run tauri dev
```

### Production Build

```bash
npm run tauri build
```

Outputs go to `src-tauri/target/release/bundle/`.

---

## 📖 Usage

| Action | Shortcut |
|--------|----------|
| Toggle window | `Ctrl` + `Shift` + `D` |
| Send message | `Enter` |
| New line | `Shift` + `Enter` |
| Stop generation | Click the 🟥 stop button |
| Take screenshot | Click 📷 button in input bar |
| Attach file | Click 📎 or drag & drop |
| Settings | Click ⚙️ in title bar |
| New chat | Click ➕ in sidebar |

### API Setup

1. Get an API key from [platform.deepseek.com](https://platform.deepseek.com)
2. Open Settings (⚙️) and paste your key
3. Choose model: **Flash** (fast) or **Pro** (powerful with thinking mode)

---

## 🗂️ Project Structure

```
dswin/
├── index.html                  # Main UI
├── src/
│   └── main.ts                 # Frontend logic (1430+ lines)
├── src-tauri/
│   ├── Cargo.toml              # Rust dependencies
│   ├── tauri.conf.json         # Tauri config
│   ├── icons/                  # App icons
│   ├── gen/schemas/            # Generated Tauri schemas
│   └── src/
│       └── main.rs             # Rust backend (600+ lines)
├── package.json                # Node deps & scripts
├── vite.config.ts              # Vite bundler config
├── tsconfig.json               # TypeScript config
├── dev.bat                     # Dev launch script
└── build.bat                   # Build launch script
```

---

## 🔧 Configuration

### Change Global Hotkey

Edit `src-tauri/src/main.rs`:

```rust
let shortcut = Shortcut::new(
    Some(Modifiers::CONTROL | Modifiers::SHIFT),
    Key::KeyD
);
```

### Change Window Size

Edit `src-tauri/tauri.conf.json`:

```json
"width": 1400,
"height": 900
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT © Ahmed Benarab
