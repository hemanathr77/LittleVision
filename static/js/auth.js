/**
 * auth.js — LittleVision Frontend
 * Toast · Forms · Password strength · Verify-code · ChatUI
 * Includes: AnalyserNode waveform · camera-label fix · camera flip toggle
 */

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
    } catch {
        ToastManager.error('Network error. Please try again.');
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
        this.hasSpeechRecognition = !!SpeechRecognition;

        if (SpeechRecognition) {
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
                        ToastManager.error('Microphone not available. Please check your device.');
                        this.closeVoiceMode();
                        break;
                    case 'network':
                        ToastManager.error('Network error during speech recognition.');
                        this.closeVoiceMode();
                        break;
                    case 'aborted':
                        break; // user or system abort — ignore
                    default:
                        ToastManager.error('Speech recognition error. Please try again.');
                        this.closeVoiceMode();
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
        // The <label id="cameraBtn"> in dashboard.html wraps the input natively,
        // so capture="environment" is preserved on mobile without JS relay.
        this.cameraInput = document.getElementById('cameraInput');

        // Reset input on each tap so same photo can be re-taken
        const cameraLabel = document.getElementById('cameraBtn');
        if (cameraLabel && this.cameraInput) {
            cameraLabel.addEventListener('click', () => {
                this.cameraInput.value = '';
            });
        }

        // Camera flip button — show on mobile, toggle capture attribute
        const cameraFlipBtn = document.getElementById('cameraFlipBtn');
        if (cameraFlipBtn) {
            if (this.isMobile) {
                cameraFlipBtn.style.display = 'inline-flex';
                cameraFlipBtn.addEventListener('click', () => {
                    this.cameraFacing = this.cameraFacing === 'environment' ? 'user' : 'environment';
                    if (this.cameraInput) {
                        this.cameraInput.setAttribute('capture', this.cameraFacing);
                    }
                    const label = this.cameraFacing === 'user' ? 'Front camera' : 'Back camera';
                    ToastManager.info(`Switched to ${label}`);
                    // Rotate the flip icon for visual feedback
                    cameraFlipBtn.style.transform = this.cameraFacing === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
                });
            }
        }

        // Handle photo captured from camera
        if (this.cameraInput) {
            this.cameraInput.addEventListener('change', async () => {
                const file = this.cameraInput.files[0];
                if (!file) return;

                if (!file.type.startsWith('image/')) {
                    ToastManager.error('Please select an image file.');
                    return;
                }

                ToastManager.info('Photo captured!');

                // Upload to backend
                const formData = new FormData();
                formData.append('image', file);
                try {
                    const res  = await fetch('/upload-image', { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.success) ToastManager.success('Photo uploaded!');
                } catch (e) {
                    console.warn('Auto-upload failed (endpoint may not exist):', e);
                }

                // Preview in input bar
                const reader = new FileReader();
                reader.onload = (e) => { this.uploader.addImage(e.target.result); };
                reader.readAsDataURL(file);

                this.cameraInput.value = '';
            });
        }

        // ── Event listeners ───────────────────────────────────────────────────
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

        // 1. Request microphone (critical for mobile Chrome)
        try {
            this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                ToastManager.error('Microphone access denied. Enable it in your browser settings.');
            } else if (err.name === 'NotFoundError') {
                ToastManager.error('No microphone found. Please connect a microphone.');
            } else if (err.name === 'NotReadableError') {
                ToastManager.error('Microphone is already in use by another app.');
            } else {
                ToastManager.error('Could not access microphone. Check permissions.');
            }
            return;
        }

        // 2. Show overlay
        this.voiceOverlay.classList.remove('hidden');
        if (this.liveTranscript) this.liveTranscript.textContent = '';
        this.voiceModeActive = true;
        this.noSpeechRetries = 0;
        this.micBtn.classList.add('mic-active');
        this.setVoiceState('listening');

        // 3. Wire up AnalyserNode for live waveform visualization
        this._startWaveformAnalyser();

        // 4. Start speech recognition
        if (this.recognition) {
            try { this.recognition.start(); } catch (e) { this.startMediaRecorderFallback(); }
        } else {
            this.startMediaRecorderFallback();
        }

        // 5. Optional LiveKit
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
            this.audioContext   = new (window.AudioContext || window.webkitAudioContext)();
            this.analyserNode   = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = 64;          // 32 frequency bins — plenty for 7 bars
            this.analyserNode.smoothingTimeConstant = 0.75;
            this.analyserSource = this.audioContext.createMediaStreamSource(this.micStream);
            this.analyserSource.connect(this.analyserNode);

            const bufferLength = this.analyserNode.frequencyBinCount; // 32
            const dataArray    = new Uint8Array(bufferLength);
            const barCount     = this.waveformBars.length;             // 7
            const MIN_H = 8, MAX_H = 72;

            // Mark bars as JS-driven (disables CSS animation)
            this.waveformBars.forEach(b => b.classList.add('js-live'));

            const draw = () => {
                if (!this.voiceModeActive || !this.analyserNode) return;
                this.waveAnimFrame = requestAnimationFrame(draw);
                this.analyserNode.getByteFrequencyData(dataArray);

                for (let i = 0; i < barCount; i++) {
                    // Mirror the waveform: center bar = highest frequency index
                    const mirroredIdx = i < Math.ceil(barCount / 2) ? i : barCount - 1 - i;
                    // Map to lower-mid freq range (skip the very first bin which is DC offset)
                    const freqIdx = Math.floor((mirroredIdx + 1) * (bufferLength / barCount));
                    const value   = dataArray[Math.min(freqIdx, bufferLength - 1)];
                    const height  = MIN_H + (value / 255) * (MAX_H - MIN_H);
                    this.waveformBars[i].style.height = `${height}px`;
                }
            };
            draw();
        } catch (err) {
            console.warn('AnalyserNode setup failed, falling back to CSS animation:', err);
            // Leave CSS animation running — still looks good
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

    // ── Voice state visual ────────────────────────────────────────────────────

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
        try {
            const res  = await fetch('/ai-response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, conversation_id: this.currentConversationId })
            });
            const data = await res.json();
            if (data.success && data.response) {
                this.currentConversationId = data.conversation_id;
                await this.addMessageDynamic(data.response, data.ai_message_time);
                if (fromVoice) {
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
        if (!window.speechSynthesis) { if (this.voiceModeActive) this.setVoiceState('listening'); return; }
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/[*_#`~]+/g, '').replace(/[\u{1F600}-\u{1F64F}]/gu, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'en-US'; utterance.rate = 1; utterance.pitch = 1.1;
        const voices = window.speechSynthesis.getVoices();
        const femaleVoice = voices.find(v => v.name.includes('Google UK English Female'))
            || voices.find(v => v.name.includes('Female'))
            || voices.find(v => v.name.includes('Samantha'))
            || voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'));
        if (femaleVoice) utterance.voice = femaleVoice;
        utterance.onend   = () => { if (this.voiceModeActive) this.setVoiceState('listening'); };
        utterance.onerror = () => { if (this.voiceModeActive) this.setVoiceState('listening'); };
        window.speechSynthesis.speak(utterance);
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

    /** Animated AI message (typing effect + thinking dots first) */
    async addMessageDynamic(text, timeStr) {
        timeStr = this.formatTime(timeStr);

        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col items-start mb-6 w-full';

        const bubble = document.createElement('div');
        bubble.className = 'ai-message';

        const avatar = document.createElement('div');
        avatar.className = 'ai-avatar';
        avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;

        const contentWrap = document.createElement('div');
        contentWrap.className = 'ai-content';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Show thinking dots
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'ai-thinking-indicator';
        typingIndicator.innerHTML = `<div class="ai-thinking-dot"></div><div class="ai-thinking-dot"></div><div class="ai-thinking-dot"></div>`;
        contentDiv.appendChild(typingIndicator);

        const shimmerBar = document.createElement('div');
        shimmerBar.className = 'ai-thinking-shimmer';
        contentDiv.appendChild(shimmerBar);

        contentWrap.appendChild(contentDiv);
        bubble.appendChild(avatar);
        bubble.appendChild(contentWrap);
        wrapper.appendChild(bubble);
        this.innerEl.appendChild(wrapper);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

        // Simulate thinking pause
        await new Promise(r => setTimeout(r, 600));
        contentDiv.innerHTML = '';

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
            avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
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
            submitForm(forgotForm, '/forgot-password', { successMsg: 'Reset code sent!' });
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