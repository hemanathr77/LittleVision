/**
 * Global Pull-to-Refresh Implementation
 */

// Create the spinner element
const ptrContainer = document.createElement('div');
ptrContainer.id = 'pullToRefresh';
ptrContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 0px;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    background: transparent;
    z-index: 9999;
    transition: height 0.2s cubic-bezier(0.1, 0.7, 0.1, 1);
    pointer-events: none;
`;

ptrContainer.innerHTML = `
    <div style="padding-bottom: 12px; transform: scale(0.9); transition: transform 0.2s; id="ptr-icon-container">
        <svg class="w-7 h-7 animate-spin text-indigo-500" style="color: var(--accent, #6366f1);" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" style="opacity: 0.25;"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style="opacity: 0.75;"></path>
        </svg>
    </div>
`;

document.addEventListener('DOMContentLoaded', () => {
    document.body.prepend(ptrContainer);
});

let startY = 0;
let isPulling = false;
let currentHeight = 0;
const resistance = 2.5;
const threshold = 65;

document.addEventListener('touchstart', (e) => {
    // Only allow pull-to-refresh if we are at the absolute top of the page
    if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
        ptrContainer.style.transition = 'none'; // Disable transition during drag
    }
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!isPulling) return;
    
    // Check if we are still at the top
    if (window.scrollY > 0) {
        isPulling = false;
        ptrContainer.style.height = '0px';
        return;
    }
    
    const currentY = e.touches[0].clientY;
    const pullDistance = currentY - startY;

    // Add resistance to the pull
    if (pullDistance > 0) {
        currentHeight = pullDistance / resistance;
        
        // Cap visual height slightly above threshold
        const visualHeight = Math.min(currentHeight, threshold + 20);
        ptrContainer.style.height = `${visualHeight}px`;
        
        // Scale icon based on pull distance
        const iconWrap = ptrContainer.querySelector('div');
        if (iconWrap) {
            const scale = Math.min(1.2, 0.5 + (currentHeight / threshold) * 0.7);
            iconWrap.style.transform = `scale(${scale})`;
        }

        // Prevent default scrolling only when positively pulling down
        if (e.cancelable) e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchend', () => {
    if (!isPulling) return;
    isPulling = false;

    ptrContainer.style.transition = 'height 0.3s cubic-bezier(0.1, 0.7, 0.1, 1)';
    
    if (currentHeight >= threshold) {
        // Trigger refresh
        ptrContainer.style.height = `${threshold}px`;
        
        // Provide haptic feedback if available
        if (navigator.vibrate) navigator.vibrate(50);
        
        setTimeout(() => {
            window.location.reload();
        }, 500);
    } else {
        // Cancel refresh
        ptrContainer.style.height = '0px';
        currentHeight = 0;
    }
});