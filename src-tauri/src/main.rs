// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder},
    Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use tauri_plugin_store::StoreExt;
use tauri_plugin_clipboard_manager::ClipboardExt;
use window_vibrancy::apply_mica;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use base64::Engine;


#[derive(Debug, Serialize, Deserialize, Clone)]
struct ChatMessage {
    role: String,
    content: String,
    timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct Conversation {
    id: String,
    title: String,
    messages: Vec<ChatMessage>,
    created_at: u64,
    updated_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct DeepSeekResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Choice {
    message: Message,
}

#[derive(Debug, Serialize, Deserialize)]
struct Message {
    content: String,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        if shortcut.mods.contains(tauri_plugin_global_shortcut::Modifiers::CONTROL)
                            && shortcut.mods.contains(tauri_plugin_global_shortcut::Modifiers::SHIFT)
                            && shortcut.key == tauri_plugin_global_shortcut::Code::KeyD
                        {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            
            // Apply Windows 11 Mica effect
            #[cfg(target_os = "windows")]
            let _ = apply_mica(&window, Some(true));
            
            // Initialize store for settings
            let _ = app.store("settings.json");
            let _ = app.store("conversations.json");
            
            // Register the global shortcut
            let shortcut = Shortcut::new(
                Some(tauri_plugin_global_shortcut::Modifiers::CONTROL | tauri_plugin_global_shortcut::Modifiers::SHIFT),
                tauri_plugin_global_shortcut::Code::KeyD,
            );
            
            app.global_shortcut().register(shortcut).expect("Failed to register shortcut");
            
            // Create system tray
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;
            
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            show_window, 
            hide_window, 
            toggle_window, 
            minimize_window,
            toggle_maximize,
            save_api_key,
            get_api_key,
            get_model,
            save_model,
            save_theme,
            get_theme,
            save_thinking_mode,
            get_thinking_mode,
            save_reasoning_effort,
            get_reasoning_effort,
            save_rtl,
            get_rtl,
            save_sidebar,
            get_sidebar,
            send_message,
            save_conversation,
            get_conversations,
            delete_conversation,
            read_file_content,
            take_screenshot,
            copy_image_to_clipboard,
            extract_text_from_image,
            extract_text_from_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn show_window(window: tauri::Window) {
    let _ = window.show();
    let _ = window.set_focus();
    let _ = window.unminimize();
}

#[tauri::command]
fn hide_window(window: tauri::Window) {
    let _ = window.hide();
}

#[tauri::command]
fn toggle_window(window: tauri::Window) {
    if window.is_visible().unwrap_or(true) {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.unminimize();
    }
}

#[tauri::command]
fn minimize_window(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
async fn toggle_maximize(window: tauri::Window) -> Result<bool, String> {
    if window.is_maximized().map_err(|e| e.to_string())? {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
fn save_api_key(app: tauri::AppHandle, api_key: String) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("api_key", serde_json::Value::String(api_key));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_api_key(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    Ok(store.get("api_key").and_then(|v| v.as_str().map(|s| s.to_string())))
}

#[tauri::command]
fn get_model(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    Ok(store.get("model").and_then(|v| v.as_str().map(|s| s.to_string())))
}

#[tauri::command]
fn save_model(app: tauri::AppHandle, model: String) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("model", serde_json::Value::String(model));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_theme(app: tauri::AppHandle, theme: String) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("theme", serde_json::Value::String(theme));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_theme(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    Ok(store.get("theme").and_then(|v| v.as_str().map(|s| s.to_string())))
}

#[tauri::command]
fn save_thinking_mode(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("thinking_enabled", serde_json::Value::Bool(enabled));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_thinking_mode(app: tauri::AppHandle) -> Result<Option<bool>, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    Ok(store.get("thinking_enabled").and_then(|v| v.as_bool()))
}

#[tauri::command]
fn save_reasoning_effort(app: tauri::AppHandle, effort: String) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("reasoning_effort", serde_json::Value::String(effort));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_reasoning_effort(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    Ok(store.get("reasoning_effort").and_then(|v| v.as_str().map(|s| s.to_string())))
}

#[tauri::command]
fn save_rtl(app: tauri::AppHandle, rtl: bool) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("rtl", serde_json::Value::Bool(rtl));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_rtl(app: tauri::AppHandle) -> Result<Option<bool>, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    Ok(store.get("rtl").and_then(|v| v.as_bool()))
}

#[tauri::command]
fn save_sidebar(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("sidebar_visible", serde_json::Value::Bool(visible));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_sidebar(app: tauri::AppHandle) -> Result<Option<bool>, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    Ok(store.get("sidebar_visible").and_then(|v| v.as_bool()))
}

#[tauri::command]
async fn send_message(
    api_key: String,
    model: String,
    messages: Vec<HashMap<String, String>>,
    thinking: Option<HashMap<String, String>>,
    reasoning_effort: Option<String>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    // Build request body with optional thinking mode
    let mut request_body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false,
    });
    
    // Add thinking mode if provided (for V4 Pro)
    if let Some(thinking_map) = thinking {
        request_body["thinking"] = serde_json::json!(thinking_map);
    }
    
    // Add reasoning effort if provided
    if let Some(effort) = reasoning_effort {
        request_body["reasoning_effort"] = serde_json::json!(effort);
    }
    
    let response = client
        .post("https://api.deepseek.com/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API Error {}: {}", status, text));
    }
    
    let result: DeepSeekResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    if let Some(choice) = result.choices.first() {
        Ok(choice.message.content.clone())
    } else {
        Err("No response from DeepSeek".to_string())
    }
}

#[tauri::command]
fn save_conversation(app: tauri::AppHandle, conversation: Conversation) -> Result<(), String> {
    let store = app.store("conversations.json").map_err(|e| e.to_string())?;
    let mut conversations: Vec<Conversation> = store
        .get("conversations")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    
    // Update existing or add new
    if let Some(index) = conversations.iter().position(|c| c.id == conversation.id) {
        conversations[index] = conversation;
    } else {
        conversations.push(conversation);
    }
    
    store.set("conversations", serde_json::to_value(conversations).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_conversations(app: tauri::AppHandle) -> Result<Vec<Conversation>, String> {
    let store = app.store("conversations.json").map_err(|e| e.to_string())?;
    Ok(store
        .get("conversations")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default())
}

#[tauri::command]
fn delete_conversation(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let store = app.store("conversations.json").map_err(|e| e.to_string())?;
    let mut conversations: Vec<Conversation> = store
        .get("conversations")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    
    conversations.retain(|c| c.id != id);
    
    store.set("conversations", serde_json::to_value(conversations).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn read_file_content(path: String) -> Result<HashMap<String, String>, String> {
    use std::path::Path;
    
    let path_obj = Path::new(&path);
    let extension = path_obj.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    let mut result = HashMap::new();
    result.insert("filename".to_string(), path_obj.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string());
    result.insert("extension".to_string(), extension.clone());
    
    // Image files - convert to base64
    let image_extensions = vec!["png", "jpg", "jpeg", "gif", "bmp", "webp"];
    if image_extensions.contains(&extension.as_str()) {
        let image_data = tokio::fs::read(&path).await
            .map_err(|e| format!("Failed to read image: {}", e))?;
        let base64_data = base64::engine::general_purpose::STANDARD.encode(&image_data);
        result.insert("type".to_string(), "image".to_string());
        result.insert("content".to_string(), base64_data);
        return Ok(result);
    }
    
    // PDF files - read as bytes and encode
    if extension == "pdf" {
        let pdf_data = tokio::fs::read(&path).await
            .map_err(|e| format!("Failed to read PDF: {}", e))?;
        let base64_data = base64::engine::general_purpose::STANDARD.encode(&pdf_data);
        result.insert("type".to_string(), "pdf".to_string());
        result.insert("content".to_string(), base64_data);
        return Ok(result);
    }
    
    // Text files - read as string
    let content = tokio::fs::read_to_string(&path).await
        .map_err(|e| format!("Failed to read file: {}", e))?;
    result.insert("type".to_string(), "text".to_string());
    result.insert("content".to_string(), content);
    
    Ok(result)
}

#[tauri::command]
async fn take_screenshot() -> Result<HashMap<String, String>, String> {
    use screenshots::Screen;
    
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    
    if screens.is_empty() {
        return Err("No screens found".to_string());
    }
    
    // Take screenshot of primary screen
    let screen = &screens[0];
    let image = screen.capture().map_err(|e| format!("Failed to capture: {}", e))?;
    
    // Save to temp file
    let temp_dir = std::env::temp_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let screenshot_path = temp_dir.join(format!("deepseek_screenshot_{}.png", timestamp));
    
    image.save(&screenshot_path).map_err(|e| format!("Failed to save screenshot: {}", e))?;
    
    // Read and encode as base64
    let image_data = tokio::fs::read(&screenshot_path).await
        .map_err(|e| format!("Failed to read screenshot: {}", e))?;
    let base64_data = base64::engine::general_purpose::STANDARD.encode(&image_data);
    
    let mut result = HashMap::new();
    result.insert("type".to_string(), "image".to_string());
    result.insert("content".to_string(), base64_data);
    result.insert("filename".to_string(), format!("screenshot_{}.png", timestamp));
    result.insert("extension".to_string(), "png".to_string());
    
    // Clean up temp file
    let _ = tokio::fs::remove_file(&screenshot_path).await;
    
    Ok(result)
}

#[tauri::command]
fn copy_image_to_clipboard(app: tauri::AppHandle, base64_data: String) -> Result<(), String> {
    let image_data = base64::engine::general_purpose::STANDARD.decode(base64_data)
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    
    // Decode the image to get dimensions
    let img = image::load_from_memory(&image_data)
        .map_err(|e| format!("Failed to load image: {}", e))?;
    
    let rgba = img.to_rgba8();
    let width = rgba.width();
    let height = rgba.height();
    
    let tauri_image = tauri::image::Image::new_owned(rgba.into_raw(), width, height);
    
    app.clipboard().write_image(&tauri_image)
        .map_err(|e| format!("Failed to copy to clipboard: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn extract_text_from_image(base64_data: String) -> Result<String, String> {
    use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};
    use windows::Graphics::Imaging::BitmapDecoder;
    use windows::Media::Ocr::OcrEngine;
    
    let image_data = base64::engine::general_purpose::STANDARD.decode(base64_data)
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    
    let stream = InMemoryRandomAccessStream::new()
        .map_err(|e| format!("Failed to create stream: {}", e))?;
    
    let writer = DataWriter::CreateDataWriter(&stream)
        .map_err(|e| format!("Failed to create data writer: {}", e))?;
    writer.WriteBytes(&image_data)
        .map_err(|e| format!("Failed to write bytes: {}", e))?;
    writer.StoreAsync()
        .map_err(|e| format!("Failed to store: {}", e))?
        .get()
        .map_err(|e| format!("Failed to store async: {}", e))?;
    writer.DetachStream()
        .map_err(|e| format!("Failed to detach stream: {}", e))?;
    
    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(|e| format!("Failed to create decoder: {}", e))?
        .get()
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    
    let bitmap = decoder
        .GetSoftwareBitmapAsync()
        .map_err(|e| format!("Failed to get bitmap: {}", e))?
        .get()
        .map_err(|e| format!("Failed to get bitmap async: {}", e))?;
    
    let engine = OcrEngine::TryCreateFromUserProfileLanguages()
        .map_err(|e| format!("Failed to create OCR engine: {}", e))?;
    
    let result = engine
        .RecognizeAsync(&bitmap)
        .map_err(|e| format!("Failed to recognize: {}", e))?
        .get()
        .map_err(|e| format!("OCR recognition failed: {}", e))?;
    
    let text = result.Text()
        .map_err(|e| format!("Failed to get text: {}", e))?;
    
    // Clean up
    stream.Close()
        .map_err(|e| format!("Failed to close stream: {}", e))?;
    
    let trimmed = text.to_string().trim().to_string();
    if trimmed.is_empty() {
        Ok("No text found in image".to_string())
    } else {
        Ok(trimmed)
    }
}

#[tauri::command]
fn extract_text_from_pdf(base64_data: String) -> Result<String, String> {
    let pdf_bytes = base64::engine::general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode PDF: {}", e))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let tmp = std::env::temp_dir().join(format!("deepseek_pdf_{}.pdf", timestamp));

    std::fs::write(&tmp, &pdf_bytes)
        .map_err(|e| format!("Failed to write temp PDF: {}", e))?;

    let text = pdf_extract::extract_text(&tmp)
        .map_err(|e| format!("Failed to extract PDF text: {}", e))?;

    std::fs::remove_file(&tmp).ok();

    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        Ok("No text found in PDF".to_string())
    } else {
        Ok(trimmed)
    }
}
