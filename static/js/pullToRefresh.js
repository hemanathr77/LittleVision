// Proper custom pull-to-refresh implementation for the chat app
let touchStartY = 0;
let ptrContainer = null;
let ptrIcon = null;
let isPulling = false;
let pullDistance = 0;
const PULL_THRESHOLD = 80;

document.addEventListener('DOMContentLoaded', () => {
    // Create Pull to refresh UI
    ptrContainer = document.createElement('div');
    ptrContainer.className = 'ptr-container';
    ptrContainer.innerHTML = `
        <div class="ptr-icon" id="ptrIcon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-3.1c1.5 2.1 4.14 4.14 4.14 4.14"/>
            </svg>
        </div>
    `;
    document.body.prepend(ptrContainer);

    // Add styles dynamically
    const style = document.createElement('style');
    style.textContent = `
        .ptr-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            pointer-events: none;
            transform: translateY(-100%);
            transition: transform 0.2s ease-out;
        }
        .ptr-icon {
            background: var(--surface, #ffffff);
            border-radius: 50%;
            padding: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            color: var(--text-primary, #111827);
            transition: transform 0.2s ease-out;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .ptr-icon.spinning {
            animation: ptr-spin 1s linear infinite;
        }
        @keyframes ptr-spin {
            100% { transform: rotate(360deg); }
        }
        .pulling-down {
            transition: none !important;
        }
    `;
    document.head.appendChild(style);

    ptrIcon = document.getElementById('ptrIcon');
});

document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        isPulling = false;
        pullDistance = 0;
    }
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;

    const touchY = e.touches[0].clientY;
    const touchDiff = touchY - touchStartY;

    // Only engage pull to refresh if at the top of a scrollable area or body
    const scrollable = e.target.closest('.chat-messages, .sidebar-scroll, textarea, .overflow-y-auto');
    const isAtTop = scrollable ? scrollable.scrollTop <= 0 : true;

    if (touchDiff > 0 && isAtTop) {
        // Prevent default browser scroll/bounce behavior ONLY when at the top and pulling down
        if (e.cancelable) e.preventDefault();

        isPulling = true;
        pullDistance = touchDiff * 0.4; // Resistance factor

        if (ptrContainer && ptrIcon) {
            ptrContainer.classList.add('pulling-down');
            // Max pull down visual is slightly more than threshold
            const visualDist = Math.min(pullDistance, PULL_THRESHOLD + 20);
            ptrContainer.style.transform = `translateY(${-60 + visualDist}px)`;
            ptrIcon.style.transform = `rotate(${pullDistance * 2}deg)`;
        }
    }
}, { passive: false });

document.addEventListener('touchend', () => {
    if (isPulling && pullDistance > PULL_THRESHOLD) {
        // Trigger refresh
        if (ptrContainer && ptrIcon) {
            ptrContainer.classList.remove('pulling-down');
            ptrContainer.style.transform = `translateY(20px)`;
            ptrIcon.classList.add('spinning');

            // Reload page or trigger app refresh
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
    } else {
        // Reset
        if (ptrContainer && ptrIcon) {
            ptrContainer.classList.remove('pulling-down');
            ptrContainer.style.transform = `translateY(-100%)`;
            ptrIcon.style.transform = `rotate(0deg)`;
        }
    }
    isPulling = false;
    pullDistance = 0;
});