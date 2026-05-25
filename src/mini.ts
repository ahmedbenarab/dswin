import { invoke } from "@tauri-apps/api/core";
import { marked } from "marked";
import DOMPurify from "dompurify";

// DOM Elements
const miniInput = document.getElementById("miniInput") as HTMLInputElement;
const sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
const messagesArea = document.getElementById("messagesArea") as HTMLDivElement;
const errorToast = document.getElementById("errorToast") as HTMLDivElement;
const openMainBtn = document.getElementById("openMainBtn") as HTMLButtonElement;
const closeBtn = document.getElementById("closeBtn") as HTMLButtonElement;

// State
let apiKey: string | null = null;
let currentModel = "deepseek-v4-flash";
let isLoading = false;
let currentRequestId: string | null = null;
let searchEnabled = false;
let searchApiKey = "";
let searchResultCount = 3;

// Helpers
function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote'],
        ALLOWED_ATTR: ['class']
    });
}

function renderMarkdown(text: string): string {
    try {
        return sanitizeHtml(marked.parse(text) as string);
    } catch {
        return escapeHtml(text);
    }
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Load settings
async function loadSettings() {
    try {
        apiKey = await invoke<string | null>("get_api_key");
        const model = await invoke<string | null>("get_model");
        if (model) currentModel = model;
        const search = await invoke<boolean | null>("get_search_enabled");
        searchEnabled = search ?? false;
        const key = await invoke<string | null>("get_search_api_key");
        searchApiKey = key ?? "";
        const count = await invoke<number | null>("get_search_result_count");
        searchResultCount = count ?? 3;
    } catch (error) {
        console.error("Failed to load settings:", error);
    }
}

// Show error
function showError(message: string) {
    errorToast.textContent = message;
    errorToast.classList.add("visible");
    setTimeout(() => errorToast.classList.remove("visible"), 3000);
}

// Add a message bubble to the chat
function addMessage(text: string, role: "user" | "assistant") {
    const msgDiv = document.createElement("div");
    msgDiv.className = `msg ${role}`;
    const icon = role === "user" ? "U" : `<img src="/deepseek-icon.png" alt="D" />`;
    const bubbleContent = role === "assistant" ? renderMarkdown(text) : escapeHtml(text);
    msgDiv.innerHTML = `
        <div class="msg-avatar">${icon}</div>
        <div class="msg-bubble">${bubbleContent}</div>
    `;
    messagesArea.appendChild(msgDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    return msgDiv;
}

// Add typing indicator
function addTypingIndicator(): HTMLDivElement {
    const typingDiv = document.createElement("div");
    typingDiv.className = "typing-msg";
    typingDiv.id = "typingMsg";
    typingDiv.innerHTML = `
        <div class="msg-avatar"><img src="/deepseek-icon.png" alt="D" /></div>
        <div class="typing-dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;
    messagesArea.appendChild(typingDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    return typingDiv;
}

function removeTypingIndicator() {
    const typing = document.getElementById("typingMsg");
    if (typing) typing.remove();
}

// Send message
async function sendMessage() {
    const message = miniInput.value.trim();
    if (!message || isLoading) return;

    if (!apiKey) {
        showError("No API key configured. Open the main app settings.");
        return;
    }

    // Add user message
    addMessage(message, "user");
    miniInput.value = "";
    miniInput.focus();

    // Show typing indicator
    addTypingIndicator();
    isLoading = true;
    sendBtn.disabled = true;
    miniInput.disabled = true;

    currentRequestId = generateId();

    try {
        const requestBody: any = {
            requestId: currentRequestId,
            apiKey,
            model: currentModel,
            messages: [
                { role: "system", content: "You are a helpful AI assistant. Keep responses concise and direct." },
                { role: "user", content: message }
            ],
            enableSearch: searchEnabled,
            searchApiKey: searchApiKey || undefined,
            searchResultCount: searchResultCount || undefined,
        };

        const response = await invoke<{content: string; usage?: {prompt_tokens: number; completion_tokens: number; total_tokens: number}; reasoning?: string}>("send_message", requestBody);

        removeTypingIndicator();
        addMessage(response.content, "assistant");
    } catch (error) {
        removeTypingIndicator();
        const errorMsg = String(error);
        if (!errorMsg.includes("cancelled")) {
            addMessage(`Error: ${errorMsg}`, "assistant");
        }
    } finally {
        currentRequestId = null;
        isLoading = false;
        sendBtn.disabled = false;
        miniInput.disabled = false;
        miniInput.focus();
    }
}

// Hide window
async function hideWindow() {
    try {
        await invoke("hide_mini_window");
    } catch (error) {
        console.error("Failed to hide mini window:", error);
    }
}

// Open main app
async function openMainApp() {
    try {
        await invoke("open_main_window");
        await hideWindow();
    } catch (error) {
        console.error("Failed to open main window:", error);
    }
}

// Event listeners
sendBtn?.addEventListener("click", sendMessage);

miniInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
    } else if (e.key === "Escape") {
        e.preventDefault();
        hideWindow();
    }
});

openMainBtn?.addEventListener("click", openMainApp);
closeBtn?.addEventListener("click", hideWindow);

// Focus input when window is shown
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        miniInput?.focus();
    }
});

// Initialize
loadSettings();
miniInput?.focus();
