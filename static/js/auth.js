/**
 * auth.js — LittleVision Frontend Logic
 * Toast system, form handlers, password strength, verify code, chat (mic + upload + send).
 * Theme: auto via prefers-color-scheme (no toggle).
 */

// ── Toast Notification System ───────────────────────────────────────────────

const ToastManager = {
    container: null,

    init() {
        if (this.container) return;
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    },

    show(message, type = 'info', duration = 3500) {
        this.init();
        const icons = { success: '✓', error: '✕', info: 'ℹ' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span style="font-size:1.1em;font-weight:700">${icons[type] || 'ℹ'}</span>
            <span>${message}</span>
        `;
        this.container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-exit');
            toast.addEventListener('animationend', () => toast.remove());
        }, duration);
    },

    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    info(msg) { this.show(msg, 'info'); },
};


// ── Form Submission Helper ──────────────────────────────────────────────────

async function submitForm(formEl, url, options = {}) {
    const btn = formEl.querySelector('button[type="submit"]');
    if (btn) btn.classList.add('loading');

    try {
        const formData = new FormData(formEl);
        const response = await fetch(url, { method: 'POST', body: formData });
        const data = await response.json();

        if (data.success) {
            if (options.successMsg) ToastManager.success(options.successMsg);
            if (data.redirect) {
                setTimeout(() => { window.location.href = data.redirect; }, options.delay || 300);
            }
            if (data.message) ToastManager.success(data.message);
        } else {
            (data.errors || ['Something went wrong.']).forEach(e => ToastManager.error(e));
        }
        return data;
    } catch {
        ToastManager.error('Network error. Please try again.');
        return { success: false };
    } finally {
        if (btn) btn.classList.remove('loading');
    }
}


// ── Password Strength Meter ─────────────────────────────────────────────────

function evaluatePasswordStrength(password) {
    let score = 0;
    const checks = {
        length: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{}|;':",.\/<>?]/.test(password),
    };
    Object.values(checks).forEach(v => { if (v) score++; });
    let level = 'weak';
    if (score >= 5) level = 'strong';
    else if (score >= 4) level = 'good';
    else if (score >= 3) level = 'fair';
    return { score, level, checks };
}

function initPasswordStrength(inputSel, meterSel, checksSel) {
    const input = document.querySelector(inputSel);
    const meter = document.querySelector(meterSel);
    const checksEl = document.querySelector(checksSel);
    if (!input || !meter) return;

    const labels = {
        length: '8+ characters', upper: 'Uppercase', lower: 'Lowercase',
        number: 'Number', special: 'Special character',
    };

    input.addEventListener('input', () => {
        const { level, checks } = evaluatePasswordStrength(input.value);
        meter.className = 'strength-bar';
        if (input.value.length > 0) meter.classList.add(`strength-${level}`);
        if (checksEl) {
            checksEl.innerHTML = Object.entries(checks).map(([k, ok]) =>
                `<span class="inline-flex items-center gap-1 text-xs ${ok ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}">
                    ${ok ? '✓' : '○'} ${labels[k]}
                </span>`
            ).join('');
        }
    });
}


// ── Password Toggle ─────────────────────────────────────────────────────────

function initPasswordToggle(toggleSel, inputSel) {
    const toggle = document.querySelector(toggleSel);
    const input = document.querySelector(inputSel);
    if (!toggle || !input) return;

    const eyeOpen = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
    const eyeClosed = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18"/></svg>`;

    toggle.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        toggle.innerHTML = show ? eyeClosed : eyeOpen;
    });
}


// ── Verify Code Inputs ──────────────────────────────────────────────────────

function initCodeInputs() {
    const inputs = document.querySelectorAll('.code-input');
    if (!inputs.length) return;

    inputs.forEach((input, idx) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && idx < inputs.length - 1) inputs[idx + 1].focus();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && idx > 0) inputs[idx - 1].focus();
        });
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const paste = (e.clipboardData || window.clipboardData).getData('text').trim();
            if (/^\d{6}$/.test(paste)) {
                inputs.forEach((inp, i) => { inp.value = paste[i] || ''; });
                inputs[5].focus();
            }
        });
    });
    inputs[0].focus();
}

function getCodeValue() {
    return Array.from(document.querySelectorAll('.code-input')).map(i => i.value).join('');
}


// ── Welcome Message ─────────────────────────────────────────────────────────

function showWelcome(username) {
    const overlay = document.createElement('div');
    overlay.className = 'welcome-overlay';
    overlay.innerHTML = `<div class="welcome-text">Welcome, ${username} 👋</div>`;
    document.body.appendChild(overlay);
    setTimeout(() => {
        overlay.style.animation = 'fadeOut 0.4s ease forwards';
        overlay.addEventListener('animationend', () => overlay.remove());
    }, 3000);
}


// ── Chat: Mic / Voice Recording ─────────────────────────────────────────────

class VoiceRecorder {
    constructor(inputEl, micBtn) {
        this.inputEl = inputEl;
        this.micBtn = micBtn;
        this.recognition = null;
        this.recording = false;

        // Use Web Speech API (SpeechRecognition) for speech-to-text
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                let transcript = '';
                for (let i = 0; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript;
                }
                this.inputEl.value = transcript;
                this.autoResize();
            };

            this.recognition.onend = () => this.stopUI();
            this.recognition.onerror = (e) => {
                this.stopUI();
                if (e.error === 'not-allowed') {
                    ToastManager.error('Microphone access denied. Please allow in browser settings.');
                } else if (e.error !== 'aborted') {
                    ToastManager.error('Voice recognition error. Please try again.');
                }
            };
        }
    }

    toggle() {
        if (!this.recognition) {
            ToastManager.error('Voice recognition is not supported in this browser.');
            return;
        }
        if (this.recording) {
            this.recognition.stop();
        } else {
            this.recognition.start();
            this.recording = true;
            this.micBtn.classList.add('recording');
            this.micBtn.title = 'Stop recording';
        }
    }

    stopUI() {
        this.recording = false;
        this.micBtn.classList.remove('recording');
        this.micBtn.title = 'Voice input';
    }

    autoResize() {
        this.inputEl.style.height = 'auto';
        this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + 'px';
    }
}


// ── Chat: Image Upload ──────────────────────────────────────────────────────

class ImageUploader {
    constructor(uploadBtn, previewBar) {
        this.uploadBtn = uploadBtn;
        this.previewBar = previewBar;
        this.files = [];
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.jpg,.jpeg,.png';
        this.fileInput.multiple = false;
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);

        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', () => this.handleFiles());
    }

    handleFiles() {
        const file = this.fileInput.files[0];
        if (!file) return;

        const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowed.includes(file.type)) {
            ToastManager.error('Only JPG and PNG files are allowed.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            ToastManager.error('File too large. Max 10MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.files.push({ file, dataUrl: e.target.result });
            this.renderPreviews();
        };
        reader.readAsDataURL(file);
        this.fileInput.value = '';
    }

    renderPreviews() {
        this.previewBar.innerHTML = '';
        this.files.forEach((item, idx) => {
            const el = document.createElement('div');
            el.className = 'upload-preview-item';
            el.innerHTML = `
                <img src="${item.dataUrl}" alt="Upload preview">
                <button class="upload-preview-remove" data-idx="${idx}" title="Remove">✕</button>
            `;
            el.querySelector('.upload-preview-remove').addEventListener('click', () => {
                this.files.splice(idx, 1);
                this.renderPreviews();
            });
            this.previewBar.appendChild(el);
        });
    }

    getAndClear() {
        const images = this.files.map(f => f.dataUrl);
        this.files = [];
        this.previewBar.innerHTML = '';
        return images;
    }

    /** Add an image directly (used by CameraCapture) */
    addImage(dataUrl) {
        this.files.push({ file: null, dataUrl });
        this.renderPreviews();
    }
}


// ── Chat: Camera Capture ────────────────────────────────────────────────────

class CameraCapture {
    constructor(uploader) {
        this.uploader = uploader;
        this.stream = null;
        this.capturedDataUrl = null;

        // DOM elements
        this.modal         = document.getElementById('cameraModal');
        this.video         = document.getElementById('cameraVideo');
        this.canvas        = document.getElementById('cameraCanvas');
        this.capturedImg   = document.getElementById('cameraCapturedImg');
        this.liveControls  = document.getElementById('cameraLiveControls');
        this.confirmControls = document.getElementById('cameraConfirmControls');

        if (!this.modal) return;

        // Bind buttons
        document.getElementById('cameraCloseBtn').addEventListener('click', () => this.close());
        document.getElementById('cameraShutterBtn').addEventListener('click', () => this.capture());
        document.getElementById('cameraRetakeBtn').addEventListener('click', () => this.retake());
        document.getElementById('cameraConfirmBtn').addEventListener('click', () => this.confirm());

        // Close on backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        // Close on Escape key
        this._onKeyDown = (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) this.close();
        };
        document.addEventListener('keydown', this._onKeyDown);
    }

    /** Open camera and show live preview */
    async open() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            ToastManager.error('Camera is not supported in this browser.');
            return;
        }

        // Reset UI to live mode
        this._showLiveMode();

        try {
            // Prefer rear camera on mobile, fallback to any camera
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
                audio: false,
            });
        } catch (err) {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                ToastManager.error('Camera permission denied. Please allow camera access in browser settings.');
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                ToastManager.error('No camera found on this device.');
            } else {
                ToastManager.error('Unable to access camera. Please try again.');
            }
            return;
        }

        this.video.srcObject = this.stream;
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';  // prevent scroll behind modal
    }

    /** Capture the current video frame */
    capture() {
        const vw = this.video.videoWidth;
        const vh = this.video.videoHeight;
        this.canvas.width = vw;
        this.canvas.height = vh;

        const ctx = this.canvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0, vw, vh);
        this.capturedDataUrl = this.canvas.toDataURL('image/png');

        // Show captured image, hide video
        this.capturedImg.src = this.capturedDataUrl;
        this.capturedImg.style.display = 'block';
        this.video.style.display = 'none';

        // Swap controls
        this.liveControls.style.display = 'none';
        this.confirmControls.style.display = 'flex';
    }

    /** Retake — go back to live video */
    retake() {
        this.capturedDataUrl = null;
        this._showLiveMode();
    }

    /** Confirm — push image to uploader and close */
    confirm() {
        if (this.capturedDataUrl) {
            this.uploader.addImage(this.capturedDataUrl);
        }
        this.close();
        ToastManager.success('Photo added! Click Send to share it.');
    }

    /** Close modal and stop camera */
    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this._stopStream();
        this.capturedDataUrl = null;
    }

    /* ── Private helpers ── */

    _showLiveMode() {
        this.video.style.display = 'block';
        this.capturedImg.style.display = 'none';
        this.liveControls.style.display = 'flex';
        this.confirmControls.style.display = 'none';
    }

    _stopStream() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.video.srcObject = null;
    }
}


// ── Chat: Send & Display ────────────────────────────────────────────────────

class ChatUI {
    constructor() {
        this.messagesEl = document.getElementById('chatMessages');
        this.innerEl = document.getElementById('chatMessagesInner');
        this.emptyEl = document.getElementById('chatEmpty');
        this.inputEl = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.micBtn = document.getElementById('voiceBtn');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.previewBar = document.getElementById('uploadPreviewBar');

        if (!this.inputEl) return;

        this.voice = new VoiceRecorder(this.inputEl, this.micBtn);
        this.uploader = new ImageUploader(this.uploadBtn, this.previewBar);

        // Camera capture
        this.cameraBtn = document.getElementById('cameraBtn');
        this.camera = new CameraCapture(this.uploader);
        if (this.cameraBtn) {
            this.cameraBtn.addEventListener('click', () => this.camera.open());
        }

        // Send
        this.sendBtn.addEventListener('click', () => this.send());
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.send();
            }
        });

        // Auto-resize textarea
        this.inputEl.addEventListener('input', () => this.autoResize());

        // Mic
        this.micBtn.addEventListener('click', () => this.voice.toggle());

        // Suggestion chips
        document.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.inputEl.value = chip.textContent.trim();
                this.send();
            });
        });
    }

    autoResize() {
        this.inputEl.style.height = 'auto';
        this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + 'px';
    }

    send() {
        const text = this.inputEl.value.trim();
        const images = this.uploader.getAndClear();

        if (!text && images.length === 0) return;

        // Hide empty state
        if (this.emptyEl) this.emptyEl.style.display = 'none';

        // Add user message
        if (images.length > 0) {
            images.forEach(dataUrl => {
                this.addMessage('', 'user', dataUrl);
            });
        }
        if (text) {
            this.addMessage(text, 'user');
        }

        // Clear
        this.inputEl.value = '';
        this.inputEl.style.height = 'auto';

        // Bot reply (placeholder)
        setTimeout(() => {
            this.addMessage("Thanks for your message! LittleVision AI is coming soon. 🚀", 'bot');
        }, 700);
    }

    addMessage(text, sender = 'user', imageDataUrl = null) {
        const bubble = document.createElement('div');
        bubble.className = sender === 'user' ? 'msg-user' : 'msg-bot';

        if (imageDataUrl) {
            const img = document.createElement('img');
            img.src = imageDataUrl;
            img.className = 'msg-image';
            img.alt = 'Uploaded image';
            bubble.appendChild(img);
        }

        if (text) {
            const span = document.createElement('span');
            span.textContent = text;
            bubble.appendChild(span);
        }

        this.innerEl.appendChild(bubble);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
}


// ── Theme Management ────────────────────────────────────────────────────────

function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    
    // Load initial theme from localStorage, or fallback to system preference
    const isDark = localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
    if (isDark) {
        document.documentElement.classList.add('dark');
        if (themeToggle) themeToggle.checked = true;
    } else {
        document.documentElement.classList.remove('dark');
        if (themeToggle) themeToggle.checked = false;
    }

    if (themeToggle) {
        themeToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.documentElement.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('theme', 'light');
            }
        });
    }
}
initThemeToggle();

// ── DOMContentLoaded ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle(); // ensure events are bound if DOM ready missed

    // --- Login ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        initPasswordToggle('#togglePassword', '#password');
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitForm(loginForm, '/login', { successMsg: 'Login successful!' });
        });
    }

    // --- Signup ---
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        initPasswordStrength('#password', '#passwordMeter', '#passwordChecks');
        initPasswordToggle('#togglePassword', '#password');
        initPasswordToggle('#toggleConfirmPassword', '#confirm_password');
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitForm(signupForm, '/signup', { successMsg: 'Account created!' });
        });
    }

    // --- Forgot Password ---
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitForm(forgotForm, '/forgot-password', { successMsg: 'Reset code sent!' });
        });
    }

    // --- Verify Code ---
    const verifyForm = document.getElementById('verifyForm');
    if (verifyForm) {
        initCodeInputs();
        verifyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const hidden = document.getElementById('codeHidden');
            if (hidden) hidden.value = getCodeValue();
            submitForm(verifyForm, '/verify-code', { successMsg: 'Code verified!' });
        });
    }

    // --- Resend Code ---
    const resendBtn = document.getElementById('resendCode');
    if (resendBtn) {
        resendBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            resendBtn.style.pointerEvents = 'none';
            resendBtn.textContent = 'Sending...';
            try {
                const res = await fetch('/resend-code', { method: 'POST' });
                const data = await res.json();
                if (data.success) ToastManager.success(data.message || 'Code resent!');
                else (data.errors || ['Failed to resend.']).forEach(e => ToastManager.error(e));
            } catch { ToastManager.error('Network error.'); }
            setTimeout(() => {
                resendBtn.style.pointerEvents = 'auto';
                resendBtn.textContent = 'Resend code';
            }, 30000);
        });
    }

    // --- Reset Password ---
    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
        initPasswordStrength('#password', '#passwordMeter', '#passwordChecks');
        initPasswordToggle('#togglePassword', '#password');
        initPasswordToggle('#toggleConfirmPassword', '#confirm_password');
        resetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitForm(resetForm, '/reset-password', { successMsg: 'Password reset successful!' });
        });
    }

    // --- Dashboard Welcome ---
    const welcomeEl = document.getElementById('welcomeUser');
    if (welcomeEl) {
        const username = welcomeEl.dataset.username;
        if (username) showWelcome(username);
    }

    // --- Dashboard Chat ---
    if (document.getElementById('chatInput')) {
        new ChatUI();
    }

    // --- User Dropdown ---
    const menuBtn = document.getElementById('userMenuBtn');
    const dropdown = document.getElementById('userDropdown');
    if (menuBtn && dropdown) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', () => dropdown.classList.add('hidden'));
    }
});
