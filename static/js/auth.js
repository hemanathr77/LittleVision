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


// ── (VoiceRecorder removed — LiveKit-based voice is in ChatUI) ──────────────


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

        // Voice Overlay Elements
        this.voiceOverlay = document.getElementById('voice-overlay');
        this.closeVoiceBtn = document.getElementById('closeVoiceBtn');
        this.voiceOrb = document.querySelector('.ai-orb');
        this.voiceStatus = document.getElementById('voiceStatus');
        this.liveTranscript = document.getElementById('live-transcript'); // <-- NEW
        this.stopSpeechBtn = document.getElementById('stopSpeechBtn');

        if (!this.inputEl) return;

        // State variables
        this.voiceModeActive = false;
        this.currentConversationId = null;
        
        // Sidebar State
        this.sidebarHistory = document.getElementById('sidebarHistory');
        const newChatBtn = document.getElementById('newChatBtn');
        if (newChatBtn) newChatBtn.addEventListener('click', () => this.startNewChat());
        
        if (this.sidebarHistory) {
            this.sidebarHistory.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.delete-chat-btn');
                if (deleteBtn) {
                    e.stopPropagation();
                    this.deleteConversation(deleteBtn.dataset.id);
                    return;
                }
                const btn = e.target.closest('.history-item');
                if (btn) this.loadConversation(btn.dataset.id);
            });
        }
        
        // Mobile sidebar toggle
        const mobileSidebarBtn = document.getElementById('mobileSidebarBtn');
        const chatSidebar = document.getElementById('chatSidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        const toggleSidebar = () => {
             if(chatSidebar) chatSidebar.classList.toggle('-translate-x-full');
             if(sidebarOverlay) sidebarOverlay.classList.toggle('hidden');
        };
        
        if (mobileSidebarBtn) mobileSidebarBtn.addEventListener('click', toggleSidebar);
        if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);
        
        // LiveKit State
        this.room = null;
        this.livekitToken = null;
        this.livekitUrl = null;
        this.localMicTrack = null;

        // ── Web Speech API setup (for live transcription) ───────────────────
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'en-US';
            this.recognition.interimResults = true; // live transcription!
            this.recognition.continuous = false;    // stop when user stops speaking

            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                
                // Show in the overlay's transcript area
                if (this.liveTranscript) {
                    this.liveTranscript.textContent = (finalTranscript || interimTranscript).trim();
                }

                // Append nicely to inputEl
                if (finalTranscript) {
                    const currentVal = this.inputEl.value.trim();
                    this.inputEl.value = currentVal ? `${currentVal} ${finalTranscript}` : finalTranscript;
                } else if (interimTranscript) {
                    const tempVal = this.inputEl.value.replace(/\[.*\]$/, '').trim(); 
                    this.inputEl.value = tempVal ? `${tempVal} [${interimTranscript}]` : `[${interimTranscript}]`;
                }

                this.autoResize();
            };

            this.recognition.onend = () => {
                if (this.voiceModeActive) {
                    // Clean up interim tags
                    this.inputEl.value = this.inputEl.value.replace(/\[.*\]$/, '').trim();
                    
                    if (this.inputEl.value) {
                        // User spoke something -> auto send and switch to processing
                        this.setVoiceState('thinking');
                        this.send(true); 
                    } else {
                        // Restart recognition if nothing was heard yet to keep trying
                        try { this.recognition.start(); } catch(e) {}
                    }
                }
            };
            
            this.recognition.onerror = (e) => {
                if(e.error === 'not-allowed') {
                    ToastManager.error('Microphone access denied.');
                    this.closeVoiceMode();
                }
            };
        } else {
            this.recognition = null;
            console.warn('Web Speech API not supported in this browser for transcription.');
        }

        // Pre-load voices for speech synthesis
        if (window.speechSynthesis) {
            window.speechSynthesis.getVoices();
            window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
        }

        this.uploader = new ImageUploader(this.uploadBtn, this.previewBar);

        // Camera capture
        this.cameraBtn = document.getElementById('cameraBtn');
        this.camera = new CameraCapture(this.uploader);
        if (this.cameraBtn) {
            this.cameraBtn.addEventListener('click', () => this.camera.open());
        }

        // Event Listeners
        this.sendBtn.addEventListener('click', () => this.send(false));
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // Clean up interim markers before sending
                this.inputEl.value = this.inputEl.value.replace(/\[.*\]$/, '').trim();
                // If voice mode is active, tell AI to speak reply
                this.send(this.voiceModeActive);
            }
        });
        this.inputEl.addEventListener('input', () => this.autoResize());

        // Voice Overlay Triggers
        this.micBtn.addEventListener('click', () => this.openVoiceMode());
        if (this.closeVoiceBtn) {
            this.closeVoiceBtn.addEventListener('click', () => this.closeVoiceMode());
        }
        
        // Stop Speaking button
        if (this.stopSpeechBtn) {
            this.stopSpeechBtn.addEventListener('click', () => {
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                this.stopSpeechBtn.classList.add('hidden');
                // Return to listening state if overlay is open
                if (this.voiceModeActive) this.setVoiceState('listening');
            });
        }

        document.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.inputEl.value = chip.textContent.trim();
                this.send(false);
            });
        });
    }

    // ── LiveKit Initialization ──────────────────────────────────────────────

    async ensureLiveKitReady() {
        if (this.room && this.room.state === 'connected') return true;

        try {
            const res = await fetch('/livekit-token');
            const data = await res.json();
            if (!data.success || !data.token || !data.url) {
                ToastManager.error('Failed to get Voice token.');
                return false;
            }
            this.livekitToken = data.token;
            this.livekitUrl = data.url;

            if (typeof LivekitClient === 'undefined') {
                ToastManager.error('Voice library not loaded. Refresh page.');
                return false;
            }

            this.room = new LivekitClient.Room({ adaptiveStream: true, dynacast: true });
            await this.room.connect(this.livekitUrl, this.livekitToken);
            console.log('✅ Connected to LiveKit room');
            return true;
        } catch (err) {
            console.error('LiveKit config error:', err);
            return false;
        }
    }

    // ── Voice Mode UI Logic ─────────────────────────────────────────────────

    async openVoiceMode() {
        if (this.voiceModeActive) {
            this.closeVoiceMode();
            return;
        }
        
        // Show overlay immediately
        this.voiceOverlay.classList.remove('hidden');
        if (this.liveTranscript) this.liveTranscript.textContent = ''; // clear previous dictation
        this.setVoiceState('listening');
        this.voiceModeActive = true;
        
        // Start Web Speech Transcription
        if (this.recognition) {
            try { this.recognition.start(); } catch (e) {}
        }
        
        // Connect LiveKit and publish mic
        const ready = await this.ensureLiveKitReady();
        if (ready) {
            try {
                this.localMicTrack = await LivekitClient.createLocalAudioTrack({
                    echoCancellation: true,
                    noiseSuppression: true,
                });
                await this.room.localParticipant.publishTrack(this.localMicTrack);
                console.log('🎤 Mic track published to LiveKit');
            } catch (err) {
                console.error("Mic publish error:", err);
                // Non-fatal, they can still use Web Speech API fallback
            }
        }
    }

    closeVoiceMode() {
        this.voiceModeActive = false;
        this.voiceOverlay.classList.add('hidden');
        this.setVoiceState('off');
        this.stopSpeechBtn.classList.add('hidden');
        
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        
        if (this.recognition) {
            try { this.recognition.stop(); } catch (e) {}
        }
        
        // Stop LiveKit Mic
        if (this.localMicTrack) {
            try {
                this.room.localParticipant.unpublishTrack(this.localMicTrack);
                this.localMicTrack.stop();
                this.localMicTrack = null;
            } catch(e) {}
        }
    }

    setVoiceState(state) {
        if (!this.voiceOrb || !this.voiceStatus) return;
        
        // Reset classes
        this.voiceOrb.className = 'ai-orb';
        this.stopSpeechBtn.classList.add('hidden');
        
        switch (state) {
            case 'listening':
                this.voiceOrb.classList.add('listening');
                this.voiceStatus.textContent = 'Listening...';
                break;
            case 'thinking':
                this.voiceOrb.classList.add('thinking');
                this.voiceStatus.textContent = 'Thinking...';
                break;
            case 'speaking':
                this.voiceOrb.classList.add('speaking');
                this.voiceStatus.textContent = '';
                this.stopSpeechBtn.classList.remove('hidden');
                break;
            default:
                this.voiceStatus.textContent = '';
                break;
        }
    }

    // ── Message Sending & AI ────────────────────────────────────────────────

    autoResize() {
        this.inputEl.style.height = 'auto';
        this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + 'px';
    }

    send(forceVoice = false) {
        // Clean interim tags
        this.inputEl.value = this.inputEl.value.replace(/\[.*\]$/, '').trim();
        const text = this.inputEl.value.trim();
        const images = this.uploader.getAndClear();

        if (!text && images.length === 0) return;

        if (this.emptyEl) this.emptyEl.style.display = 'none';

        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (images.length > 0) {
            images.forEach(dataUrl => this.addMessage('', 'user', dataUrl, currentTime));
        }
        if (text) {
            this.addMessage(text, 'user', null, currentTime);
        }

        this.inputEl.value = '';
        this.inputEl.style.height = 'auto';
        
        // Intercept Voice Mode state
        if (this.voiceModeActive) {
            this.setVoiceState('thinking');
        }

        if (text) {
            const isVoice = forceVoice || this.voiceModeActive;
            this.fetchAIResponse(text, isVoice);
        } else if (images.length > 0) {
            this.addMessage("Image uploaded successfully.", 'bot');
            if (this.voiceModeActive) this.setVoiceState('listening');
        }
    }

    async fetchAIResponse(text, fromVoice = false) {
        try {
            const res = await fetch('/ai-response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, conversation_id: this.currentConversationId })
            });
            const data = await res.json();
            
            if (data.success && data.response) {
                // Update Conversation ID and instantly render it if it's a new chat
                this.currentConversationId = data.conversation_id;
                
                // Show AI message with typing animation
                await this.addMessageDynamic(data.response, data.ai_message_time);
                
                if (fromVoice) {
                    // USER REQ: "AI responding -> close overlay"
                    this.closeVoiceMode();
                    this.speak(data.response);
                } else {
                    if (this.voiceModeActive) this.closeVoiceMode();
                }
            } else {
                ToastManager.error(data.error || 'Failed to get AI response');
                if (this.voiceModeActive) this.setVoiceState('listening');
            }
        } catch (err) {
            ToastManager.error('Network error while asking AI.');
            if (this.voiceModeActive) this.setVoiceState('listening');
            console.error(err);
        }
    }

    speak(text) {
        if (!window.speechSynthesis) {
            if (this.voiceModeActive) this.setVoiceState('listening');
            return;
        }
        
        window.speechSynthesis.cancel();
        
        const cleanText = text.replace(/[*_#`~]+/g, '').replace(/[\u{1F600}-\u{1F64F}]/gu, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'en-US';
        utterance.rate = 1;
        utterance.pitch = 1.1;

        const voices = window.speechSynthesis.getVoices();
        const femaleVoice = voices.find(v => v.name.includes('Google UK English Female')) 
            || voices.find(v => v.name.includes('Female')) 
            || voices.find(v => v.name.includes('Samantha')) 
            || voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'));

        if (femaleVoice) utterance.voice = femaleVoice;
        
        utterance.onend = () => {
            if (this.voiceModeActive) this.setVoiceState('listening');
        };
        
        utterance.onerror = () => {
            if (this.voiceModeActive) this.setVoiceState('listening');
        };

        window.speechSynthesis.speak(utterance);
    }

    // ── Sidebar History Logic ───────────────────────────────────────────────

    async startNewChat() {
        this.currentConversationId = null;
        this.innerEl.innerHTML = '';
        if (this.emptyEl) this.emptyEl.style.display = 'flex';
        
        document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
        
        // Mobile Sidebar Close
        const chatSidebar = document.getElementById('chatSidebar');
        if(chatSidebar) chatSidebar.classList.add('-translate-x-full');
        const overlay = document.getElementById('sidebarOverlay');
        if(overlay) overlay.classList.add('hidden');
    }

    async loadConversation(id) {
        try {
            const res = await fetch(`/api/conversations/${id}`);
            const data = await res.json();
            if (data.success) {
                this.currentConversationId = id;
                this.innerEl.innerHTML = '';
                if (this.emptyEl) this.emptyEl.style.display = 'none';
                
                document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
                const activeBtn = document.querySelector(`.history-item[data-id="${id}"]`);
                if (activeBtn) activeBtn.classList.add('active');
                
                // Add all history instantly
                data.messages.forEach(m => {
                    this.addMessage(m.content, m.role === 'user' ? 'user' : 'bot', null, m.created_at);
                });
                
                // Close mobile sidebar if open
                const chatSidebar = document.getElementById('chatSidebar');
                if(chatSidebar) chatSidebar.classList.add('-translate-x-full');
                const overlay = document.getElementById('sidebarOverlay');
                if(overlay) overlay.classList.add('hidden');
            } else {
                ToastManager.error("Failed to load conversation history.");
            }
        } catch (err) {
            console.error(err);
            ToastManager.error("Network error while loading history.");
        }
    }

    async deleteConversation(conversationId) {
        const confirmed = confirm("Are you sure you want to delete this conversation?");
        if (!confirmed) return;
        
        try {
            const res = await fetch(`/conversation/${conversationId}`, { method: "DELETE" });
            const data = await res.json();
            
            if (data.status === "success" || data.success) {
                // Remove from sidebar DOM directly
                const item = document.querySelector(`.history-item-wrap[data-id="${conversationId}"]`);
                if (item) item.remove();
                
                // If the deleted chat was currently open, reset to new chat
                if (this.currentConversationId == conversationId) {
                    this.startNewChat();
                }
                
                ToastManager.success("Deleted successfully");
            } else {
                ToastManager.error(data.message || data.error || "Failed to delete.");
            }
        } catch (err) {
            console.error(err);
            ToastManager.error("Network error while deleting.");
        }
    }

    // ── Message Renderers ───────────────────────────────────────────────────

    getCurrentTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    formatTime(timeStr) {
        if (!timeStr) return this.getCurrentTime();
        try {
            // If it's already a formatted small string like '10:30 AM' this might just pass through unharmed or be caught by length
            if (timeStr.length < 10) return timeStr;
            const date = new Date(timeStr);
            if (isNaN(date.getTime())) return this.getCurrentTime();
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch(e) {
            return this.getCurrentTime();
        }
    }

    async addMessageDynamic(text, timeStr) {
        timeStr = this.formatTime(timeStr);
        
        const wrapper = document.createElement('div');
        wrapper.className = `flex flex-col items-start mb-6 w-full`;

        const bubble = document.createElement('div');
        bubble.className = 'ai-message';
        
        const avatar = document.createElement('div');
        avatar.className = 'ai-avatar';
        avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
        
        const contentWrap = document.createElement('div');
        contentWrap.className = 'ai-content';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
        contentDiv.appendChild(typingIndicator);
        
        contentWrap.appendChild(contentDiv);
        bubble.appendChild(avatar);
        bubble.appendChild(contentWrap);
        
        wrapper.appendChild(bubble);
        this.innerEl.appendChild(wrapper);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        
        // Wait 600ms to simulate thinking locally
        await new Promise(r => setTimeout(r, 600));
        
        // Remove typing indicator
        contentDiv.innerHTML = '';
        
        return new Promise(resolve => {
            let i = 0;
            const speed = 15; // ms per char
            let buffer = '';
            
            const typeWriter = () => {
                if (i < text.length) {
                    buffer += text.charAt(i);
                    // Dynamically parse markdown as it types
                    contentDiv.innerHTML = window.marked ? marked.parse(buffer) : buffer;
                    i++;
                    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
                    setTimeout(typeWriter, speed);
                } else {
                    // Add timestamp when reading finishes
                    const timeEl = document.createElement('div');
                    timeEl.className = 'msg-time';
                    timeEl.textContent = timeStr;
                    contentWrap.appendChild(timeEl);
                    resolve();
                }
            };
            typeWriter();
        });
    }

    addMessage(text, sender = 'user', imageDataUrl = null, timeStr = null) {
        timeStr = this.formatTime(timeStr);
        
        const wrapper = document.createElement('div');
        wrapper.className = `flex flex-col ${sender === 'user' ? 'items-end' : 'items-start'} mb-6 w-full`;

        const bubble = document.createElement('div');
        bubble.className = sender === 'user' ? 'user-message' : 'ai-message';

        if (sender === 'bot') {
            const avatar = document.createElement('div');
            avatar.className = 'ai-avatar';
            avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
            bubble.appendChild(avatar);
            
            const contentWrap = document.createElement('div');
            contentWrap.className = 'ai-content';
            
            if (imageDataUrl) {
                const img = document.createElement('img');
                img.src = imageDataUrl;
                img.className = 'msg-image';
                contentWrap.appendChild(img);
            }
            
            if (text) {
                const contentDiv = document.createElement('div');
                contentDiv.className = 'message-content';
                if (window.marked) {
                    contentDiv.innerHTML = marked.parse(text);
                } else {
                    contentDiv.textContent = text;
                }
                contentWrap.appendChild(contentDiv);
            }
            
            const timeEl = document.createElement('div');
            timeEl.className = 'msg-time';
            timeEl.textContent = timeStr;
            contentWrap.appendChild(timeEl);
            
            bubble.appendChild(contentWrap);
            wrapper.appendChild(bubble);
        } else {
            // User message logic
            if (imageDataUrl) {
                const img = document.createElement('img');
                img.src = imageDataUrl;
                img.className = 'msg-image';
                bubble.appendChild(img);
            }
            if (text) {
                const span = document.createElement('span');
                span.textContent = text;
                bubble.appendChild(span);
            }
            wrapper.appendChild(bubble);
            
            const timeEl = document.createElement('div');
            timeEl.className = 'msg-time';
            timeEl.style.marginTop = '4px';
            timeEl.textContent = timeStr;
            wrapper.appendChild(timeEl);
        }

        this.innerEl.appendChild(wrapper);
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
