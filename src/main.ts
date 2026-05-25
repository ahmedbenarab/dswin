import { invoke } from "@tauri-apps/api/core";

// Declare libraries for TypeScript
declare const lucide: {
    createIcons: () => void;
};

declare const marked: {
    parse: (text: string) => string;
};

// Types
interface ChatMessage {
    role: string;
    content: string;
    timestamp: number;
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
let reasoningEffort = "high";
let sidebarVisible = true;
let isRTL = false;
let abortController: AbortController | null = null;

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
const sidebarToggleBtn = document.getElementById("sidebarToggleBtn") as HTMLButtonElement;
const stopBtn = document.getElementById("stopBtn") as HTMLButtonElement;
const sidebar = document.querySelector(".sidebar") as HTMLDivElement;

// Initialize Lucide icons
lucide.createIcons();

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
        lucide.createIcons();
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
stopBtn?.addEventListener("click", () => {
    if (abortController) {
        abortController.abort();
        abortController = null;
        hideTypingIndicator();
        isLoading = false;
        sendBtn.style.display = "flex";
        stopBtn.classList.remove("visible");
        messageInput.disabled = false;
        messageInput.focus();
    }
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
    currentModelDisplay.textContent = modelNames[currentModel] || "DeepSeek-V4";
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
        alert("Please enter an API key");
        return;
    }

    if (!key.startsWith("sk-")) {
        alert("Invalid API key format. It should start with 'sk-'");
        return;
    }

    try {
        saveApiKeyBtn.disabled = true;
        await invoke("save_api_key", { apiKey: key });
        apiKey = key;
        updateApiStatus(true);
        alert("API key saved successfully!");
    } catch (error) {
        console.error("Failed to save API key:", error);
        alert("Failed to save API key");
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
    lucide.createIcons();
}

saveApiKeyBtn?.addEventListener("click", saveApiKey);

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
        return marked.parse(text);
    } catch (error) {
        console.error("Markdown parsing error:", error);
        return escapeHtml(text);
    }
}

// Add message to UI
function addMessageToUI(text: string, role: "user" | "assistant", timestamp?: number, imageData?: string, extractedText?: string) {
    const welcomeMessage = messagesContainer.querySelector(".welcome-message");
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${role}`;

    const time = timestamp ? new Date(timestamp * 1000).toLocaleTimeString() : new Date().toLocaleTimeString();
    const iconName = role === "user" ? "user" : "bot";

    let imageHtml = "";
    let extractedTextHtml = "";
    
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

    // Render markdown for assistant messages
    const contentHtml = role === "assistant" ? renderMarkdown(text) : escapeHtml(text);

    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i data-lucide="${iconName}"></i>
        </div>
        <div>
            <div class="message-content">${contentHtml}${imageHtml}${extractedTextHtml}</div>
            <div class="message-time">${time}</div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    lucide.createIcons();
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

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
    lucide.createIcons();
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
        alert("Please configure your DeepSeek API key in Settings first!");
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
        // Build API messages: system + full history + new user message
        const apiMessages = [
            { role: "system", content: "You are a helpful AI assistant." },
            ...conversationMessages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: message },
        ];

        // Prepare request body with thinking mode if enabled
        const requestBody: any = {
            apiKey,
            model: currentModel,
            messages: apiMessages,
        };
        
        // Add thinking mode for V4 Pro
        if (currentModel === "deepseek-v4-pro" && thinkingEnabled) {
            requestBody.thinking = { type: "enabled" };
            requestBody.reasoning_effort = reasoningEffort;
        }
        
        // Call API with selected model
        const response = await invoke<string>("send_message", requestBody);

        // Check if cancelled
        if (signal.aborted) return;

        // Hide typing indicator and show response
        hideTypingIndicator();
        addMessageToUI(response, "assistant");

        // Save conversation
        await saveCurrentConversation(message, response);
    } catch (error) {
        if (signal.aborted) return;
        hideTypingIndicator();
        addMessageToUI(`Error: ${error}`, "assistant");
        console.error("API Error:", error);
    } finally {
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
async function saveCurrentConversation(userMessage: string, assistantMessage: string) {
    if (!currentConversationId) return;

    try {
        const conversations = await invoke<Conversation[]>("get_conversations");
        const conversation = conversations.find((c) => c.id === currentConversationId);

        if (conversation) {
            conversation.messages.push(
                { role: "user", content: userMessage, timestamp: getTimestamp() },
                { role: "assistant", content: assistantMessage, timestamp: getTimestamp() }
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
async function saveResponseToConversation(assistantMessage: string) {
    if (!currentConversationId || !assistantMessage) return;

    try {
        const conversations = await invoke<Conversation[]>("get_conversations");
        const conversation = conversations.find((c) => c.id === currentConversationId);

        if (conversation) {
            conversation.messages.push(
                { role: "assistant", content: assistantMessage, timestamp: getTimestamp() }
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
    
    lucide.createIcons();
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
                addMessageToUI(msg.content, msg.role as "user" | "assistant", msg.timestamp);
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
    lucide.createIcons();
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
            lucide.createIcons();
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
                        const apiMessages = [
                            { role: "system", content: "You are a helpful AI assistant. Analyze the extracted text from an image and provide insights." },
                            ...history.map(m => ({ role: m.role, content: m.content })),
                        ];
                        
                        const requestBody: any = {
                            apiKey,
                            model: currentModel,
                            messages: apiMessages,
                        };
                        
                        if (currentModel === "deepseek-v4-pro" && thinkingEnabled) {
                            requestBody.thinking = { type: "enabled" };
                            requestBody.reasoning_effort = reasoningEffort;
                        }
                        
                        const response = await invoke<string>("send_message", requestBody);
                        
                        if (signal.aborted) return;
                        
                        hideTypingIndicator();
                        addMessageToUI(response, "assistant");
                        await saveResponseToConversation(response);
                    } catch (error) {
                        if (signal.aborted) return;
                        hideTypingIndicator();
                        addMessageToUI(`Error: ${error}`, "assistant");
                    } finally {
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
            lucide.createIcons();
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
                lucide.createIcons();
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
                        const apiMessages = [
                            { role: "system", content: "You are a helpful AI assistant. Analyze the extracted text from a PDF and provide insights." },
                            ...history.map(m => ({ role: m.role, content: m.content })),
                        ];
                        
                        const requestBody: any = {
                            apiKey,
                            model: currentModel,
                            messages: apiMessages,
                        };
                        
                        if (currentModel === "deepseek-v4-pro" && thinkingEnabled) {
                            requestBody.thinking = { type: "enabled" };
                            requestBody.reasoning_effort = reasoningEffort;
                        }
                        
                        const response = await invoke<string>("send_message", requestBody);
                        
                        if (signal.aborted) return;
                        
                        hideTypingIndicator();
                        addMessageToUI(response, "assistant");
                        await saveResponseToConversation(response);
                    } catch (error) {
                        if (signal.aborted) return;
                        hideTypingIndicator();
                        addMessageToUI(`Error: ${error}`, "assistant");
                    } finally {
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
        alert("Failed to take screenshot. Please try again.");
    }
});

// Area selection overlay
function showAreaSelection(screenshotData: string) {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        z-index: 3000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: crosshair;
    `;
    
    // Create image container
    const container = document.createElement("div");
    container.style.cssText = `
        position: relative;
        max-width: 90vw;
        max-height: 80vh;
        overflow: auto;
    `;
    
    // Create image
    const img = document.createElement("img");
    img.src = `data:image/png;base64,${screenshotData}`;
    img.style.cssText = `
        max-width: 100%;
        max-height: 80vh;
        display: block;
    `;
    
    // Create selection box
    const selectionBox = document.createElement("div");
    selectionBox.style.cssText = `
        position: absolute;
        border: 2px solid #4F8CFF;
        background: rgba(79, 140, 255, 0.2);
        display: none;
        pointer-events: none;
    `;
    
    // Instructions
    const instructions = document.createElement("div");
    instructions.style.cssText = `
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 3001;
        text-align: center;
    `;
    instructions.innerHTML = `
        <strong>Screenshot captured!</strong><br>
        Click and drag to select an area, or click anywhere to capture full screen<br>
        Press Escape to cancel
    `;
    
    container.appendChild(img);
    container.appendChild(selectionBox);
    overlay.appendChild(instructions);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    
    let isDragging = false;
    let startLeft = 0;
    let startTop = 0;
    
    // Mouse down - start selection
    overlay.addEventListener("mousedown", (e) => {
        if (e.target === overlay || e.target === container || e.target === img) {
            isDragging = true;
            const rect = img.getBoundingClientRect();
            startLeft = e.clientX - rect.left;
            startTop = e.clientY - rect.top;
            
            selectionBox.style.left = startLeft + "px";
            selectionBox.style.top = startTop + "px";
            selectionBox.style.width = "0px";
            selectionBox.style.height = "0px";
            selectionBox.style.display = "block";
        }
    });
    
    // Mouse move - update selection
    overlay.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        
        const rect = img.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        
        const left = Math.min(startLeft, currentX);
        const top = Math.min(startTop, currentY);
        const width = Math.abs(currentX - startLeft);
        const height = Math.abs(currentY - startTop);
        
        selectionBox.style.left = left + "px";
        selectionBox.style.top = top + "px";
        selectionBox.style.width = width + "px";
        selectionBox.style.height = height + "px";
    });
    
    // Mouse up - finish selection
    overlay.addEventListener("mouseup", async () => {
        if (!isDragging) {
            // Click without drag - use full screenshot
            overlay.remove();
            await processScreenshot(screenshotData);
            return;
        }
        
        isDragging = false;
        
        const rect = selectionBox.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        
        // Calculate relative coordinates
        const scaleX = img.naturalWidth / imgRect.width;
        const scaleY = img.naturalHeight / imgRect.height;
        
        const x = (rect.left - imgRect.left) * scaleX;
        const y = (rect.top - imgRect.top) * scaleY;
        const width = rect.width * scaleX;
        const height = rect.height * scaleY;
        
        // Only crop if selection is large enough
        if (width > 10 && height > 10) {
            overlay.remove();
            // Crop the screenshot
            const croppedData = await cropScreenshot(screenshotData, x, y, width, height);
            await processScreenshot(croppedData);
        } else {
            // Selection too small, use full screenshot
            overlay.remove();
            await processScreenshot(screenshotData);
        }
    });
    
    // Escape to cancel
    const escapeHandler = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            overlay.remove();
            document.removeEventListener("keydown", escapeHandler);
        }
    };
    document.addEventListener("keydown", escapeHandler);
}

// Crop screenshot
async function cropScreenshot(base64Data: string, x: number, y: number, width: number, height: number): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
            resolve(canvas.toDataURL("image/png").split(",")[1]);
        };
        img.src = `data:image/png;base64,${base64Data}`;
    });
}

// Process screenshot - extract text with OCR and send to AI
async function processScreenshot(screenshotData: string) {
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
                    <span>Extracting text from screenshot...</span>
                </div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(loadingDiv);
    lucide.createIcons();
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
        // Extract text using OCR
        const extractedText = await invoke<string>("extract_text_from_image", { base64Data: screenshotData });
        
        // Remove loading message
        loadingDiv.remove();
        
        // Add message with both image and extracted text
        const prompt = "I've taken a screenshot. Here's what I found:";
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
                const apiMessages = [
                    { role: "system", content: "You are a helpful AI assistant. Analyze the extracted text from a screenshot and provide insights." },
                    ...history.map(m => ({ role: m.role, content: m.content })),
                ];
                
                const requestBody: any = {
                    apiKey,
                    model: currentModel,
                    messages: apiMessages,
                };
                
                // Add thinking mode for V4 Pro
                if (currentModel === "deepseek-v4-pro" && thinkingEnabled) {
                    requestBody.thinking = { type: "enabled" };
                    requestBody.reasoning_effort = reasoningEffort;
                }
                
                const response = await invoke<string>("send_message", requestBody);
                
                if (signal.aborted) return;
                
                hideTypingIndicator();
                addMessageToUI(response, "assistant");
                
                // Update conversation with response
                await saveResponseToConversation(response);
            } catch (error) {
                if (signal.aborted) return;
                hideTypingIndicator();
                addMessageToUI(`Error: ${error}`, "assistant");
            } finally {
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

// Global shortcut
window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        invoke("show_window");
        messageInput?.focus();
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
    await loadConversations();
    attachQuickActionListeners();
    messageInput?.focus();
}

init();
