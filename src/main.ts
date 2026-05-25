import { invoke, Channel } from "@tauri-apps/api/core";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { createIcons, icons } from "lucide";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import Fuse from "fuse.js";

// Types
interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

interface ChatMessage {
    role: string;
    content: string;
    timestamp: number;
    usage?: TokenUsage;
    reasoning?: string;
}

interface Conversation {
    id: string;
    title: string;
    messages: ChatMessage[];
    created_at: number;
    updated_at: number;
}

interface FileContent {
    filename: string;
    extension: string;
    type: string;
    content: string;
}

// State
let currentConversationId: string | null = null;
let apiKey: string | null = null;
let currentModel = "deepseek-v4-flash";
let isLoading = false;
let isMaximized = false;
let isDarkMode = true;
let thinkingEnabled = false;
let searchEnabled = false;
let searchApiKey = "";
let searchResultCount = 3;
let reasoningEffort = "high";
let sidebarVisible = true;
let isRTL = false;
let abortController: AbortController | null = null;
let currentRequestId: string | null = null;

// DOM Elements
const messageInput = document.getElementById("messageInput") as HTMLTextAreaElement;
const sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
const messagesContainer = document.getElementById("messagesContainer") as HTMLDivElement;
const chatList = document.getElementById("chatList") as HTMLDivElement;
const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement;
const settingsModalOverlay = document.getElementById("settingsModalOverlay") as HTMLDivElement;
const settingsModalClose = document.getElementById("settingsModalClose") as HTMLButtonElement;
const apiKeyInput = document.getElementById("apiKeyInput") as HTMLInputElement;
const saveApiKeyBtn = document.getElementById("saveApiKeyBtn") as HTMLButtonElement;
const apiStatus = document.getElementById("apiStatus") as HTMLDivElement;
const settingsModelSelector = document.getElementById("settingsModelSelector") as HTMLSelectElement;
const currentModelDisplay = document.getElementById("currentModelDisplay") as HTMLSpanElement;
const maximizeBtn = document.getElementById("maximizeBtn") as HTMLButtonElement;
const minimizeBtn = document.getElementById("minimizeBtn") as HTMLButtonElement;
const closeBtn = document.getElementById("closeBtn") as HTMLButtonElement;
const attachBtn = document.getElementById("attachBtn") as HTMLButtonElement;
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const screenshotBtn = document.getElementById("screenshotBtn") as HTMLButtonElement;
const themeToggle = document.getElementById("themeToggle") as HTMLDivElement;
const themeSwitch = document.getElementById("themeSwitch") as HTMLDivElement;
const appContainer = document.getElementById("appContainer") as HTMLDivElement;
const dragOverlay = document.getElementById("dragOverlay") as HTMLDivElement;
const thinkingToggle = document.getElementById("thinkingToggle") as HTMLDivElement;
const thinkingSwitch = document.getElementById("thinkingSwitch") as HTMLDivElement;
const reasoningEffortContainer = document.getElementById("reasoningEffortContainer") as HTMLDivElement;
const reasoningEffortSelect = document.getElementById("reasoningEffort") as HTMLSelectElement;
const searchApiKeyInput = document.getElementById("searchApiKeyInput") as HTMLInputElement;
const searchResultCountSelect = document.getElementById("searchResultCountSelect") as HTMLSelectElement;
const saveSearchSettingsBtn = document.getElementById("saveSearchSettingsBtn") as HTMLButtonElement;
const sidebarToggleBtn = document.getElementById("sidebarToggleBtn") as HTMLButtonElement;
const stopBtn = document.getElementById("stopBtn") as HTMLButtonElement;
const sidebar = document.querySelector(".sidebar") as HTMLDivElement;
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const searchClear = document.getElementById("searchClear") as HTMLButtonElement;
const systemPresetSelect = document.getElementById("systemPresetSelect") as HTMLSelectElement;
const exportChatBtn = document.getElementById("exportChatBtn") as HTMLButtonElement;
const searchToggleBtn = document.getElementById("searchToggleBtn") as HTMLButtonElement;

// State
let currentSystemPrompt = "You are a helpful AI assistant.";
let inputDrafts: Record<string, string> = {};
let currentSpeechUtterance: SpeechSynthesisUtterance | null = null;

// Icon rendering helper
function renderIcons(root: Element | Document = document) {
    createIcons({ icons, nameAttr: 'data-lucide', root: root as any });
}

// Toast notification system
function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    const container = document.getElementById('toastContainer')!;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Sanitize HTML content
function sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li',
            'blockquote', 'hr',
            'code', 'pre',
            'a', 'img',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'div', 'span', 'sup', 'sub'
        ],
        ALLOWED_ATTR: ['href', 'title', 'src', 'alt', 'class', 'target', 'rel', 'style']
    });
}

// Initialize icons
renderIcons();

// Window controls
minimizeBtn?.addEventListener("click", () => {
    invoke("minimize_window");
});

maximizeBtn?.addEventListener("click", async () => {
    try {
        isMaximized = await invoke("toggle_maximize");
        updateMaximizeIcon();
    } catch (error) {
        console.error("Failed to toggle maximize:", error);
    }
});

function updateMaximizeIcon() {
    const icon = maximizeBtn.querySelector("i");
    if (icon) {
        icon.setAttribute("data-lucide", isMaximized ? "minimize" : "maximize");
        renderIcons(maximizeBtn);
    }
}

closeBtn?.addEventListener("click", () => {
    invoke("hide_window");
});

// Settings Modal
settingsBtn?.addEventListener("click", () => {
    settingsModalOverlay.classList.add("active");
    settingsBtn.classList.add("active");
});

settingsModalClose?.addEventListener("click", closeSettingsModal);

settingsModalOverlay?.addEventListener("click", (e) => {
    if (e.target === settingsModalOverlay) {
        closeSettingsModal();
    }
});

function closeSettingsModal() {
    settingsModalOverlay.classList.remove("active");
    settingsBtn.classList.remove("active");
}

// Theme Toggle
themeToggle?.addEventListener("click", async () => {
    isDarkMode = !isDarkMode;
    updateTheme();
    await saveTheme(isDarkMode ? "dark" : "light");
});

// RTL Toggle
const rtlToggle = document.getElementById("rtlToggle") as HTMLDivElement;
const rtlSwitch = document.getElementById("rtlSwitch") as HTMLDivElement;

rtlToggle?.addEventListener("click", async () => {
    isRTL = !isRTL;
    updateRTL();
    await saveRTL(isRTL);
});

function updateRTL() {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    if (isRTL) {
        rtlSwitch.classList.add("active");
    } else {
        rtlSwitch.classList.remove("active");
    }
}

async function saveRTL(rtl: boolean) {
    try {
        await invoke("save_rtl", { rtl });
    } catch (error) {
        console.error("Failed to save RTL:", error);
    }
}

async function loadRTL() {
    try {
        const rtl = await invoke<boolean | null>("get_rtl");
        if (rtl !== null) {
            isRTL = rtl;
            updateRTL();
        }
    } catch (error) {
        console.error("Failed to load RTL:", error);
    }
}

// Sidebar Toggle
sidebarToggleBtn?.addEventListener("click", async () => {
    sidebarVisible = !sidebarVisible;
    updateSidebar();
    await saveSidebar(sidebarVisible);
});

function updateSidebar() {
    if (sidebarVisible) {
        sidebar.classList.remove("collapsed");
    } else {
        sidebar.classList.add("collapsed");
    }
}

async function saveSidebar(visible: boolean) {
    try {
        await invoke("save_sidebar", { visible });
    } catch (error) {
        console.error("Failed to save sidebar:", error);
    }
}

async function loadSidebar() {
    try {
        const visible = await invoke<boolean | null>("get_sidebar");
        if (visible !== null) {
            sidebarVisible = visible;
            updateSidebar();
        }
    } catch (error) {
        console.error("Failed to load sidebar:", error);
    }
}

// Stop Button
stopBtn?.addEventListener("click", async () => {
    if (currentRequestId) {
        try {
            await invoke("cancel_request", { requestId: currentRequestId });
        } catch (error) {
            console.error("Failed to cancel request:", error);
        }
        currentRequestId = null;
    }
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    hideTypingIndicator();
    isLoading = false;
    sendBtn.style.display = "flex";
    stopBtn.classList.remove("visible");
    messageInput.disabled = false;
    messageInput.focus();
});

function updateTheme() {
    if (isDarkMode) {
        appContainer.classList.remove("light-mode");
        themeSwitch.classList.add("active");
    } else {
        appContainer.classList.add("light-mode");
        themeSwitch.classList.remove("active");
    }
}

async function saveTheme(theme: string) {
    try {
        await invoke("save_theme", { theme });
    } catch (error) {
        console.error("Failed to save theme:", error);
    }
}

async function loadTheme() {
    try {
        const theme = await invoke<string | null>("get_theme");
        if (theme) {
            isDarkMode = theme === "dark";
            updateTheme();
        }
    } catch (error) {
        console.error("Failed to load theme:", error);
    }
}

// Model selection
settingsModelSelector?.addEventListener("change", async () => {
    currentModel = settingsModelSelector.value;
    updateModelDisplay();
    await saveModel(currentModel);
});

function updateModelDisplay() {
    const modelNames: { [key: string]: string } = {
        "deepseek-v4-flash": "DeepSeek-V4 Flash",
        "deepseek-v4-pro": "DeepSeek-V4 Pro"
    };
    currentModelDisplay.textContent = modelNames[currentModel] || "DeepSeek";
}

// Thinking mode toggle
thinkingToggle?.addEventListener("click", async () => {
    thinkingEnabled = !thinkingEnabled;
    updateThinkingUI();
    await saveThinkingMode(thinkingEnabled);
});

function updateThinkingUI() {
    if (thinkingEnabled) {
        thinkingSwitch.classList.add("active");
        reasoningEffortContainer.style.display = "flex";
        reasoningEffortContainer.style.flexDirection = "column";
        reasoningEffortContainer.style.gap = "10px";
    } else {
        thinkingSwitch.classList.remove("active");
        reasoningEffortContainer.style.display = "none";
    }
}

reasoningEffortSelect?.addEventListener("change", async () => {
    reasoningEffort = reasoningEffortSelect.value;
    await saveReasoningEffort(reasoningEffort);
});

async function saveThinkingMode(enabled: boolean) {
    try {
        await invoke("save_thinking_mode", { enabled });
    } catch (error) {
        console.error("Failed to save thinking mode:", error);
    }
}

async function saveReasoningEffort(effort: string) {
    try {
        await invoke("save_reasoning_effort", { effort });
    } catch (error) {
        console.error("Failed to save reasoning effort:", error);
    }
}

async function loadThinkingMode() {
    try {
        const enabled = await invoke<boolean | null>("get_thinking_mode");
        if (enabled !== null) {
            thinkingEnabled = enabled;
            updateThinkingUI();
        }
    } catch (error) {
        console.error("Failed to load thinking mode:", error);
    }
}

async function loadReasoningEffort() {
    try {
        const effort = await invoke<string | null>("get_reasoning_effort");
        if (effort) {
            reasoningEffort = effort;
            reasoningEffortSelect.value = effort;
        }
    } catch (error) {
        console.error("Failed to load reasoning effort:", error);
    }
}

async function loadSearchEnabled() {
    try {
        const enabled = await invoke<boolean | null>("get_search_enabled");
        searchEnabled = enabled ?? false;
        updateSearchToggleUI();
    } catch (error) {
        console.error("Failed to load search enabled:", error);
    }
}

function updateSearchToggleUI() {
    const btn = document.getElementById("searchToggleBtn");
    if (btn) {
        btn.classList.toggle("active", searchEnabled);
        btn.title = searchEnabled ? "Web search is ON" : "Web search is OFF";
    }
}

async function loadSearchSettings() {
    try {
        const key = await invoke<string | null>("get_search_api_key");
        searchApiKey = key ?? "";
        if (key && searchApiKeyInput) {
            searchApiKeyInput.value = key;
        }
        const count = await invoke<number | null>("get_search_result_count");
        searchResultCount = count ?? 3;
        if (count && searchResultCountSelect) {
            searchResultCountSelect.value = String(count);
        }
    } catch (error) {
        console.error("Failed to load search settings:", error);
    }
}

async function saveSearchSettings() {
    const key = searchApiKeyInput?.value.trim() ?? "";
    const count = parseInt(searchResultCountSelect?.value ?? "3", 10);
    searchApiKey = key;
    searchResultCount = count;
    try {
        await invoke("save_search_api_key", { apiKey: key });
        await invoke("save_search_result_count", { count });
        showToast("Search settings saved", "success");
    } catch (error) {
        showToast("Failed to save search settings", "error");
        console.error(error);
    }
}

async function saveModel(model: string) {
    try {
        await invoke("save_model", { model });
    } catch (error) {
        console.error("Failed to save model:", error);
    }
}

async function loadModel() {
    try {
        const model = await invoke<string | null>("get_model");
        if (model) {
            currentModel = model;
            settingsModelSelector.value = model;
            updateModelDisplay();
        }
    } catch (error) {
        console.error("Failed to load model:", error);
    }
}

// API Key Management
async function loadApiKey() {
    try {
        const key = await invoke<string | null>("get_api_key");
        apiKey = key;
        if (key) {
            apiKeyInput.value = key;
            updateApiStatus(true);
        } else {
            updateApiStatus(false);
        }
    } catch (error) {
        console.error("Failed to load API key:", error);
        updateApiStatus(false);
    }
}

async function saveApiKey() {
    const key = apiKeyInput.value.trim();
    if (!key) {
        showToast("Please enter an API key", "warning");
        return;
    }

    if (!key.startsWith("sk-")) {
        showToast("Invalid API key format. It should start with 'sk-'", "error");
        return;
    }

    try {
        saveApiKeyBtn.disabled = true;
        await invoke("save_api_key", { apiKey: key });
        apiKey = key;
        updateApiStatus(true);
        showToast("API key saved successfully!", "success");
    } catch (error) {
        console.error("Failed to save API key:", error);
        showToast("Failed to save API key", "error");
    } finally {
        saveApiKeyBtn.disabled = false;
    }
}

function updateApiStatus(connected: boolean) {
    if (connected) {
        apiStatus.classList.remove("disconnected");
        apiStatus.classList.add("connected");
        apiStatus.innerHTML = '<i data-lucide="check-circle"></i><span>Connected</span>';
    } else {
        apiStatus.classList.remove("connected");
        apiStatus.classList.add("disconnected");
        apiStatus.innerHTML = '<i data-lucide="alert-circle"></i><span>Not Connected</span>';
    }
    renderIcons(apiStatus);
}

saveApiKeyBtn?.addEventListener("click", saveApiKey);
saveSearchSettingsBtn?.addEventListener("click", saveSearchSettings);

// Auto-resize textarea
function autoResize() {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + "px";
}

messageInput?.addEventListener("input", autoResize);

// Generate unique ID
function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Truncate content to avoid exceeding API context limits
const MAX_MESSAGE_CHARS = 8000;
const MAX_HISTORY_MESSAGES = 20;

function truncateContent(text: string, maxChars: number = MAX_MESSAGE_CHARS): string {
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars) + `\n\n[Content truncated: ${text.length - maxChars} characters omitted]`;
}

function buildApiMessages(systemPrompt: string, history: { role: string; content: string }[], newMessage?: string): { role: string; content: string }[] {
    // Limit history length and truncate each message
    const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES).map(m => ({
        role: m.role,
        content: truncateContent(m.content)
    }));
    
    const messages: { role: string; content: string }[] = [
        { role: "system", content: systemPrompt },
        ...trimmedHistory,
    ];
    
    if (newMessage) {
        messages.push({ role: "user", content: truncateContent(newMessage) });
    }
    
    return messages;
}

// Get current timestamp
function getTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}

// Create new conversation
function createNewConversation(): Conversation {
    const id = generateId();
    const conversation: Conversation = {
        id,
        title: "New Conversation",
        messages: [],
        created_at: getTimestamp(),
        updated_at: getTimestamp(),
    };
    return conversation;
}

// Render markdown content
function renderMarkdown(text: string): string {
    try {
        const raw = marked.parse(text) as string;
        return sanitizeHtml(raw);
    } catch (error) {
        console.error("Markdown parsing error:", error);
        return escapeHtml(text);
    }
}

// Add message to UI
function addMessageToUI(
    text: string,
    role: "user" | "assistant",
    timestamp?: number,
    imageData?: string,
    extractedText?: string,
    usage?: TokenUsage,
    reasoning?: string
) {
    const welcomeMessage = messagesContainer.querySelector(".welcome-message");
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${role}`;
    messageDiv.dataset.role = role;

    const time = timestamp ? new Date(timestamp * 1000).toLocaleTimeString() : new Date().toLocaleTimeString();
    const iconName = role === "user" ? "user" : "bot";

    let imageHtml = "";
    let extractedTextHtml = "";
    let reasoningHtml = "";
    let usageHtml = "";
    let actionsHtml = "";

    if (imageData) {
        const isMinimized = extractedText ? 'minimized' : '';
        imageHtml = `
            <img src="data:image/png;base64,${imageData}" 
                 class="message-image ${isMinimized}" 
                 alt="Image" 
                 onclick="this.classList.toggle('minimized'); this.classList.toggle('expanded');"
                 title="Click to expand/collapse" />
        `;
    }

    if (extractedText) {
        extractedTextHtml = `
            <div class="extracted-text-container">
                <div class="extracted-text-label">📄 Extracted Text</div>
                <div class="extracted-text">${escapeHtml(extractedText)}</div>
            </div>
        `;
    }

    if (reasoning) {
        reasoningHtml = `
            <div class="thinking-block">
                <div class="thinking-header" onclick="this.classList.toggle('open'); this.nextElementSibling.classList.toggle('open')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    <span>Thinking Process</span>
                </div>
                <div class="thinking-content">${escapeHtml(reasoning)}</div>
            </div>
        `;
    }

    if (usage) {
        usageHtml = `<span class="token-counter">${usage.total_tokens} tokens</span>`;
    }

    if (role === "assistant") {
        actionsHtml = `
            <div class="message-actions">
                <button class="message-action-btn" data-action="copy" title="Copy response">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    Copy
                </button>
                <button class="message-action-btn" data-action="regenerate" title="Regenerate response">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                    Regenerate
                </button>
                <button class="message-action-btn" data-action="tts" title="Read aloud">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                    Speak
                </button>
            </div>
        `;
    } else if (role === "user") {
        actionsHtml = `
            <div class="message-actions">
                <button class="message-action-btn" data-action="edit" title="Edit message">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    Edit
                </button>
            </div>
        `;
    }

    // Render markdown for assistant messages
    const contentHtml = role === "assistant" ? renderMarkdown(text) : escapeHtml(text);

    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i data-lucide="${iconName}"></i>
        </div>
        <div>
            <div class="message-content">${contentHtml}${imageHtml}${extractedTextHtml}${reasoningHtml}</div>
            ${actionsHtml}
            <div class="message-time">${time}${usageHtml}</div>
        </div>
    `;

    // Attach action listeners
    messageDiv.querySelectorAll('.message-action-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = (btn as HTMLElement).dataset.action;
            if (action === 'copy') {
                navigator.clipboard.writeText(text).then(() => {
                    (btn as HTMLElement).textContent = 'Copied!';
                    setTimeout(() => {
                        (btn as HTMLElement).innerHTML = `
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                            Copy
                        `;
                    }, 1500);
                });
            } else if (action === 'regenerate') {
                regenerateResponse(messageDiv);
            } else if (action === 'edit') {
                editMessage(messageDiv, text);
            } else if (action === 'tts') {
                speakText(text, btn as HTMLElement);
            }
        });
    });

    messagesContainer.appendChild(messageDiv);
    renderIcons(messageDiv);

    // Add copy buttons to code blocks and apply syntax highlighting
    if (role === "assistant") {
        messageDiv.querySelectorAll('pre code').forEach((block) => {
            const pre = block.parentElement as HTMLPreElement;
            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';

            const header = document.createElement('div');
            header.className = 'code-block-header';

            const lang = block.className.replace('hljs', '').replace('language-', '').trim() || 'code';
            header.innerHTML = `<span>${lang}</span><button class="copy-code-btn">Copy</button>`;

            pre.parentNode?.insertBefore(wrapper, pre);
            wrapper.appendChild(header);
            wrapper.appendChild(pre);

            header.querySelector('.copy-code-btn')?.addEventListener('click', () => {
                navigator.clipboard.writeText(block.textContent || '').then(() => {
                    const btn = header.querySelector('.copy-code-btn') as HTMLButtonElement;
                    btn.textContent = 'Copied!';
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.textContent = 'Copy';
                        btn.classList.remove('copied');
                    }, 1500);
                });
            });

            // Apply syntax highlighting
            hljs.highlightElement(block as HTMLElement);
        });
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Regenerate assistant response
async function regenerateResponse(messageDiv: HTMLElement) {
    if (!apiKey || isLoading || !currentConversationId) return;

    // Remove this message and all messages after it
    let remove = false;
    const allMessages = Array.from(messagesContainer.querySelectorAll('.message'));
    for (const msg of allMessages) {
        if (remove) msg.remove();
        if (msg === messageDiv) {
            remove = true;
            msg.remove();
        }
    }

    // Rebuild conversation without the last assistant message
    const conversationMessages = await getConversationMessages();
    // Remove the last assistant message from history
    const lastMsg = conversationMessages[conversationMessages.length - 1];
    if (lastMsg && lastMsg.role === "assistant") {
        conversationMessages.pop();
    }

    showTypingIndicator();
    isLoading = true;
    sendBtn.style.display = "none";
    stopBtn.classList.add("visible");
    messageInput.disabled = true;

    abortController = new AbortController();
    const signal = abortController.signal;
    currentRequestId = generateId();

    try {
        const apiMessages = buildApiMessages(currentSystemPrompt, conversationMessages);
        const requestBody: any = {
            requestId: currentRequestId,
            apiKey,
            model: currentModel,
            messages: apiMessages,
            enableSearch: searchEnabled,
            searchApiKey: searchApiKey || undefined,
            searchResultCount: searchResultCount || undefined,
        };

        if (currentModel === "deepseek-v4-pro" && thinkingEnabled) {
            requestBody.thinking = { type: "enabled" };
            requestBody.reasoning_effort = reasoningEffort;
        }

        const response = await invoke<{content: string; usage?: TokenUsage; reasoning?: string}>("send_message", requestBody);

        if (signal.aborted) return;

        hideTypingIndicator();
        addMessageToUI(response.content, "assistant", undefined, undefined, undefined, response.usage, response.reasoning);

        // Save updated conversation
        const conversations = await invoke<Conversation[]>("get_conversations");
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (conversation) {
            conversation.messages.push(
                { role: "assistant", content: response.content, timestamp: getTimestamp(), usage: response.usage, reasoning: response.reasoning }
            );
            conversation.updated_at = getTimestamp();
            await invoke("save_conversation", { conversation });
            loadConversations();
        }
    } catch (error) {
        if (signal.aborted) return;
        hideTypingIndicator();
        const errorMsg = String(error);
        if (!errorMsg.includes("cancelled")) {
            addMessageToUI(`Error: ${error}`, "assistant");
        }
    } finally {
        currentRequestId = null;
        if (!signal.aborted) {
            isLoading = false;
            sendBtn.style.display = "flex";
            stopBtn.classList.remove("visible");
            messageInput.disabled = false;
            messageInput.focus();
        }
        abortController = null;
    }
}

// Edit user message
function editMessage(messageDiv: HTMLElement, oldText: string) {
    const contentDiv = messageDiv.querySelector('.message-content') as HTMLDivElement;
    const actionsDiv = messageDiv.querySelector('.message-actions') as HTMLDivElement;

    const textarea = document.createElement('textarea');
    textarea.className = 'edit-textarea';
    textarea.value = oldText;
    textarea.rows = 3;

    const editActions = document.createElement('div');
    editActions.className = 'edit-actions';
    editActions.innerHTML = `
        <button class="edit-btn save">Save & Send</button>
        <button class="edit-btn cancel">Cancel</button>
    `;

    contentDiv.style.display = 'none';
    if (actionsDiv) actionsDiv.style.display = 'none';
    messageDiv.appendChild(textarea);
    messageDiv.appendChild(editActions);
    textarea.focus();

    const saveBtn = editActions.querySelector('.save') as HTMLButtonElement;
    const cancelBtn = editActions.querySelector('.cancel') as HTMLButtonElement;

    saveBtn.addEventListener('click', async () => {
        const newText = textarea.value.trim();
        if (!newText) return;

        // Remove textarea and edit actions
        textarea.remove();
        editActions.remove();
        contentDiv.style.display = '';
        if (actionsDiv) actionsDiv.style.display = '';

        // Update the message content
        contentDiv.innerHTML = escapeHtml(newText);

        // Remove all messages after this one and regenerate
        let remove = false;
        const allMessages = Array.from(messagesContainer.querySelectorAll('.message'));
        for (const msg of allMessages) {
            if (remove) msg.remove();
            if (msg === messageDiv) remove = true;
        }

        // Update conversation in storage
        const conversations = await invoke<Conversation[]>("get_conversations");
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (conversation) {
            const msgIndex = conversation.messages.findIndex(m => m.role === "user" && m.content === oldText);
            if (msgIndex !== -1) {
                conversation.messages[msgIndex].content = newText;
                conversation.messages = conversation.messages.slice(0, msgIndex + 1);
                conversation.updated_at = getTimestamp();
                await invoke("save_conversation", { conversation });
            }
        }

        // Trigger new response
        messageInput.value = newText;
        await sendMessage();
    });

    cancelBtn.addEventListener('click', () => {
        textarea.remove();
        editActions.remove();
        contentDiv.style.display = '';
        if (actionsDiv) actionsDiv.style.display = '';
    });
}

// Text-to-speech
function speakText(text: string, btn: HTMLElement) {
    if (!window.speechSynthesis) {
        showToast("Text-to-speech not supported", "warning");
        return;
    }

    // Strip markdown for TTS
    const plainText = text.replace(/```[\s\S]*?```/g, ' code block ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*|__/g, '')
        .replace(/[#>*\-\[\]()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        btn.classList.remove('playing');
        if (currentSpeechUtterance) {
            currentSpeechUtterance = null;
            return;
        }
    }

    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.rate = 1.1;
    utterance.pitch = 1;

    utterance.onstart = () => btn.classList.add('playing');
    utterance.onend = () => {
        btn.classList.remove('playing');
        currentSpeechUtterance = null;
    };
    utterance.onerror = () => {
        btn.classList.remove('playing');
        currentSpeechUtterance = null;
    };

    currentSpeechUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

// Search conversations
let fuse: Fuse<Conversation> | null = null;

async function initSearch() {
    const conversations = await invoke<Conversation[]>("get_conversations");
    fuse = new Fuse(conversations, {
        keys: ['title', 'messages.content'],
        threshold: 0.4,
    });
}

function filterConversations(query: string) {
    if (!query.trim()) {
        loadConversations();
        return;
    }
    if (!fuse) {
        initSearch().then(() => filterConversations(query));
        return;
    }
    const results = fuse.search(query);
    const conversations = results.map(r => r.item);
    renderConversations(conversations);
}

// Export chat
async function exportChat(format: 'markdown' | 'txt') {
    if (!currentConversationId) {
        showToast("No active conversation to export", "warning");
        return;
    }

    try {
        const conversations = await invoke<Conversation[]>("get_conversations");
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (!conversation) return;

        let content = "";
        if (format === 'markdown') {
            content = `# ${conversation.title}\n\n`;
            conversation.messages.forEach(msg => {
                const time = new Date(msg.timestamp * 1000).toLocaleString();
                const role = msg.role === 'user' ? '**User**' : '**Assistant**';
                content += `### ${role} — ${time}\n\n${msg.content}\n\n---\n\n`;
            });
        } else {
            content = `${conversation.title}\n${'='.repeat(conversation.title.length)}\n\n`;
            conversation.messages.forEach(msg => {
                const time = new Date(msg.timestamp * 1000).toLocaleString();
                const role = msg.role === 'user' ? 'User' : 'Assistant';
                content += `[${time}] ${role}:\n${msg.content}\n\n`;
            });
        }

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deepseek-${conversation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Exported as ${format.toUpperCase()}`, "success");
    } catch (error) {
        console.error("Export failed:", error);
        showToast("Failed to export chat", "error");
    }
}

// System prompt presets
const SYSTEM_PRESETS: Record<string, string> = {
    "": "You are a helpful AI assistant.",
    "senior-dev": "You are a senior software engineer with 20 years of experience. Provide concise, production-ready code with best practices. Focus on performance, security, and maintainability.",
    "teacher": "You are a patient teacher who explains complex topics simply. Use analogies and break concepts into small steps. Assume the user is a beginner unless stated otherwise.",
    "arabic": "You are a professional Arabic translator and language expert. Respond in Arabic unless asked otherwise. Provide both formal and colloquial alternatives when relevant.",
    "writer": "You are a creative writer and editor. Help with storytelling, copywriting, and refining text. Provide multiple options when appropriate.",
    "debugger": "You are a debugging expert. Analyze code systematically, identify root causes, and suggest fixes with explanations. Ask for context if needed.",
};

// Escape HTML for user messages
function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Show typing indicator
function showTypingIndicator() {
    const indicator = document.createElement("div");
    indicator.className = "message assistant";
    indicator.id = "typingIndicator";
    indicator.innerHTML = `
        <div class="message-avatar">
            <i data-lucide="bot"></i>
        </div>
        <div class="typing-indicator">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;
    messagesContainer.appendChild(indicator);
    renderIcons(indicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Hide typing indicator
function hideTypingIndicator() {
    const indicator = document.getElementById("typingIndicator");
    if (indicator) {
        indicator.remove();
    }
}

// Send message
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isLoading) return;

    if (!apiKey) {
        showToast("Please configure your DeepSeek API key in Settings first!", "warning");
        settingsModalOverlay.classList.add("active");
        return;
    }

    // Create conversation if none exists
    if (!currentConversationId) {
        const conversation = createNewConversation();
        currentConversationId = conversation.id;
        await saveConversation(conversation);
        loadConversations();
    }

    // Add user message to UI
    addMessageToUI(message, "user");
    messageInput.value = "";
    messageInput.style.height = "auto";

    // Collect full conversation history for context
    const conversationMessages = await getConversationMessages();
    
    // Show typing indicator and switch to stop button
    showTypingIndicator();
    isLoading = true;
    sendBtn.style.display = "none";
    stopBtn.classList.add("visible");
    messageInput.disabled = true;

    // Create abort controller
    abortController = new AbortController();
    const signal = abortController.signal;

    try {
        // Build API messages with limits
        const apiMessages = buildApiMessages(
            currentSystemPrompt,
            conversationMessages,
            message
        );

        // Prepare request body with thinking mode if enabled
        const requestBody: any = {
            apiKey,
            model: currentModel,
            messages: apiMessages,
            enableSearch: searchEnabled,
            searchApiKey: searchApiKey || undefined,
            searchResultCount: searchResultCount || undefined,
        };
        
        // Add thinking mode for R1
        if (currentModel === "deepseek-v4-pro" && thinkingEnabled) {
            requestBody.thinking = { type: "enabled" };
            requestBody.reasoning_effort = reasoningEffort;
        }
        
        // Generate request ID
        currentRequestId = generateId();
        requestBody.requestId = currentRequestId;

        // Create streaming message placeholder
        hideTypingIndicator();
        const messageDiv = createStreamingMessage();
        let fullContent = "";
        let fullReasoning = "";
        let usage: TokenUsage | undefined;

        const channel = new Channel<{chunk: string; reasoning_chunk?: string; done: boolean}>();
        channel.onmessage = (msg) => {
            if (signal.aborted) return;
            if (msg.done) return;

            if (msg.reasoning_chunk) {
                fullReasoning += msg.reasoning_chunk;
                updateStreamingMessage(messageDiv, fullContent, fullReasoning);
            }
            if (msg.chunk) {
                fullContent += msg.chunk;
                updateStreamingMessage(messageDiv, fullContent, fullReasoning);
            }
        };

        requestBody.onChunk = channel;
        usage = await invoke<TokenUsage | undefined>("send_message_stream", requestBody);

        if (signal.aborted) return;

        // Finalize the message
        finalizeStreamingMessage(messageDiv, fullContent, fullReasoning, usage);

        // Show notification if window is hidden
        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
            new Notification("DeepSeek", {
                body: fullContent.substring(0, 100) + (fullContent.length > 100 ? "..." : ""),
                icon: "https://raw.githubusercontent.com/ahmedbenarab/dswin/refs/heads/master/src-tauri/icons/icon.ico"
            });
        }

        // Save conversation
        await saveCurrentConversation(message, fullContent, usage, fullReasoning || undefined);
    } catch (error) {
        if (signal.aborted) return;
        hideTypingIndicator();
        const errorMsg = String(error);
        if (!errorMsg.includes("cancelled")) {
            addMessageToUI(`Error: ${error}`, "assistant");
            console.error("API Error:", error);
        }
    } finally {
        currentRequestId = null;
        if (!signal.aborted) {
            isLoading = false;
            sendBtn.style.display = "flex";
            stopBtn.classList.remove("visible");
            messageInput.disabled = false;
            messageInput.focus();
        }
        abortController = null;
    }
}

// Streaming message helpers
function createStreamingMessage(): HTMLDivElement {
    const welcomeMessage = messagesContainer.querySelector(".welcome-message");
    if (welcomeMessage) welcomeMessage.remove();

    const messageDiv = document.createElement("div");
    messageDiv.className = "message assistant streaming";
    messageDiv.innerHTML = `
        <div class="message-avatar"><i data-lucide="bot"></i></div>
        <div>
            <div class="message-content">
                <div class="typing-indicator" style="display:flex;padding:0;">
                    <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                </div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(messageDiv);
    renderIcons(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return messageDiv;
}

function updateStreamingMessage(messageDiv: HTMLDivElement, content: string, reasoning: string) {
    const contentDiv = messageDiv.querySelector(".message-content") as HTMLDivElement;
    let html = "";
    if (reasoning) {
        html += `
            <div class="thinking-block">
                <div class="thinking-header open" onclick="this.classList.toggle('open'); this.nextElementSibling.classList.toggle('open')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    <span>Thinking Process</span>
                </div>
                <div class="thinking-content open">${escapeHtml(reasoning)}</div>
            </div>
        `;
    }
    html += renderMarkdown(content);
    contentDiv.innerHTML = html;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function finalizeStreamingMessage(messageDiv: HTMLDivElement, content: string, reasoning: string, usage?: TokenUsage) {
    messageDiv.classList.remove("streaming");
    const contentDiv = messageDiv.querySelector(".message-content") as HTMLDivElement;

    let html = "";
    if (reasoning) {
        html += `
            <div class="thinking-block">
                <div class="thinking-header" onclick="this.classList.toggle('open'); this.nextElementSibling.classList.toggle('open')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    <span>Thinking Process</span>
                </div>
                <div class="thinking-content">${escapeHtml(reasoning)}</div>
            </div>
        `;
    }
    html += renderMarkdown(content);
    contentDiv.innerHTML = html;

    // Add actions
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "message-actions";
    actionsDiv.innerHTML = `
        <button class="message-action-btn" data-action="copy" title="Copy response">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            Copy
        </button>
        <button class="message-action-btn" data-action="regenerate" title="Regenerate response">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
            Regenerate
        </button>
        <button class="message-action-btn" data-action="tts" title="Read aloud">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            Speak
        </button>
    `;
    messageDiv.querySelector(".message > div:last-child")?.appendChild(actionsDiv);

    // Attach action listeners
    actionsDiv.querySelectorAll('.message-action-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = (btn as HTMLElement).dataset.action;
            if (action === 'copy') {
                navigator.clipboard.writeText(content).then(() => {
                    (btn as HTMLElement).textContent = 'Copied!';
                    setTimeout(() => {
                        (btn as HTMLElement).innerHTML = `
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                            Copy
                        `;
                    }, 1500);
                });
            } else if (action === 'regenerate') {
                regenerateResponse(messageDiv);
            } else if (action === 'tts') {
                speakText(content, btn as HTMLElement);
            }
        });
    });

    // Add copy buttons to code blocks and apply syntax highlighting
    messageDiv.querySelectorAll('pre code').forEach((block) => {
        const pre = block.parentElement as HTMLPreElement;
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';

        const header = document.createElement('div');
        header.className = 'code-block-header';

        const lang = block.className.replace('hljs', '').replace('language-', '').trim() || 'code';
        header.innerHTML = `<span>${lang}</span><button class="copy-code-btn">Copy</button>`;

        pre.parentNode?.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);

        header.querySelector('.copy-code-btn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(block.textContent || '').then(() => {
                const btn = header.querySelector('.copy-code-btn') as HTMLButtonElement;
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = 'Copy';
                    btn.classList.remove('copied');
                }, 1500);
            });
        });

        hljs.highlightElement(block as HTMLElement);
    });

    // Add usage
    if (usage) {
        const timeDiv = messageDiv.querySelector('.message-time');
        if (timeDiv) {
            timeDiv.innerHTML += `<span class="token-counter">${usage.total_tokens} tokens</span>`;
        }
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Get current conversation messages from the store
async function getConversationMessages(): Promise<{ role: string; content: string }[]> {
    if (!currentConversationId) return [];
    
    try {
        const conversations = await invoke<Conversation[]>("get_conversations");
        const conversation = conversations.find(c => c.id === currentConversationId);
        return conversation?.messages.map(m => ({ role: m.role, content: m.content })) ?? [];
    } catch {
        return [];
    }
}

// Save current conversation
async function saveCurrentConversation(
    userMessage: string,
    assistantMessage: string,
    usage?: TokenUsage,
    reasoning?: string
) {
    if (!currentConversationId) return;

    try {
        const conversations = await invoke<Conversation[]>("get_conversations");
        const conversation = conversations.find((c) => c.id === currentConversationId);

        if (conversation) {
            conversation.messages.push(
                { role: "user", content: userMessage, timestamp: getTimestamp() },
                { role: "assistant", content: assistantMessage, timestamp: getTimestamp(), usage, reasoning }
            );
            conversation.updated_at = getTimestamp();

            // Update title from first user message
            if (conversation.messages.length === 2) {
                conversation.title = userMessage.substring(0, 30) + (userMessage.length > 30 ? "..." : "");
            }

            await invoke("save_conversation", { conversation });
            loadConversations();
        }
    } catch (error) {
        console.error("Failed to save conversation:", error);
    }
}

// Append assistant response to existing conversation
async function saveResponseToConversation(
    assistantMessage: string,
    usage?: TokenUsage,
    reasoning?: string
) {
    if (!currentConversationId || !assistantMessage) return;

    try {
        const conversations = await invoke<Conversation[]>("get_conversations");
        const conversation = conversations.find((c) => c.id === currentConversationId);

        if (conversation) {
            conversation.messages.push(
                { role: "assistant", content: assistantMessage, timestamp: getTimestamp(), usage, reasoning }
            );
            conversation.updated_at = getTimestamp();

            await invoke("save_conversation", { conversation });
            loadConversations();
        }
    } catch (error) {
        console.error("Failed to save response:", error);
    }
}

// Save conversation
async function saveConversation(conversation: Conversation) {
    try {
        await invoke("save_conversation", { conversation });
    } catch (error) {
        console.error("Failed to save conversation:", error);
    }
}

// Load conversations
async function loadConversations() {
    try {
        const conversations = await invoke<Conversation[]>("get_conversations");
        renderConversations(conversations);
    } catch (error) {
        console.error("Failed to load conversations:", error);
    }
}

// Render conversations list
function renderConversations(conversations: Conversation[]) {
    chatList.innerHTML = "";

    // Sort by updated_at descending
    conversations.sort((a, b) => b.updated_at - a.updated_at);

    conversations.forEach((conversation) => {
        const item = document.createElement("div");
        item.className = `chat-item ${conversation.id === currentConversationId ? "active" : ""}`;
        item.innerHTML = `
            <i data-lucide="message-square"></i>
            <span>${escapeHtml(conversation.title)}</span>
            <button class="delete-btn" title="Delete conversation">
                <i data-lucide="trash-2"></i>
            </button>
        `;

        item.addEventListener("click", (e) => {
            if ((e.target as HTMLElement).closest(".delete-btn")) {
                deleteConversation(conversation.id);
            } else {
                loadConversation(conversation.id);
            }
        });

        chatList.appendChild(item);
    });
    
    renderIcons(chatList);
}

// Load specific conversation
async function loadConversation(id: string) {
    try {
        const conversations = await invoke<Conversation[]>("get_conversations");
        const conversation = conversations.find((c) => c.id === id);

        if (conversation) {
            currentConversationId = id;
            messagesContainer.innerHTML = "";

            conversation.messages.forEach((msg) => {
                addMessageToUI(msg.content, msg.role as "user" | "assistant", msg.timestamp, undefined, undefined, msg.usage, msg.reasoning);
            });

            loadConversations(); // Refresh active state
        }
    } catch (error) {
        console.error("Failed to load conversation:", error);
    }
}

// Delete conversation
async function deleteConversation(id: string) {
    if (!confirm("Are you sure you want to delete this conversation?")) return;

    try {
        await invoke("delete_conversation", { id });
        if (currentConversationId === id) {
            currentConversationId = null;
            resetChat();
        }
        loadConversations();
    } catch (error) {
        console.error("Failed to delete conversation:", error);
    }
}

// Reset chat
function resetChat() {
    currentConversationId = null;
    messagesContainer.innerHTML = `
        <div class="welcome-message" id="welcomeMessage">
            <h2><i data-lucide="bot"></i> DeepSeek</h2>
            <p>Your AI assistant for coding, analysis, writing, and more. Ask me anything!</p>
            <div class="quick-actions">
                <div class="quick-action" data-prompt="Explain this code to me: ">
                    <i data-lucide="code"></i>
                    <div>Explain Code</div>
                    <small>Paste code and get explanation</small>
                </div>
                <div class="quick-action" data-prompt="Help me write a function that ">
                    <i data-lucide="terminal"></i>
                    <div>Write Code</div>
                    <small>Generate code snippets</small>
                </div>
                <div class="quick-action" data-prompt="Analyze this data and provide insights: ">
                    <i data-lucide="bar-chart-3"></i>
                    <div>Analyze Data</div>
                    <small>Get insights from data</small>
                </div>
                <div class="quick-action" data-prompt="Help me brainstorm ideas for ">
                    <i data-lucide="lightbulb"></i>
                    <div>Brainstorm</div>
                    <small>Generate creative ideas</small>
                </div>
            </div>
        </div>
    `;
    renderIcons(messagesContainer);
    attachQuickActionListeners();
}

// Attach quick action listeners
function attachQuickActionListeners() {
    document.querySelectorAll(".quick-action").forEach((action) => {
        action.addEventListener("click", () => {
            const prompt = action.getAttribute("data-prompt");
            if (prompt && messageInput) {
                messageInput.value = prompt;
                messageInput.focus();
                autoResize();
            }
        });
    });
}

// File handling
async function handleFile(file: File) {
    const MAX_FILE_SIZE_MB = 50;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        showToast(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`, "error");
        return;
    }
    
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    
    // Image files
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];
    if (imageExtensions.includes(fileExtension)) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = (e.target?.result as string).split(',')[1];
            
            // Create conversation if none exists
            if (!currentConversationId) {
                const conversation = createNewConversation();
                currentConversationId = conversation.id;
                await saveConversation(conversation);
                loadConversations();
            }
            
            // Show loading
            const loadingDiv = document.createElement("div");
            loadingDiv.className = "message user";
            loadingDiv.innerHTML = `
                <div class="message-avatar"><i data-lucide="user"></i></div>
                <div>
                    <div class="message-content">
                        <div class="ocr-loading">
                            <div class="spinner"></div>
                            <span>Extracting text from image...</span>
                        </div>
                    </div>
                </div>
            `;
            messagesContainer.appendChild(loadingDiv);
            renderIcons(loadingDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            try {
                // Extract text using OCR
                const extractedText = await invoke<string>("extract_text_from_image", { base64Data });
                
                // Remove loading
                loadingDiv.remove();
                
                const prompt = `I've uploaded an image "${fileName}". Here's what I found:`;
                addMessageToUI(prompt, "user", undefined, base64Data, extractedText);
                
                // Save user message first
                await saveCurrentConversation(prompt + "\n\n" + extractedText, "");
                
                // If we have API key and text was found, send to AI
                if (apiKey && extractedText !== "No text found in image") {
                    isLoading = true;
                    sendBtn.style.display = "none";
                    stopBtn.classList.add("visible");
                    showTypingIndicator();
                    
                    abortController = new AbortController();
                    const signal = abortController.signal;
                    
                    try {
                        const history = await getConversationMessages();
                        const apiMessages = buildApiMessages(
                            "You are a helpful AI assistant. Analyze the extracted text from an image and provide insights.",
                            history
                        );
                        
                        const requestBody: any = {
                            apiKey,
                            model: currentModel,
                            messages: apiMessages,
                            enableSearch: searchEnabled,
                            searchApiKey: searchApiKey || undefined,
                            searchResultCount: searchResultCount || undefined,
                        };
                        
                        if (currentModel === "deepseek-v4-pro" && thinkingEnabled) {
                            requestBody.thinking = { type: "enabled" };
                            requestBody.reasoning_effort = reasoningEffort;
                        }
                        
                        currentRequestId = generateId();
                        requestBody.requestId = currentRequestId;
                        const response = await invoke<{content: string; usage?: {prompt_tokens: number; completion_tokens: number; total_tokens: number}; reasoning?: string}>("send_message", requestBody);
                        
                        if (signal.aborted) return;
                        
                        hideTypingIndicator();
                        addMessageToUI(response.content, "assistant", undefined, undefined, undefined, response.usage, response.reasoning);
                        await saveResponseToConversation(response.content, response.usage, response.reasoning);
                    } catch (error) {
                        if (signal.aborted) return;
                        hideTypingIndicator();
                        const errorMsg = String(error);
                        if (!errorMsg.includes("cancelled")) {
                            addMessageToUI(`Error: ${error}`, "assistant");
                        }
                    } finally {
                        currentRequestId = null;
                        if (!signal.aborted) {
                            isLoading = false;
                            sendBtn.style.display = "flex";
                            stopBtn.classList.remove("visible");
                        }
                        abortController = null;
                    }
                } else if (extractedText === "No text found in image") {
                    addMessageToUI("No text was found in this image. The image may contain only graphics or photos.", "assistant");
                    await saveResponseToConversation("No text was found in this image. The image may contain only graphics or photos.");
                }
            } catch (error) {
                loadingDiv.remove();
                console.error("OCR failed:", error);
                addMessageToUI(`Failed to extract text from image: ${error}`, "user", undefined, base64Data);
            }
        };
        reader.readAsDataURL(file);
        return;
    }
    
    // PDF files
    if (fileExtension === 'pdf') {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = (e.target?.result as string).split(',')[1];
            
            // Create conversation if none exists
            if (!currentConversationId) {
                const conversation = createNewConversation();
                currentConversationId = conversation.id;
                await saveConversation(conversation);
                loadConversations();
            }
            
            const loadingDiv = document.createElement("div");
            loadingDiv.className = "message user";
            loadingDiv.innerHTML = `
                <div class="message-avatar"><i data-lucide="user"></i></div>
                <div>
                    <div class="message-content">
                        <div class="ocr-loading">
                            <div class="spinner"></div>
                            <span>Extracting text from PDF...</span>
                        </div>
                    </div>
                </div>
            `;
            messagesContainer.appendChild(loadingDiv);
            renderIcons(loadingDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            try {
                const extractedText = await invoke<string>("extract_text_from_pdf", { base64Data });
                
                loadingDiv.remove();
                
                const prompt = `I've uploaded a PDF "${fileName}". Here's the content:`;
                const fileIndicator = `<div class="message-file"><i data-lucide="file-text"></i> ${fileName}</div>`;
                
                // Add user message with file indicator and extracted text
                const msgDiv = document.createElement("div");
                msgDiv.className = "message user";
                msgDiv.innerHTML = `
                    <div class="message-avatar"><i data-lucide="user"></i></div>
                    <div>
                        <div class="message-content">
                            ${escapeHtml(prompt)}
                            ${fileIndicator}
                            <div class="extracted-text-container">
                                <div class="extracted-text-label">Extracted Text</div>
                                <div class="extracted-text">${escapeHtml(extractedText)}</div>
                            </div>
                        </div>
                        <div class="message-time">${new Date().toLocaleTimeString()}</div>
                    </div>
                `;
                messagesContainer.appendChild(msgDiv);
                renderIcons(msgDiv);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                
                // Save user message first
                await saveCurrentConversation(prompt + "\n\n" + extractedText, "");
                
                if (apiKey && extractedText !== "No text found in PDF") {
                    isLoading = true;
                    sendBtn.style.display = "none";
                    stopBtn.classList.add("visible");
                    showTypingIndicator();
                    
                    abortController = new AbortController();
                    const signal = abortController.signal;
                    
                    try {
                        const history = await getConversationMessages();
                        const apiMessages = buildApiMessages(
                            "You are a helpful AI assistant. Analyze the extracted text from a PDF and provide insights.",
                            history
                        );
                        
                        const requestBody: any = {
                            apiKey,
                            model: currentModel,
                            messages: apiMessages,
                            enableSearch: searchEnabled,
                            searchApiKey: searchApiKey || undefined,
                            searchResultCount: searchResultCount || undefined,
                        };
                        
                        if (currentModel === "deepseek-v4-pro" && thinkingEnabled) {
                            requestBody.thinking = { type: "enabled" };
                            requestBody.reasoning_effort = reasoningEffort;
                        }
                        
                        currentRequestId = generateId();
                        requestBody.requestId = currentRequestId;
                        const response = await invoke<{content: string; usage?: {prompt_tokens: number; completion_tokens: number; total_tokens: number}; reasoning?: string}>("send_message", requestBody);
                        
                        if (signal.aborted) return;
                        
                        hideTypingIndicator();
                        addMessageToUI(response.content, "assistant", undefined, undefined, undefined, response.usage, response.reasoning);
                        await saveResponseToConversation(response.content, response.usage, response.reasoning);
                    } catch (error) {
                        if (signal.aborted) return;
                        hideTypingIndicator();
                        const errorMsg = String(error);
                        if (!errorMsg.includes("cancelled")) {
                            addMessageToUI(`Error: ${error}`, "assistant");
                        }
                    } finally {
                        currentRequestId = null;
                        if (!signal.aborted) {
                            isLoading = false;
                            sendBtn.style.display = "flex";
                            stopBtn.classList.remove("visible");
                        }
                        abortController = null;
                    }
                } else if (extractedText === "No text found in PDF") {
                    addMessageToUI("No text was found in this PDF. It may contain only images or scanned content.", "assistant");
                    await saveResponseToConversation("No text was found in this PDF. It may contain only images or scanned content.");
                }
            } catch (error) {
                loadingDiv.remove();
                console.error("PDF extraction failed:", error);
                addMessageToUI(`Failed to extract text from PDF: ${error}`, "user");
            }
        };
        reader.readAsDataURL(file);
        return;
    }
    
    // Text files
    const text = await file.text();
    const codeExtensions = ['js', 'ts', 'html', 'css', 'py', 'java', 'cpp', 'c', 'h', 'rs', 'go', 'rb', 'php', 'sql', 'json', 'xml'];
    
    let prompt = '';
    if (codeExtensions.includes(fileExtension)) {
        prompt = `Here's a ${fileExtension.toUpperCase()} file named "${fileName}":\n\n\`\`\`${fileExtension}\n${text}\n\`\`\`\n\nPlease analyze this code and provide insights.`;
    } else {
        prompt = `Here's the content of "${fileName}":\n\n${text}\n\nPlease analyze this content.`;
    }
    
    messageInput.value = prompt;
    autoResize();
    messageInput.focus();
}

// File input
attachBtn?.addEventListener("click", () => {
    fileInput?.click();
});

fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (file) {
        await handleFile(file);
    }
    fileInput.value = '';
});

// Drag and drop
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    dragOverlay.classList.add('active');
});

document.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) {
        dragOverlay.classList.remove('active');
    }
});

document.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragOverlay.classList.remove('active');
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
        await handleFile(files[0]);
    }
});

// Screenshot functionality with area selection
screenshotBtn?.addEventListener("click", async () => {
    try {
        // Hide window
        await invoke("hide_window");
        
        // Wait a bit for window to hide
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Take screenshot
        const result = await invoke<FileContent>("take_screenshot");
        
        // Show window again
        await invoke("show_window");
        
        if (result && result.content) {
            // Store screenshot data
            const screenshotData = result.content;
            
            // Show area selection overlay
            showAreaSelection(screenshotData);
        }
    } catch (error) {
        console.error("Screenshot failed:", error);
        await invoke("show_window");
        showToast("Failed to take screenshot. Please try again.", "error");
    }
});

// Area selection overlay — single canvas, direct pixel math, no DOM conversions
function showAreaSelection(screenshotData: string) {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.88);
        z-index: 3000; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        cursor: crosshair; user-select: none;
    `;

    const instructions = document.createElement("div");
    instructions.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.9); color: #fff; padding: 12px 24px;
        border-radius: 10px; font-size: 13px; z-index: 3002;
        text-align: center; pointer-events: none; line-height: 1.6;
    `;
    instructions.innerHTML = `<strong>Screenshot captured!</strong><br>Click & drag to select area · Click once for full · Esc to cancel`;

    const canvas = document.createElement("canvas");
    canvas.style.cssText = `max-width: 90vw; max-height: 80vh; box-shadow: 0 8px 32px rgba(0,0,0,0.5); cursor: crosshair;`;
    const ctx = canvas.getContext("2d")!;

    overlay.appendChild(canvas);
    overlay.appendChild(instructions);
    document.body.appendChild(overlay);

    const img = new Image();
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let sel = { x: 0, y: 0, w: 0, h: 0 };

    function fitImage() {
        const maxW = window.innerWidth * 0.9;
        const maxH = window.innerHeight * 0.8;
        const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
        canvas.width = Math.round(img.naturalWidth * s);
        canvas.height = Math.round(img.naturalHeight * s);
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw the scaled-down screenshot
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        if (sel.w > 2 && sel.h > 2) {
            const srcScaleX = img.naturalWidth / canvas.width;
            const srcScaleY = img.naturalHeight / canvas.height;

            // Dim everything outside the selection
            ctx.fillStyle = "rgba(0,0,0,0.45)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Redraw ONLY the selected area from the original image, mapped to canvas coords
            ctx.drawImage(
                img,
                sel.x * srcScaleX, sel.y * srcScaleY, sel.w * srcScaleX, sel.h * srcScaleY,
                sel.x, sel.y, sel.w, sel.h
            );

            // Selection border
            ctx.strokeStyle = "#4F8CFF"; ctx.lineWidth = 2;
            ctx.strokeRect(sel.x, sel.y, sel.w, sel.h);

            // Size label
            const label = `${Math.round(sel.w)}×${Math.round(sel.h)}`;
            ctx.fillStyle = "#4F8CFF"; ctx.font = "bold 11px sans-serif";
            const tw = ctx.measureText(label).width;
            ctx.fillRect(sel.x, Math.max(0, sel.y - 18), tw + 8, 18);
            ctx.fillStyle = "#fff";
            ctx.fillText(label, sel.x + 4, Math.max(14, sel.y - 4));
        }
    }

    img.onload = () => { fitImage(); draw(); };
    img.src = `data:image/png;base64,${screenshotData}`;

    function pos(e: MouseEvent) {
        const r = canvas.getBoundingClientRect();
        const sx = canvas.width / r.width;
        const sy = canvas.height / r.height;
        return {
            x: Math.max(0, Math.min(canvas.width, (e.clientX - r.left) * sx)),
            y: Math.max(0, Math.min(canvas.height, (e.clientY - r.top) * sy)),
        };
    }

    function onDown(e: MouseEvent) {
        if (e.button !== 0) return;
        isDragging = true;
        dragStart = pos(e);
        sel = { x: dragStart.x, y: dragStart.y, w: 0, h: 0 };
        draw();
    }

    function onMove(e: MouseEvent) {
        if (!isDragging) return;
        const p = pos(e);
        sel.x = Math.min(dragStart.x, p.x);
        sel.y = Math.min(dragStart.y, p.y);
        sel.w = Math.abs(p.x - dragStart.x);
        sel.h = Math.abs(p.y - dragStart.y);
        draw();
    }

    async function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        overlay.removeEventListener("mousedown", onDown);

        if (!isDragging) {
            overlay.remove(); document.removeEventListener("keydown", onEsc);
            await processScreenshot(screenshotData, false);
            return;
        }
        isDragging = false;
        overlay.remove(); document.removeEventListener("keydown", onEsc);

        // Convert canvas coords → original image coords
        const scaleX = img.naturalWidth / canvas.width;
        const scaleY = img.naturalHeight / canvas.height;
        const cx = Math.round(sel.x * scaleX);
        const cy = Math.round(sel.y * scaleY);
        const cw = Math.round(sel.w * scaleX);
        const ch = Math.round(sel.h * scaleY);

        if (cw > 20 && ch > 20) {
            const cropped = await cropScreenshot(screenshotData, cx, cy, cw, ch);
            if (cropped) {
                await processScreenshot(cropped, true);
                return;
            }
        }
        await processScreenshot(screenshotData, false);
    }

    function onEsc(e: KeyboardEvent) {
        if (e.key === "Escape") {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.removeEventListener("keydown", onEsc);
            overlay.removeEventListener("mousedown", onDown);
            overlay.remove();
        }
    }

    overlay.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("keydown", onEsc);
}

// Crop screenshot — returns null if crop would be empty/invalid
async function cropScreenshot(base64Data: string, x: number, y: number, width: number, height: number): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // Validate bounds
            const maxW = img.naturalWidth;
            const maxH = img.naturalHeight;
            if (x < 0) { width += x; x = 0; }
            if (y < 0) { height += y; y = 0; }
            if (x + width > maxW) width = maxW - x;
            if (y + height > maxH) height = maxH - y;
            if (width <= 0 || height <= 0) {
                resolve(null);
                return;
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
            resolve(canvas.toDataURL("image/png").split(",")[1]);
        };
        img.onerror = () => resolve(null);
        img.src = `data:image/png;base64,${base64Data}`;
    });
}

// Process screenshot - extract text with OCR and send to AI
// isCropped = true when user selected a specific area, false for full screenshot
async function processScreenshot(screenshotData: string, isCropped = false) {
    // Create conversation if none exists
    if (!currentConversationId) {
        const conversation = createNewConversation();
        currentConversationId = conversation.id;
        await saveConversation(conversation);
        loadConversations();
    }
    
    // Show loading state
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "message user";
    loadingDiv.innerHTML = `
        <div class="message-avatar"><i data-lucide="user"></i></div>
        <div>
            <div class="message-content">
                <div class="ocr-loading">
                    <div class="spinner"></div>
                    <span>${isCropped ? "Reading text from selected area..." : "Extracting text from screenshot..."}</span>
                </div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(loadingDiv);
    renderIcons(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
        // Extract text using OCR — screenshotData is ALREADY cropped if user selected an area
        const extractedText = await invoke<string>("extract_text_from_image", { base64Data: screenshotData });
        
        // Remove loading message
        loadingDiv.remove();
        
        // Add message with the (cropped) image and extracted text
        const prompt = isCropped
            ? "I've selected an area from my screen. Here's what I found:"
            : "I've taken a screenshot. Here's what I found:";
        addMessageToUI(prompt, "user", undefined, screenshotData, extractedText);
        
        // Save user message to conversation
        await saveCurrentConversation(prompt + "\n\n" + extractedText, "");
        
        // If we have API key, send extracted text to AI
        if (apiKey && extractedText !== "No text found in image") {
            isLoading = true;
            sendBtn.style.display = "none";
            stopBtn.classList.add("visible");
            showTypingIndicator();
            
            abortController = new AbortController();
            const signal = abortController.signal;
            
            try {
                // Build API messages with full conversation history
                const history = await getConversationMessages();
                const apiMessages = buildApiMessages(
                    "You are a helpful AI assistant. Analyze the extracted text from a screenshot and provide insights.",
                    history
                );
                
                const requestBody: any = {
                    apiKey,
                    model: currentModel,
                    messages: apiMessages,
                    enableSearch: searchEnabled,
                    searchApiKey: searchApiKey || undefined,
                    searchResultCount: searchResultCount || undefined,
                };
                
                // Add thinking mode for R1
                if (currentModel === "deepseek-v4-pro" && thinkingEnabled) {
                    requestBody.thinking = { type: "enabled" };
                    requestBody.reasoning_effort = reasoningEffort;
                }
                
                currentRequestId = generateId();
                requestBody.requestId = currentRequestId;
                const response = await invoke<{content: string; usage?: {prompt_tokens: number; completion_tokens: number; total_tokens: number}; reasoning?: string}>("send_message", requestBody);
                
                if (signal.aborted) return;
                
                hideTypingIndicator();
                addMessageToUI(response.content, "assistant", undefined, undefined, undefined, response.usage, response.reasoning);
                
                // Update conversation with response
                await saveResponseToConversation(response.content, response.usage, response.reasoning);
            } catch (error) {
                if (signal.aborted) return;
                hideTypingIndicator();
                const errorMsg = String(error);
                if (!errorMsg.includes("cancelled")) {
                    addMessageToUI(`Error: ${error}`, "assistant");
                }
            } finally {
                currentRequestId = null;
                if (!signal.aborted) {
                    isLoading = false;
                    sendBtn.style.display = "flex";
                    stopBtn.classList.remove("visible");
                }
                abortController = null;
            }
        } else if (extractedText === "No text found in image") {
            addMessageToUI("No text was found in this screenshot. The image may contain only graphics or photos.", "assistant");
            await saveResponseToConversation("No text was found in this screenshot. The image may contain only graphics or photos.");
        }
    } catch (error) {
        // Remove loading message
        loadingDiv.remove();
        console.error("OCR failed:", error);
        addMessageToUI(`Failed to extract text from image: ${error}`, "user", undefined, screenshotData);
    }
}

// Event listeners
sendBtn?.addEventListener("click", sendMessage);

searchToggleBtn?.addEventListener("click", async () => {
    searchEnabled = !searchEnabled;
    updateSearchToggleUI();
    try {
        await invoke("save_search_enabled", { enabled: searchEnabled });
        showToast(searchEnabled ? "Web search enabled" : "Web search disabled", "success");
    } catch (error) {
        console.error("Failed to save search enabled:", error);
    }
});

// Settings tabs
document.querySelectorAll(".settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        const target = (tab as HTMLElement).dataset.tab;
        if (!target) return;
        
        // Switch tabs
        document.querySelectorAll(".settings-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        
        // Switch panels
        document.querySelectorAll(".settings-tab-panel").forEach((panel) => {
            panel.classList.toggle("active", (panel as HTMLElement).dataset.panel === target);
        });
    });
});

messageInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// New chat button
const newChatBtn = document.getElementById("newChatBtn");
newChatBtn?.addEventListener("click", () => {
    resetChat();
    loadConversations();
});

// Search functionality
searchInput?.addEventListener("input", () => {
    const query = searchInput.value;
    searchClear.classList.toggle("visible", query.length > 0);
    filterConversations(query);
});

searchClear?.addEventListener("click", () => {
    searchInput.value = "";
    searchClear.classList.remove("visible");
    loadConversations();
    searchInput.focus();
});

// System prompt presets
systemPresetSelect?.addEventListener("change", () => {
    const preset = systemPresetSelect.value;
    currentSystemPrompt = SYSTEM_PRESETS[preset] || SYSTEM_PRESETS[""];
});

// Export chat
exportChatBtn?.addEventListener("click", () => {
    const format = confirm("Export as Markdown? (Cancel for plain text)") ? "markdown" : "txt";
    exportChat(format);
});

// Auto-save drafts
messageInput?.addEventListener("input", () => {
    autoResize();
    if (currentConversationId) {
        inputDrafts[currentConversationId] = messageInput.value;
    }
});

// Global shortcuts
window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        invoke("show_window");
        messageInput?.focus();
    }

    // Ctrl+N = New chat
    if (e.ctrlKey && e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        resetChat();
        loadConversations();
    }

    // Ctrl+W = Delete current chat
    if (e.ctrlKey && e.key === "w") {
        e.preventDefault();
        if (currentConversationId) {
            deleteConversation(currentConversationId);
        }
    }

    // Ctrl+K = Focus search
    if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        searchInput?.focus();
    }

    // Up arrow in empty input = edit last user message
    if (e.key === "ArrowUp" && messageInput && messageInput.value === "" && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        const userMessages = messagesContainer.querySelectorAll('.message.user');
        const lastUserMsg = userMessages[userMessages.length - 1] as HTMLElement | undefined;
        if (lastUserMsg) {
            const editBtn = lastUserMsg.querySelector('[data-action="edit"]') as HTMLButtonElement;
            editBtn?.click();
        }
    }

    // Close settings modal with Escape
    if (e.key === "Escape" && settingsModalOverlay.classList.contains("active")) {
        closeSettingsModal();
    }
});

// Focus input when window shown
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        messageInput?.focus();
    }
});

// Initialize
async function init() {
    await loadApiKey();
    await loadModel();
    await loadTheme();
    await loadRTL();
    await loadSidebar();
    await loadThinkingMode();
    await loadReasoningEffort();
    await loadSearchEnabled();
    await loadSearchSettings();
    await loadConversations();
    initSearch();
    attachQuickActionListeners();

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    messageInput?.focus();
}

init();
