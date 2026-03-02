const API_BASE_URL = '/api';
let currentSessionId = null;

// Initialize
window.onload = async () => {
    // Load preferred theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Session Management: Check if user is returning
    const savedSessionId = localStorage.getItem('lucy_session_id');

    if (savedSessionId) {
        currentSessionId = savedSessionId;
        console.log("Returning user found. Session:", currentSessionId);
        await loadHistory(currentSessionId);
    } else {
        await createNewSession();
    }
};


async function createNewSession() {
    try {
        const response = await fetch(`${API_BASE_URL}/session`, { method: 'POST' });
        const data = await response.json();
        if (data.status === 'success') {
            currentSessionId = data.session_id;
            localStorage.setItem('lucy_session_id', currentSessionId); // Save to browser
            console.log("New Session Initialized:", currentSessionId);
        }
    } catch (error) {
        console.error("Connection Error:", error);
    }
}

async function loadHistory(sessionId) {
    try {
        const response = await fetch(`${API_BASE_URL}/history/${sessionId}`);
        const data = await response.json();

        // If history exists and has messages
        if (data.status === 'success' && data.history.length > 0) {

            // Hide the "Ready to Chat" empty state
            const emptyState = document.getElementById('emptyState');
            if (emptyState) emptyState.style.display = 'none';

            // Show the "Welcome Back" banner
            const banner = document.getElementById('sessionBanner');
            banner.classList.remove('d-none');
            banner.classList.add('d-flex');

            // Render previous messages
            data.history.forEach(msg => {
                // Ignore system prompts, only show user and assistant
                if (msg.role !== 'system') {
                    // Our appending function expects 'user' or 'bot'
                    const sender = msg.role === 'user' ? 'user' : 'bot';
                    appendMessage(sender, msg.content);
                }
            });

            // Make the upload button look like it's already active
            const uploadBtn = document.getElementById('uploadBtn');
            uploadBtn.innerHTML = '<i class="fas fa-check"></i> Document Context Active';
        } else if (data.status === 'error') {
            // If the session was lost on the server, create a new one
            await createNewSession();
        }
    } catch (e) {
        console.error("Error loading history", e);
        await createNewSession();
    }
}

// Update clearSession to also wipe LocalStorage
async function clearSession() {
    if (!confirm("Are you sure? This will delete the document context and chat history to start a fresh session.")) return;

    try {
        await fetch(`${API_BASE_URL}/clear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: currentSessionId })
        });

        // Wipe from browser memory!
        localStorage.removeItem('lucy_session_id');

        // Reload page to start completely fresh
        window.location.reload();
    } catch (e) {
        console.error(e);
    }
};

/* ================= THEME CHANGER ================= */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    // Update bootstrap's native theme handler
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (theme === 'dark') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun'); // Show sun when in dark mode
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon'); // Show moon when in light mode
    }
}

/* ================= FILE UPLOAD & DRAG/DROP ================= */
function initDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('pdfFile');

    // Prevent default browser behavior
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Add glowing effect on drag over
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    // Remove glowing effect when dragged away
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    // Handle dropped files
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length) {
            fileInput.files = files; // Assign dropped file to the hidden input
            handleFileSelect();      // Trigger UI change
        }
    }, false);
}

function handleFileSelect() {
    const fileInput = document.getElementById('pdfFile');
    const uploadText = document.getElementById('uploadText');
    const filenameDisplay = document.getElementById('filenameDisplay');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadIcon = document.getElementById('uploadIcon');

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];

        // Validate it's a PDF
        if (file.type !== "application/pdf") {
            filenameDisplay.innerHTML = '<span class="text-danger">Error: Only PDF allowed!</span>';
            return;
        }

        uploadIcon.classList.replace('fa-cloud-upload-alt', 'fa-file-pdf');
        uploadText.innerText = "Ready to Process";
        filenameDisplay.innerText = file.name;
        filenameDisplay.classList.add('text-success');
        uploadBtn.disabled = false;
    }
}


function handleUploadError(msg) {
    const uploadBtn = document.getElementById('uploadBtn');
    const statusDiv = document.getElementById('uploadStatus');
    const progressContainer = document.getElementById('progressBar');

    progressContainer.style.display = 'none';
    statusDiv.innerHTML = `<span class="text-danger">${msg}</span>`;
    uploadBtn.innerHTML = 'Try Again';
    uploadBtn.disabled = false;
}

/* ================= CHAT LOGIC ================= */
function handleKeyPress(event) {
    if (event.key === 'Enter') sendMessage();
}

async function sendMessage() {
    const inputField = document.getElementById('userInput');
    const message = inputField.value.trim();
    if (!message || !currentSessionId) return;

    // Clear Empty State
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.style.display = 'none';

    // Disable input
    inputField.value = '';
    inputField.disabled = true;

    // 1. Show User Message
    appendMessage('user', message);

    // 2. Show Typing Indicator
    const typingId = 'typing-' + Date.now();
    appendMessage('bot', 'typing', typingId); // "typing" is a special keyword

    try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: currentSessionId,
                message: message
            })
        });
        const data = await response.json();

        // Remove typing indicator
        document.getElementById(typingId)?.remove();

        // 3. Append Bot Response
        if (data.status === 'success') {
            appendMessage('bot', data.answer);
        } else {
            appendMessage('bot', '⚠️ Error: ' + data.message);
        }

    } catch (error) {
        document.getElementById(typingId)?.remove();
        appendMessage('bot', '⚠️ Error: Could not reach the server.');
    } finally {
        inputField.disabled = false;
        inputField.focus();
    }
}

// Rewritten Append function to align Left/Right properly
function appendMessage(sender, text, id = null) {
    const chatBox = document.getElementById('chatBox');

    // Create the outer row (Handles alignment)
    const rowDiv = document.createElement('div');
    rowDiv.classList.add('message-row', sender);
    if (id) rowDiv.id = id;

    // Create the inner bubble
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-bubble');

    if (sender === 'user') {
        msgDiv.classList.add('user-message');
        msgDiv.innerText = text;
    } else {
        msgDiv.classList.add('bot-message');

        // Handle Typing Animation Keyword
        if (text === 'typing') {
            msgDiv.innerHTML = `
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>`;
        } else {
            // Parse Markdown safely
            msgDiv.innerHTML = marked.parse(text);
        }
    }

    rowDiv.appendChild(msgDiv);
    chatBox.appendChild(rowDiv);

    // Auto-scroll to bottom smoothly
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
}

async function clearSession() {
    if (!confirm("Are you sure? This will delete the document context and chat history.")) return;

    try {
        await fetch(`${API_BASE_URL}/clear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: currentSessionId })
        });
        window.location.reload();
    } catch (e) {
        console.error("Failed to clear session:", e);
    }
}


async function uploadPDF() {
    const fileInput = document.getElementById('pdfFile');
    const uploadBtn = document.getElementById('uploadBtn');
    const statusDiv = document.getElementById('uploadStatus');
    const progressBar = document.getElementById('progressBar').firstElementChild;
    const progressContainer = document.getElementById('progressBar');

    if (!currentSessionId) {
        statusDiv.innerHTML = '<span class="text-danger">Error: No active session. Refresh page.</span>';
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', currentSessionId);

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    progressContainer.style.display = 'flex';
    progressBar.style.width = '30%';

    try {
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData
        });

        progressBar.style.width = '80%';
        const data = await response.json();

        if (data.status === 'success') {
            progressBar.style.width = '100%';
            progressBar.classList.replace('bg-primary', 'bg-success');
            statusDiv.innerHTML = `<span class="text-success"><i class="fas fa-check-circle"></i> Document indexed!</span>`;
            uploadBtn.innerHTML = '<i class="fas fa-check"></i> Processed';

            setTimeout(() => { progressContainer.style.display = 'none'; }, 2000);
            document.getElementById('emptyState').style.display = 'none';
            appendMessage('bot', "I've successfully read the document. What would you like to know?");

            if (window.innerWidth < 768) {
                const sidebarMenu = document.getElementById('sidebarMenu');
                const bsOffcanvas = bootstrap.Offcanvas.getInstance(sidebarMenu) || new bootstrap.Offcanvas(sidebarMenu);
                bsOffcanvas.hide();
            }

        } else {
            handleUploadError(data.message);
        }
    } catch (error) {
        handleUploadError("Server connection failed.");
    }
}