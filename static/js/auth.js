/**
 * auth.js — LittleVision Frontend
 * Toast · Forms · Password strength · Verify-code · ChatUI
 * Includes: AnalyserNode waveform · camera-label fix · camera flip toggle
 */

/* ═══════════════════════════════════════════════════════════════════════════
   ZOOM PREVENTION — iOS Safari + Chrome mobile
   Runs immediately before DOM is ready
   ═══════════════════════════════════════════════════════════════════════════ */
(function() {
    // 1. Block pinch-to-zoom (iOS Safari gesture events)
    document.addEventListener('gesturestart', function(e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturechange', function(e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gestureend', function(e) { e.preventDefault(); }, { passive: false });

    // 2. Block Ctrl+scroll zoom (desktop browsers)
    document.addEventListener('wheel', function(e) {
        if (e.ctrlKey) e.preventDefault();
    }, { passive: false });

    // 3. Block double-tap zoom by intercepting rapid taps
    var lastTouchEnd = 0;
    document.addEventListener('touchend', function(e) {
        var now = Date.now();
        if (now - lastTouchEnd <= 300) { e.preventDefault(); }
        lastTouchEnd = now;
    }, { passive: false });

    // 4. Ensure viewport meta tag is always correct
    var viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.setAttribute('content',
            'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    }
})();

/* ═══════════════════════════════════════════════════════════════════════════
   TOAST SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */

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
            toast.addEventListener('animationend', () => toast.remove(), { once: true });
        }, duration);
    },

    success(msg) { this.show(msg, 'success'); },
    error(msg)   { this.show(msg, 'error');   },
    info(msg)    { this.show(msg, 'info');     },
};


/* ═══════════════════════════════════════════════════════════════════════════
   FORM HELPER
   ═══════════════════════════════════════════════════════════════════════════ */

async function submitForm(formEl, url, options = {}) {
    const btn = formEl.querySelector('button[type="submit"]');
    if (btn) btn.classList.add('loading');
    try {
        const formData = new FormData(formEl);
        const response = await fetch(url, { method: 'POST', body: formData });
        const data     = await response.json();
        if (data.success) {
            if (options.successMsg) ToastManager.success(options.successMsg);
            if (data.redirect) setTimeout(() => { window.location.href = data.redirect; }, options.delay || 300);
            if (data.message)  ToastManager.success(data.message);
        } else {
            (data.errors || ['Something went wrong.']).forEach(e => ToastManager.error(e));
        }
        return data;
    } catch (err) {
        if (err instanceof SyntaxError) {
            ToastManager.error('Server error (HTML instead of JSON). Check logs.');
        } else {
            ToastManager.error('Network error. Please try again.');
        }
        console.error('Submit form error:', err);
        return { success: false };
    } finally {
        if (btn) btn.classList.remove('loading');
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   PASSWORD STRENGTH
   ═══════════════════════════════════════════════════════════════════════════ */

function evaluatePasswordStrength(password) {
    let score = 0;
    const checks = {
        length:  password.length >= 8,
        upper:   /[A-Z]/.test(password),
        lower:   /[a-z]/.test(password),
        number:  /[0-9]/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{}|;':",.\/<>?]/.test(password),
    };
    Object.values(checks).forEach(v => { if (v) score++; });
    let level = score >= 5 ? 'strong' : score >= 4 ? 'good' : score >= 3 ? 'fair' : 'weak';
    return { score, level, checks };
}

function initPasswordStrength(inputSel, meterSel, checksSel) {
    const input   = document.querySelector(inputSel);
    const meter   = document.querySelector(meterSel);
    const checksEl = document.querySelector(checksSel);
    if (!input || !meter) return;
    const labels = { length:'8+ characters', upper:'Uppercase', lower:'Lowercase', number:'Number', special:'Special character' };
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

function initPasswordToggle(toggleSel, inputSel) {
    const toggle = document.querySelector(toggleSel);
    const input  = document.querySelector(inputSel);
    if (!toggle || !input) return;
    const eyeOpen   = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
    const eyeClosed = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18"/></svg>`;
    toggle.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        toggle.innerHTML = show ? eyeClosed : eyeOpen;
    });
}


/* ═══════════════════════════════════════════════════════════════════════════
   VERIFY CODE INPUTS
   ═══════════════════════════════════════════════════════════════════════════ */

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


/* ═══════════════════════════════════════════════════════════════════════════
   WELCOME OVERLAY
   ═══════════════════════════════════════════════════════════════════════════ */

function showWelcome(username) {
    const overlay = document.createElement('div');
    overlay.className = 'welcome-overlay';
    overlay.innerHTML = `<div class="welcome-text">Welcome, ${username} 👋</div>`;
    document.body.appendChild(overlay);
    setTimeout(() => {
        overlay.style.animation = 'fadeOut 0.4s ease forwards';
        overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
    }, 3000);
}


/* ═══════════════════════════════════════════════════════════════════════════
   IMAGE UPLOADER
   ═══════════════════════════════════════════════════════════════════════════ */

class ImageUploader {
    constructor(uploadBtn, previewBar) {
        this.uploadBtn  = uploadBtn;
        this.previewBar = previewBar;
        this.files      = [];

        // Hidden file input for the attach-image button
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
            ToastManager.error('File too large. Max 10 MB.');
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

    /** Add an image from the camera capture path */
    addImage(dataUrl) {
        this.files.push({ file: null, dataUrl });
        this.renderPreviews();
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   CHAT UI — main dashboard class
   ═══════════════════════════════════════════════════════════════════════════ */

class ChatUI {
    constructor() {
        // ── DOM refs ──────────────────────────────────────────────────────────
        this.messagesEl    = document.getElementById('chatMessages');
        this.innerEl       = document.getElementById('chatMessagesInner');
        this.emptyEl       = document.getElementById('chatEmpty');
        this.inputEl       = document.getElementById('chatInput');
        this.sendBtn       = document.getElementById('sendBtn');
        this.micBtn        = document.getElementById('voiceBtn');
        this.uploadBtn     = document.getElementById('uploadBtn');
        this.previewBar    = document.getElementById('uploadPreviewBar');

        // Voice overlay
        this.voiceOverlay  = document.getElementById('voice-overlay');
        this.closeVoiceBtn = document.getElementById('closeVoiceBtn');
        this.voiceStatus   = document.getElementById('voiceStatus');
        this.liveTranscript = document.getElementById('live-transcript');
        this.stopSpeechBtn = document.getElementById('stopSpeechBtn');

        // Voice Selector
        this.voiceSelectorBtn = document.getElementById('voiceSelectorBtn');
        this.voiceSelectorPopup = document.getElementById('voiceSelectorPopup');
        this.voiceOptions     = Array.from(document.querySelectorAll('.voice-option'));
        this.selectedVoice    = localStorage.getItem('lv_voice_type') || 'female_friendly';
        this.voiceOptions.forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.voice === this.selectedVoice);
        });

        // Waveform bars (7 bars in the overlay)
        this.waveformEl    = document.getElementById('voiceWaveform');
        this.waveformBars  = this.waveformEl
            ? Array.from(this.waveformEl.querySelectorAll('.waveform-bar'))
            : [];

        if (!this.inputEl) return;

        // ── State ─────────────────────────────────────────────────────────────
        this.voiceModeActive        = false;
        this.currentConversationId  = null;
        this.noSpeechRetries        = 0;
        this.maxNoSpeechRetries     = 3;
        this.micStream              = null;
        this.mediaRecorder          = null;
        this.audioChunks            = [];

        // AnalyserNode for live waveform visualization
        this.audioContext   = null;
        this.analyserNode   = null;
        this.analyserSource = null;
        this.waveAnimFrame  = null;

        // Camera facing mode ('environment' = back, 'user' = front)
        this.cameraFacing   = 'environment';

        // ── Device detection ──────────────────────────────────────────────────
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
            .test(navigator.userAgent) || navigator.maxTouchPoints > 2;

        // ── LiveKit ───────────────────────────────────────────────────────────
        this.room          = null;
        this.livekitToken  = null;
        this.livekitUrl    = null;
        this.localMicTrack = null;

        // ── Web Speech API ────────────────────────────────────────────────────
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.hasSpeechRecognition = !!SpeechRecognition && !this.isMobile;

        if (this.hasSpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'en-US';
            this.recognition.interimResults = true;
            this.recognition.continuous = false;

            this.recognition.onresult = (event) => {
                let finalTranscript = '', interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) finalTranscript   += event.results[i][0].transcript;
                    else                          interimTranscript += event.results[i][0].transcript;
                }
                this.noSpeechRetries = 0;
                if (this.liveTranscript) {
                    this.liveTranscript.textContent = (finalTranscript || interimTranscript).trim();
                }
                if (finalTranscript) {
                    const cur = this.inputEl.value.trim();
                    this.inputEl.value = cur ? `${cur} ${finalTranscript}` : finalTranscript;
                } else if (interimTranscript) {
                    const tmp = this.inputEl.value.replace(/\[.*\]$/, '').trim();
                    this.inputEl.value = tmp ? `${tmp} [${interimTranscript}]` : `[${interimTranscript}]`;
                }
                this.autoResize();
            };

            this.recognition.onend = () => {
                if (!this.voiceModeActive) return;
                this.inputEl.value = this.inputEl.value.replace(/\[.*\]$/, '').trim();
                if (this.inputEl.value) {
                    this.setVoiceState('thinking');
                    this.send(true);
                } else if (this.noSpeechRetries < this.maxNoSpeechRetries) {
                    this.noSpeechRetries++;
                    try { this.recognition.start(); } catch(e) {}
                } else {
                    this.noSpeechRetries = 0;
                    this.setVoiceState('error');
                    if (this.voiceStatus) this.voiceStatus.textContent = 'No speech detected. Tap to retry.';
                    if (this.liveTranscript) this.liveTranscript.textContent = '';
                }
            };

            this.recognition.onerror = (e) => {
                console.warn('Speech recognition error:', e.error);
                switch (e.error) {
                    case 'not-allowed':
                        ToastManager.error('Microphone access denied. Please enable it in your browser settings.');
                        this.closeVoiceMode();
                        break;
                    case 'no-speech':
                        break; // handled by onend retry
                    case 'audio-capture':
                        console.warn('Web Speech API failed (audio-capture). Falling back to MediaRecorder.');
                        this.recognition = null;
                        this.startMediaRecorderFallback();
                        break;
                    case 'network':
                        console.warn('Network error in Speech API. Falling back to MediaRecorder.');
                        this.recognition = null;
                        this.startMediaRecorderFallback();
                        break;
                    case 'aborted':
                        break; // user or system abort — ignore
                    default:
                        console.warn('Speech recognition error. Falling back to MediaRecorder.');
                        this.recognition = null;
                        this.startMediaRecorderFallback();
                }
            };
        } else {
            this.recognition = null;
            console.warn('Web Speech API not supported — will use MediaRecorder fallback.');
        }

        // Pre-load voices for synthesis
        if (window.speechSynthesis) {
            window.speechSynthesis.getVoices();
            window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
        }

        // ── Uploader ──────────────────────────────────────────────────────────
        this.uploader = new ImageUploader(this.uploadBtn, this.previewBar);

        // ── Camera capture ────────────────────────────────────────────────────
        //
        // Strategy:
        //  • Mobile  → trigger the standalone <label id="mobileCameraLabel"> (preserves
        //              capture="environment" without any JS .click() relay)
        //  • Desktop → use getUserMedia() and show the custom webcam modal; no OS circle.
        //
        this.cameraInput      = document.getElementById('cameraInput');
        this.mobileCameraLabel = document.getElementById('mobileCameraLabel');
        this.cameraBtn        = document.getElementById('cameraBtn');
        this.webcamStream     = null;
        this.webcamPendingDataUrl = null;

        if (this.cameraBtn) {
            this.cameraBtn.addEventListener('click', () => {
                if (this.isMobile) {
                    // ── Mobile: let the native label trigger camera ──────────
                    if (this.cameraInput) this.cameraInput.value = '';
                    if (this.mobileCameraLabel) this.mobileCameraLabel.click();
                } else {
                    // ── Desktop: open getUserMedia webcam modal directly ──────
                    this.openWebcamModal();
                }
            });
        }

        // Camera flip button removed from DOM in HTML

        // Handle photo from mobile file-input capture
        if (this.cameraInput) {
            this.cameraInput.addEventListener('change', async () => {
                const file = this.cameraInput.files[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) { ToastManager.error('Please select an image file.'); return; }
                ToastManager.info('Photo captured!');
                const formData = new FormData();
                formData.append('image', file);
                try {
                    const res  = await fetch('/upload-image', { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.success) ToastManager.success('Photo uploaded!');
                } catch (e) { console.warn('Auto-upload failed:', e); }
                const reader = new FileReader();
                reader.onload = (e) => { this.uploader.addImage(e.target.result); };
                reader.readAsDataURL(file);
                this.cameraInput.value = '';
            });
        }

        // Webcam modal wiring (desktop)
        this._initWebcamModal();

        // ── Event listeners ───────────────────────────────────────────────────
        
        // Voice Selector logic
        if (this.voiceSelectorBtn) {
            this.voiceSelectorBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.voiceSelectorPopup) this.voiceSelectorPopup.classList.toggle('show');
            });
        }
        
        // Close popup when clicking outside
        document.addEventListener('click', (e) => {
            if (this.voiceSelectorPopup && this.voiceSelectorPopup.classList.contains('show')) {
                if (!this.voiceSelectorPopup.contains(e.target) && e.target !== this.voiceSelectorBtn && !this.voiceSelectorBtn?.contains(e.target)) {
                    this.voiceSelectorPopup.classList.remove('show');
                }
            }
        });

        this.voiceOptions.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectedVoice = opt.dataset.voice;
                localStorage.setItem('lv_voice_type', this.selectedVoice);
                this.voiceOptions.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                this.voiceSelectorPopup.classList.remove('show');
                ToastManager.info(`Voice changed to: ${opt.querySelector('.voice-option-name').textContent}`);
            });
        });
        this.sendBtn.addEventListener('click', () => this.send(false));
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.inputEl.value = this.inputEl.value.replace(/\[.*\]$/, '').trim();
                this.send(this.voiceModeActive);
            }
        });
        this.inputEl.addEventListener('input', () => this.autoResize());
        this.micBtn.addEventListener('click', () => this.openVoiceMode());

        if (this.closeVoiceBtn) {
            this.closeVoiceBtn.addEventListener('click', () => this.closeVoiceMode());
        }
        if (this.stopSpeechBtn) {
            this.stopSpeechBtn.addEventListener('click', () => {
                if (this.currentAudio) {
                    this.currentAudio.pause();
                    this.currentAudio = null;
                }
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                this.stopSpeechBtn.classList.add('hidden');
                if (this.voiceModeActive) this.setVoiceState('listening');
            });
        }

        // Suggestion chips
        document.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.inputEl.value = chip.textContent.trim();
                this.send(false);
            });
        });

        // Sidebar
        this._initSidebar();
    }

    // ── Sidebar ───────────────────────────────────────────────────────────────

    _initSidebar() {
        const sidebarHistory  = document.getElementById('sidebarHistory');
        const newChatBtn      = document.getElementById('newChatBtn');
        const mobileSidebarBtn = document.getElementById('mobileSidebarBtn');
        const chatSidebar     = document.getElementById('chatSidebar');
        const sidebarOverlay  = document.getElementById('sidebarOverlay');

        if (newChatBtn) newChatBtn.addEventListener('click', () => this.startNewChat());

        if (sidebarHistory) {
            sidebarHistory.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.delete-chat-btn');
                if (deleteBtn) { e.stopPropagation(); this.deleteConversation(deleteBtn.dataset.id); return; }
                const btn = e.target.closest('.history-item');
                if (btn) this.loadConversation(btn.dataset.id);
            });
        }

        const toggleSidebar = () => {
            if (chatSidebar)    chatSidebar.classList.toggle('-translate-x-full');
            if (sidebarOverlay) sidebarOverlay.classList.toggle('hidden');
        };
        if (mobileSidebarBtn) mobileSidebarBtn.addEventListener('click', toggleSidebar);
        if (sidebarOverlay)   sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    // ── LiveKit ────────────────────────────────────────────────────────────────

    async ensureLiveKitReady() {
        if (this.room && this.room.state === 'connected') return true;
        try {
            const res  = await fetch('/livekit-token');
            const data = await res.json();
            if (!data.success || !data.token || !data.url) { ToastManager.error('Failed to get Voice token.'); return false; }
            this.livekitToken = data.token;
            this.livekitUrl   = data.url;
            if (typeof LivekitClient === 'undefined') { ToastManager.error('Voice library not loaded. Refresh page.'); return false; }
            this.room = new LivekitClient.Room({ adaptiveStream: true, dynacast: true });
            await this.room.connect(this.livekitUrl, this.livekitToken);
            return true;
        } catch (err) {
            console.error('LiveKit error:', err);
            return false;
        }
    }

    // ── Voice mode open / close ────────────────────────────────────────────────

    async openVoiceMode() {
        if (this.voiceModeActive) { this.closeVoiceMode(); return; }

        // ── 1. Request microphone permission explicitly (critical on mobile Chrome) ──
        try {
            this.micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl:  true,
                    sampleRate: 16000,
                }
            });
        } catch (err) {
            switch (err.name) {
                case 'NotAllowedError':
                case 'PermissionDeniedError':
                    ToastManager.error('Microphone access denied. Enable it in your browser settings.');
                    break;
                case 'NotFoundError':
                    ToastManager.error('No microphone found on this device.');
                    break;
                case 'NotReadableError':
                    ToastManager.error('Microphone is in use by another app.');
                    break;
                default:
                    ToastManager.error('Could not access microphone. Please check permissions.');
            }
            return;
        }

        // ── 2. Show overlay immediately ─────────────────────────────────────────
        this.voiceOverlay.classList.remove('hidden');
        if (this.liveTranscript) this.liveTranscript.textContent = '';
        this.voiceModeActive = true;
        this.noSpeechRetries = 0;
        this.micBtn.classList.add('mic-active');
        this.setVoiceState('listening');

        // ── 3. Start AudioContext for waveform (must resume after user gesture) ─
        // On mobile, AudioContext must be created/resumed inside a user-gesture handler.
        this._startWaveformAnalyser();

        // ── 4. Start speech recognition ─────────────────────────────────────────
        if (this.recognition) {
            try {
                this.recognition.start();
            } catch (e) {
                // 'already started' or other — restart
                try { this.recognition.abort(); } catch (_) {}
                setTimeout(() => {
                    try { this.recognition.start(); } catch (_) { this.startMediaRecorderFallback(); }
                }, 150);
            }
        } else {
            this.startMediaRecorderFallback();
        }

        // ── 5. Optional LiveKit ─────────────────────────────────────────────────
        try {
            const ready = await this.ensureLiveKitReady();
            if (ready) {
                this.localMicTrack = await LivekitClient.createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true });
                await this.room.localParticipant.publishTrack(this.localMicTrack);
            }
        } catch (err) {
            console.warn('LiveKit optional, skipping:', err.message);
        }
    }

    closeVoiceMode() {
        this.voiceModeActive = false;
        this.voiceOverlay.classList.add('hidden');
        this.micBtn.classList.remove('mic-active');
        this.setVoiceState('off');
        if (this.stopSpeechBtn) this.stopSpeechBtn.classList.add('hidden');

        if (window.speechSynthesis) window.speechSynthesis.cancel();
        if (this.recognition) { try { this.recognition.stop(); } catch(e) {} }
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') { try { this.mediaRecorder.stop(); } catch(e) {} }
        this.mediaRecorder = null;
        if (this._recorderTimeout) clearTimeout(this._recorderTimeout);

        // Stop AnalyserNode visualization
        this._stopWaveformAnalyser();

        // Release mic stream
        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }

        // LiveKit cleanup
        if (this.localMicTrack) {
            try { this.room.localParticipant.unpublishTrack(this.localMicTrack); this.localMicTrack.stop(); this.localMicTrack = null; } catch(e) {}
        }
    }

    // ── AnalyserNode waveform visualization ───────────────────────────────────

    _startWaveformAnalyser() {
        if (!this.micStream || !this.waveformBars.length) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Mobile browsers often start AudioContext in 'suspended' state.
            // We must call resume() inside (or immediately after) a user-gesture handler.
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch(e => console.warn('AudioContext resume:', e));
            }

            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = 128;
            this.analyserNode.smoothingTimeConstant = 0.80;
            this.analyserSource = this.audioContext.createMediaStreamSource(this.micStream);
            this.analyserSource.connect(this.analyserNode);

            const bufferLength = this.analyserNode.frequencyBinCount; // 64
            const dataArray    = new Uint8Array(bufferLength);
            const barCount     = this.waveformBars.length;
            const MIN_H = 6, MAX_H = 76;

            this.waveformBars.forEach(b => b.classList.add('js-live'));

            const draw = () => {
                if (!this.voiceModeActive || !this.analyserNode) return;
                this.waveAnimFrame = requestAnimationFrame(draw);

                // If context gets suspended (tab hidden on iOS) try to resume
                if (this.audioContext?.state === 'suspended') {
                    this.audioContext.resume().catch(() => {});
                }

                this.analyserNode.getByteFrequencyData(dataArray);

                for (let i = 0; i < barCount; i++) {
                    const mirror   = i < Math.ceil(barCount / 2) ? i : barCount - 1 - i;
                    const freqIdx  = Math.floor((mirror + 1) * (bufferLength / (barCount + 1)));
                    const value    = dataArray[Math.min(freqIdx, bufferLength - 1)];
                    const height   = MIN_H + (value / 255) * (MAX_H - MIN_H);
                    this.waveformBars[i].style.height = `${Math.round(height)}px`;
                }
            };
            draw();
        } catch (err) {
            console.warn('AnalyserNode setup failed, CSS animation active:', err);
        }
    }

    _stopWaveformAnalyser() {
        if (this.waveAnimFrame) { cancelAnimationFrame(this.waveAnimFrame); this.waveAnimFrame = null; }
        if (this.analyserSource) { try { this.analyserSource.disconnect(); } catch(e) {} this.analyserSource = null; }
        if (this.audioContext)   { try { this.audioContext.close(); }        catch(e) {} this.audioContext   = null; }
        this.analyserNode = null;

        // Reset bar heights and re-enable CSS animation
        this.waveformBars.forEach(b => {
            b.classList.remove('js-live');
            b.style.height = '';
        });
    }

    // ── Webcam modal (desktop camera — no OS overlay) ─────────────────────────

    _initWebcamModal() {
        const backdrop    = document.getElementById('webcamBackdrop');
        const closeBtn    = document.getElementById('webcamCloseBtn');
        const captureBtn  = document.getElementById('webcamCaptureBtn');
        const confirmBtn  = document.getElementById('webcamConfirmBtn');
        const flipBtn     = document.getElementById('webcamFlipBtn');

        if (backdrop)   backdrop.addEventListener('click',   () => this.closeWebcamModal());
        if (closeBtn)   closeBtn.addEventListener('click',   () => this.closeWebcamModal());
        if (captureBtn) captureBtn.addEventListener('click', () => this._webcamCapture());
        if (confirmBtn) confirmBtn.addEventListener('click', () => this._webcamConfirm());
        if (flipBtn)    flipBtn.addEventListener('click',    () => this._webcamFlip());
    }

    async openWebcamModal() {
        const modal = document.getElementById('webcamModal');
        const video = document.getElementById('webcamVideo');
        if (!modal || !video) return;

        // Ensure no leftover preview state
        this._webcamResetPreview();

        try {
            const constraints = {
                video: {
                    facingMode: this.cameraFacing === 'user' ? 'user' : 'environment',
                    width:  { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            };
            this.webcamStream   = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject     = this.webcamStream;
            modal.classList.remove('hidden');
            // Trap focus inside modal
            setTimeout(() => document.getElementById('webcamCaptureBtn')?.focus(), 100);
        } catch (err) {
            console.error('Webcam open error:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                ToastManager.error('Camera access denied. Enable it in your browser settings.');
            } else if (err.name === 'NotFoundError') {
                ToastManager.error('No camera found on this device.');
            } else if (err.name === 'NotReadableError') {
                ToastManager.error('Camera is in use by another application.');
            } else {
                ToastManager.error('Could not access camera. Please try again.');
            }
        }
    }

    closeWebcamModal() {
        const modal = document.getElementById('webcamModal');
        if (modal) modal.classList.add('hidden');
        this._webcamResetPreview();
        if (this.webcamStream) {
            this.webcamStream.getTracks().forEach(t => t.stop());
            this.webcamStream = null;
        }
        this.webcamPendingDataUrl = null;
        const video = document.getElementById('webcamVideo');
        if (video) video.srcObject = null;
    }

    _webcamCapture() {
        const video   = document.getElementById('webcamVideo');
        const canvas  = document.getElementById('webcamCanvas');
        const preview = document.getElementById('webcamPreviewWrap');
        const previewImg = document.getElementById('webcamPreviewImg');
        const captureBtn = document.getElementById('webcamCaptureBtn');
        const confirmBtn = document.getElementById('webcamConfirmBtn');
        if (!video || !canvas) return;

        canvas.width  = video.videoWidth  || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        // Mirror for front-facing
        if (this.cameraFacing === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (this.cameraFacing === 'user') ctx.setTransform(1,0,0,1,0,0);

        this.webcamPendingDataUrl = canvas.toDataURL('image/jpeg', 0.88);

        // Show preview
        if (previewImg) previewImg.src = this.webcamPendingDataUrl;
        if (preview) preview.classList.remove('hidden');
        if (captureBtn) captureBtn.classList.add('hidden');
        if (confirmBtn) confirmBtn.classList.remove('hidden');
    }

    async _webcamConfirm() {
        if (!this.webcamPendingDataUrl) return;
        this.uploader.addImage(this.webcamPendingDataUrl);

        // Upload to backend
        const canvas = document.getElementById('webcamCanvas');
        if (canvas) {
            canvas.toBlob(async (blob) => {
                try {
                    const formData = new FormData();
                    formData.append('image', blob, 'webcam-capture.jpg');
                    const res  = await fetch('/upload-image', { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.success) ToastManager.success('Photo captured & uploaded!');
                } catch (e) { console.warn('Webcam upload failed:', e); }
            }, 'image/jpeg', 0.88);
        }

        this.closeWebcamModal();
    }

    async _webcamFlip() {
        this.cameraFacing = this.cameraFacing === 'environment' ? 'user' : 'environment';
        const flipBtn = document.getElementById('webcamFlipBtn');
        if (flipBtn) flipBtn.style.transform = this.cameraFacing === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
        // Restart stream with new facing
        if (this.webcamStream) { this.webcamStream.getTracks().forEach(t => t.stop()); this.webcamStream = null; }
        this._webcamResetPreview();
        await this.openWebcamModal();
    }

    _webcamResetPreview() {
        const preview    = document.getElementById('webcamPreviewWrap');
        const captureBtn = document.getElementById('webcamCaptureBtn');
        const confirmBtn = document.getElementById('webcamConfirmBtn');
        if (preview)    preview.classList.add('hidden');
        if (captureBtn) captureBtn.classList.remove('hidden');
        if (confirmBtn) confirmBtn.classList.add('hidden');
        this.webcamPendingDataUrl = null;
    }



    setVoiceState(state) {
        if (!this.voiceOverlay) return;

        // Remove all state classes
        this.voiceOverlay.classList.remove('state-listening', 'state-thinking', 'state-error', 'state-off');
        if (this.stopSpeechBtn) this.stopSpeechBtn.classList.add('hidden');
        if (this.voiceOverlay) this.voiceOverlay.onclick = null;

        switch (state) {
            case 'listening':
                this.voiceOverlay.classList.add('state-listening');
                if (this.voiceStatus) this.voiceStatus.textContent = 'Listening…';
                break;

            case 'thinking':
                // Stop live waveform during thinking (switch to slow CSS anim)
                this._stopWaveformAnalyser();
                this.voiceOverlay.classList.add('state-thinking');
                if (this.voiceStatus) this.voiceStatus.textContent = 'Thinking…';
                break;

            case 'speaking':
                this.voiceOverlay.classList.add('state-listening'); // reuse active style
                if (this.voiceStatus) this.voiceStatus.textContent = '';
                if (this.stopSpeechBtn) this.stopSpeechBtn.classList.remove('hidden');
                break;

            case 'error':
                this._stopWaveformAnalyser();
                this.voiceOverlay.classList.add('state-error');
                // Tap waveform to retry
                this.voiceOverlay.onclick = (e) => {
                    if (e.target === this.closeVoiceBtn || this.closeVoiceBtn?.contains(e.target)) return;
                    this.noSpeechRetries = 0;
                    this.setVoiceState('listening');
                    if (this.liveTranscript) this.liveTranscript.textContent = '';
                    this._startWaveformAnalyser();
                    if (this.recognition) { try { this.recognition.start(); } catch(ex) {} }
                    else { this.startMediaRecorderFallback(); }
                };
                break;

            default: // 'off'
                this.voiceOverlay.classList.add('state-off');
                if (this.voiceStatus) this.voiceStatus.textContent = '';
                break;
        }
    }

    // ── MediaRecorder fallback ────────────────────────────────────────────────

    startMediaRecorderFallback() {
        if (!this.micStream) return;
        try {
            this.audioChunks = [];
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus' : 'audio/webm';
            this.mediaRecorder = new MediaRecorder(this.micStream, { mimeType });

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.audioChunks.push(e.data);
            };

            this.mediaRecorder.onstop = async () => {
                if (this.audioChunks.length === 0 || !this.voiceModeActive) return;
                const audioBlob = new Blob(this.audioChunks, { type: mimeType });
                this.audioChunks = [];
                this.setVoiceState('thinking');
                if (this.voiceStatus) this.voiceStatus.textContent = 'Processing…';
                try {
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'recording.webm');
                    const res  = await fetch('/speech-to-text', { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.success && data.text) {
                        this.inputEl.value = data.text;
                        this.autoResize();
                        if (this.liveTranscript) this.liveTranscript.textContent = data.text;
                        this.setVoiceState('thinking');
                        this.send(true);
                    } else {
                        this.setVoiceState('error');
                        if (this.voiceStatus) this.voiceStatus.textContent = 'Could not transcribe. Tap to retry.';
                    }
                } catch (err) {
                    console.error('Transcription error:', err);
                    ToastManager.error('Failed to transcribe audio. Please try again.');
                    this.setVoiceState('error');
                }
            };

            this.mediaRecorder.start();
            this._recorderTimeout = setTimeout(() => {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') this.mediaRecorder.stop();
            }, 15000);
        } catch (err) {
            console.error('MediaRecorder error:', err);
            ToastManager.error('Voice recording not supported on this browser.');
            this.closeVoiceMode();
        }
    }

    // ── Sending & AI response ─────────────────────────────────────────────────

    autoResize() {
        this.inputEl.style.height = 'auto';
        this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + 'px';
    }

    send(forceVoice = false) {
        this.inputEl.value = this.inputEl.value.replace(/\[.*\]$/, '').trim();
        const text   = this.inputEl.value.trim();
        const images = this.uploader.getAndClear();
        if (!text && images.length === 0) return;

        if (this.emptyEl) this.emptyEl.style.display = 'none';
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (images.length > 0) images.forEach(dataUrl => this.addMessage('', 'user', dataUrl, currentTime));
        if (text) this.addMessage(text, 'user', null, currentTime);

        this.inputEl.value = '';
        this.inputEl.style.height = 'auto';

        if (this.voiceModeActive) this.setVoiceState('thinking');

        if (text)             this.fetchAIResponse(text, forceVoice || this.voiceModeActive);
        else if (images.length > 0) {
            this.addMessage('Image uploaded successfully.', 'bot');
            if (this.voiceModeActive) this.setVoiceState('listening');
        }
    }

    async fetchAIResponse(text, fromVoice = false) {
        // Show standalone animated thinking indicator
        const thinkingId = 'think-' + Date.now();
        const thinkingEl = document.createElement('div');
        thinkingEl.className = 'ai-standalone-thinking';
        thinkingEl.id = thinkingId;
        thinkingEl.innerHTML = `
            <div class="ai-typing-dots">
                <span></span><span></span><span></span>
            </div>
            <div class="ai-thinking-text">Generating response...</div>
        `;
        this.innerEl.appendChild(thinkingEl);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

        // ── Try streaming endpoint first ─────────────────────────────────────
        try {
            const streamRes = await fetch('/ai-response-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, conversation_id: this.currentConversationId, voice_type: this.selectedVoice }),
                signal: AbortSignal.timeout(60000),
            });

            if (streamRes.ok && streamRes.body) {
                return await this._consumeStream(streamRes, fromVoice, thinkingId);
            }
        } catch (streamErr) {
            if (streamErr.name === 'AbortError') {
                document.getElementById(thinkingId)?.remove();
                ToastManager.error('Request timed out. Please try again.');
                if (this.voiceModeActive) this.setVoiceState('listening');
                return;
            }
        }

        // ── Regular JSON endpoint (fallback / default) ────────────────────────
        try {
            const res  = await fetch('/ai-response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, conversation_id: this.currentConversationId, voice_type: this.selectedVoice }),
            });
            const data = await res.json();
            
            // Remove standalone thinking indicator if it exists
            document.getElementById(thinkingId)?.remove();

            if (data.success && data.response) {
                this.currentConversationId = data.conversation_id;
                await this.addMessageDynamic(data.response, data.ai_message_time);
                if (fromVoice && data.tts_audio) { 
                    this.closeVoiceMode(); 
                    this.playBase64Audio(data.tts_audio); 
                } else if (fromVoice) {
                    this.closeVoiceMode(); this.speak(data.response);
                } else if (this.voiceModeActive) {
                    this.closeVoiceMode();
                }
            } else {
                ToastManager.error(data.error || 'Failed to get AI response');
                if (this.voiceModeActive) this.setVoiceState('listening');
            }
        } catch (err) {
            document.getElementById(thinkingId)?.remove();
            ToastManager.error('Network error while asking AI.');
            if (this.voiceModeActive) this.setVoiceState('listening');
            console.error(err);
        }
    }

    /** Consume an SSE stream from /ai-response-stream and render tokens in real time */
    async _consumeStream(res, fromVoice, thinkingId) {
        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';
        let fullText  = '';
        
        // Remove the standalone thinking indicator since the stream has connected
        document.getElementById(thinkingId)?.remove();

        // ── Build message bubble ──────────────────────────────────────────────
        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col items-start mb-6 w-full';

        const bubble = document.createElement('div');
        bubble.className = 'ai-message';

        const avatar = document.createElement('div');
        avatar.className = 'ai-avatar';
        avatar.innerHTML = `<img src="/static/images/logo-icon.svg" alt="AI" class="w-full h-full object-contain">`;

        const contentWrap = document.createElement('div');
        contentWrap.className = 'ai-content';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        contentWrap.appendChild(contentDiv);
        bubble.appendChild(avatar);
        bubble.appendChild(contentWrap);
        wrapper.appendChild(bubble);
        this.innerEl.appendChild(wrapper);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

        // ── Stream tokens ─────────────────────────────────────────────────────
        let firstToken = true;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                sseBuffer += decoder.decode(value, { stream: true });

                // Parse SSE lines
                const lines = sseBuffer.split('\n');
                sseBuffer = lines.pop() ?? ''; // Keep any partial line

                for (const line of lines) {
                    if (!line.startsWith('data:')) continue;
                    const raw = line.slice(5).trim();
                    if (!raw || raw === '[DONE]') continue;

                    let token = '', done_flag = false, convId = null;
                    try {
                        const parsed = JSON.parse(raw);
                        token    = parsed.token    ?? parsed.text ?? '';
                        done_flag = parsed.done    ?? false;
                        convId   = parsed.conversation_id ?? null;
                        if (convId) this.currentConversationId = convId;
                    } catch {
                        // Plain-text streaming (not JSON)
                        token = raw;
                    }

                    if (token) {
                        fullText += token;
                        contentDiv.innerHTML = window.marked ? marked.parse(fullText) : fullText;
                        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
                    }
                    if (done_flag) break;
                }
            }
        } catch (err) {
            console.error('Stream read error:', err);
            if (!fullText) {
                wrapper.remove();
                ToastManager.error('Stream interrupted. Please try again.');
                if (this.voiceModeActive) this.setVoiceState('listening');
                return;
            }
        }

        // Finalise: add timestamp
        const timeEl = document.createElement('div');
        timeEl.className = 'msg-time';
        timeEl.textContent = this.getCurrentTime();
        contentWrap.appendChild(timeEl);

        if (fromVoice) { this.closeVoiceMode(); this.speak(fullText); }
        else if (this.voiceModeActive) this.closeVoiceMode();
    }

    playBase64Audio(base64Data, onEndCallback = null) {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        try {
            const audioSrc = 'data:audio/mp3;base64,' + base64Data;
            this.currentAudio = new Audio(audioSrc);
            
            if (onEndCallback) {
                this.currentAudio.onended = onEndCallback;
                this.currentAudio.onerror = onEndCallback;
            } else {
                this.currentAudio.onended = () => { if (this.voiceModeActive) this.setVoiceState('listening'); };
                this.currentAudio.onerror = () => { if (this.voiceModeActive) this.setVoiceState('listening'); };
            }
            
            this.currentAudio.play();
        } catch (e) {
            console.error("Audio playback failed", e);
            if (onEndCallback) onEndCallback();
            else if (this.voiceModeActive) this.setVoiceState('listening');
        }
    }

    async speak(text) {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        const cleanText = text.replace(/[*_#`~]+/g, '').replace(/[\u{1F600}-\u{1F64F}]/gu, '');
        if (!cleanText.trim()) return;

        try {
            const res = await fetch('/generate-tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: cleanText, voice_type: this.selectedVoice })
            });
            const data = await res.json();
            if (data.success && data.tts_audio) {
                this.playBase64Audio(data.tts_audio);
            } else {
                if (this.voiceModeActive) this.setVoiceState('listening');
            }
        } catch(e) {
            console.error("TTS fetch failed", e);
            if (this.voiceModeActive) this.setVoiceState('listening');
        }
    }

    // ── Sidebar history actions ───────────────────────────────────────────────

    async startNewChat() {
        this.currentConversationId = null;
        this.innerEl.innerHTML = '';
        if (this.emptyEl) this.emptyEl.style.display = 'flex';
        document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
        const chatSidebar    = document.getElementById('chatSidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        if (chatSidebar)    chatSidebar.classList.add('-translate-x-full');
        if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
    }

    async loadConversation(id) {
        try {
            const res  = await fetch(`/api/conversations/${id}`);
            const data = await res.json();
            if (data.success) {
                this.currentConversationId = id;
                this.innerEl.innerHTML = '';
                if (this.emptyEl) this.emptyEl.style.display = 'none';
                document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
                const activeBtn = document.querySelector(`.history-item[data-id="${id}"]`);
                if (activeBtn) activeBtn.classList.add('active');
                data.messages.forEach(m => this.addMessage(m.content, m.role === 'user' ? 'user' : 'bot', null, m.created_at));
                const chatSidebar    = document.getElementById('chatSidebar');
                const sidebarOverlay = document.getElementById('sidebarOverlay');
                if (chatSidebar)    chatSidebar.classList.add('-translate-x-full');
                if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
            } else {
                ToastManager.error('Failed to load conversation history.');
            }
        } catch (err) {
            console.error(err);
            ToastManager.error('Network error while loading history.');
        }
    }

    async deleteConversation(conversationId) {
        if (!confirm('Are you sure you want to delete this conversation?')) return;
        try {
            const res  = await fetch(`/conversation/${conversationId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                const item = document.querySelector(`.history-item-wrap[data-id="${conversationId}"]`);
                if (item) item.remove();
                if (this.currentConversationId == conversationId) this.startNewChat();
                ToastManager.success('Deleted successfully');
            } else {
                ToastManager.error(data.message || data.error || 'Failed to delete.');
            }
        } catch (err) {
            console.error(err);
            ToastManager.error('Network error while deleting.');
        }
    }

    // ── Message renderers ─────────────────────────────────────────────────────

    getCurrentTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    formatTime(timeStr) {
        if (!timeStr) return this.getCurrentTime();
        try {
            if (timeStr.length < 10) return timeStr;
            const date = new Date(timeStr);
            if (isNaN(date.getTime())) return this.getCurrentTime();
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch(e) { return this.getCurrentTime(); }
    }

    /** Helper: Create ChatGPT-style Action Bar for AI messages */
    createActionBar(text) {
        const bar = document.createElement('div');
        bar.className = 'msg-actions-bar';

        const createBtn = (svgPath, title) => {
            const btn = document.createElement('button');
            btn.className = 'msg-action-btn';
            btn.title = title;
            btn.type = 'button';
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>`;
            return btn;
        };

        const btnUp = createBtn('<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>', 'Good response');
        const btnDown = createBtn('<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>', 'Bad response');
        const btnCopy = createBtn('<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>', 'Copy message');
        const btnSpeak = createBtn('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>', 'Read aloud');

        // Feedback Logic
        btnUp.onclick = () => {
            if (btnUp.classList.contains('active-thumb')) {
                btnUp.classList.remove('active-thumb');
            } else {
                btnUp.classList.add('active-thumb');
                btnDown.classList.remove('active-thumb');
            }
        };
        btnDown.onclick = () => {
            if (btnDown.classList.contains('active-thumb')) {
                btnDown.classList.remove('active-thumb');
            } else {
                btnDown.classList.add('active-thumb');
                btnUp.classList.remove('active-thumb');
            }
        };

        // Copy Logic
        btnCopy.onclick = () => {
            navigator.clipboard.writeText(text).then(() => {
                ToastManager.success('Copied to clipboard');
            }).catch(() => {
                ToastManager.error('Failed to copy');
            });
        };

        // Speak Logic
        btnSpeak.onclick = async () => {
            if (this.currentAudio && !this.currentAudio.paused && btnSpeak.classList.contains('speaking')) {
                // Stop speaking
                this.currentAudio.pause();
                this.currentAudio = null;
                btnSpeak.classList.remove('speaking');
            } else {
                // Fetch dynamic TTS and play
                if (this.currentAudio) {
                    this.currentAudio.pause();
                    this.currentAudio = null;
                }
                document.querySelectorAll('.msg-action-btn.speaking').forEach(b => b.classList.remove('speaking'));
                btnSpeak.classList.add('speaking');
                
                const cleanText = text.replace(/[*_#`~]+/g, '').replace(/[\u{1F600}-\u{1F64F}]/gu, '');
                
                try {
                    const res = await fetch('/generate-tts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: cleanText, voice_type: this.selectedVoice || 'female_friendly' })
                    });
                    const data = await res.json();
                    if (data.success && data.tts_audio) {
                        this.playBase64Audio(data.tts_audio, () => {
                            btnSpeak.classList.remove('speaking');
                        });
                    } else {
                        btnSpeak.classList.remove('speaking');
                    }
                } catch(e) {
                    console.error('Standalone TTS generation failed:', e);
                    btnSpeak.classList.remove('speaking');
                    ToastManager.error('Voice playback failed.');
                }
            }
        };

        bar.appendChild(btnUp);
        bar.appendChild(btnDown);
        bar.appendChild(btnSpeak);
        bar.appendChild(btnCopy);

        return bar;
    }

    /** Animated AI message (typewriter effect) */
    async addMessageDynamic(text, timeStr) {
        timeStr = this.formatTime(timeStr);

        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col items-start mb-6 w-full';

        const bubble = document.createElement('div');
        bubble.className = 'ai-message';

        const avatar = document.createElement('div');
        avatar.className = 'ai-avatar';
        avatar.innerHTML = `<img src="/static/images/logo-icon.svg" alt="AI" class="w-full h-full object-contain">`;

        const contentWrap = document.createElement('div');
        contentWrap.className = 'ai-content';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        contentWrap.appendChild(contentDiv);
        bubble.appendChild(avatar);
        bubble.appendChild(contentWrap);
        wrapper.appendChild(bubble);
        this.innerEl.appendChild(wrapper);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

        // Typewriter render
        return new Promise(resolve => {
            let i = 0, buffer = '';
            const speed = 14;
            const typeWriter = () => {
                if (i < text.length) {
                    buffer += text.charAt(i);
                    contentDiv.innerHTML = window.marked ? marked.parse(buffer) : buffer;
                    i++;
                    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
                    setTimeout(typeWriter, speed);
                } else {
                    const timeEl = document.createElement('div');
                    timeEl.className = 'msg-time';
                    timeEl.textContent = timeStr;
                    contentWrap.appendChild(timeEl);
                    const actionBars = this.createActionBar(text);
                    contentWrap.appendChild(actionBars);
                    resolve();
                }
            };
            typeWriter();
        });
    }

    /** Instant message (user messages + history) */
    addMessage(text, sender = 'user', imageDataUrl = null, timeStr = null) {
        timeStr = this.formatTime(timeStr);

        const wrapper = document.createElement('div');
        wrapper.className = `flex flex-col ${sender === 'user' ? 'items-end' : 'items-start'} mb-6 w-full`;

        const bubble = document.createElement('div');
        bubble.className = sender === 'user' ? 'user-message' : 'ai-message';

        if (sender === 'bot') {
            const avatar = document.createElement('div');
            avatar.className = 'ai-avatar';
            avatar.innerHTML = `<img src="/static/images/logo-icon.svg" alt="AI" class="w-full h-full object-contain">`;
            bubble.appendChild(avatar);

            const contentWrap = document.createElement('div');
            contentWrap.className = 'ai-content';

            if (imageDataUrl) {
                const img = document.createElement('img');
                img.src = imageDataUrl; img.className = 'msg-image';
                contentWrap.appendChild(img);
            }
            if (text) {
                const contentDiv = document.createElement('div');
                contentDiv.className = 'message-content';
                contentDiv.innerHTML = window.marked ? marked.parse(text) : text;
                contentWrap.appendChild(contentDiv);
            }
            const timeEl = document.createElement('div');
            timeEl.className = 'msg-time'; timeEl.textContent = timeStr;
            contentWrap.appendChild(timeEl);
            const actionBars = this.createActionBar(text);
            contentWrap.appendChild(actionBars);
            bubble.appendChild(contentWrap);
            wrapper.appendChild(bubble);
        } else {
            if (imageDataUrl) {
                const img = document.createElement('img');
                img.src = imageDataUrl; img.className = 'msg-image';
                bubble.appendChild(img);
            }
            if (text) {
                const span = document.createElement('span');
                span.textContent = text;
                bubble.appendChild(span);
            }
            wrapper.appendChild(bubble);
            const timeEl = document.createElement('div');
            timeEl.className = 'msg-time'; timeEl.style.marginTop = '4px'; timeEl.textContent = timeStr;
            wrapper.appendChild(timeEl);
        }

        this.innerEl.appendChild(wrapper);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════════════════════════════════ */

function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const isDark = localStorage.getItem('theme') === 'dark'
        || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) { document.documentElement.classList.add('dark');    if (themeToggle) themeToggle.checked = true;  }
    else        { document.documentElement.classList.remove('dark'); if (themeToggle) themeToggle.checked = false; }

    if (themeToggle) {
        themeToggle.addEventListener('change', (e) => {
            if (e.target.checked) { document.documentElement.classList.add('dark');    localStorage.setItem('theme', 'dark');  }
            else                  { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
        });
    }
}
initThemeToggle();


/* ═══════════════════════════════════════════════════════════════════════════
   DOM READY
   ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();

    // Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        initPasswordToggle('#togglePassword', '#password');
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitForm(loginForm, '/login', { successMsg: 'Login successful!' });
        });
    }

    // Signup
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

    // Forgot password
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitForm(forgotForm, '/forgot-password', { successMsg: 'Reset code sent to your email!', delay: 1500 });
        });
    }

    // Verify code
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

    // Resend code
    const resendBtn = document.getElementById('resendCode');
    if (resendBtn) {
        resendBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            resendBtn.style.pointerEvents = 'none';
            resendBtn.textContent = 'Sending…';
            try {
                const res  = await fetch('/resend-code', { method: 'POST' });
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

    // Reset password
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

    // Welcome toast
    const welcomeEl = document.getElementById('welcomeUser');
    if (welcomeEl) {
        const username = welcomeEl.dataset.username;
        if (username) showWelcome(username);
    }

    // Dashboard chat
    if (document.getElementById('chatInput')) {
        new ChatUI();
    }

    // User dropdown
    const menuBtn  = document.getElementById('userMenuBtn');
    const dropdown = document.getElementById('userDropdown');
    if (menuBtn && dropdown) {
        menuBtn.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('hidden'); });
        document.addEventListener('click', () => dropdown.classList.add('hidden'));
    }
});