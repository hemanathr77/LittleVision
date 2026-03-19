// Prevent native pull-to-refresh and elastic bounce on mobile via JS
let touchStartY = 0;

document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
    }
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;

    const touchY = e.touches[0].clientY;
    const touchDiff = touchY - touchStartY;
    
    // If pulling down
    if (touchDiff > 0) {
        const scrollable = e.target.closest('.chat-messages, .sidebar-scroll, textarea, .overflow-y-auto');
        
        if (scrollable) {
            // If at the absolute top of the scrollable container, prevent pull-to-refresh
            if (scrollable.scrollTop <= 0) {
                if (e.cancelable) e.preventDefault();
            }
        } else {
            // Not in a scrollable container, prevent body pull
            if (e.cancelable) e.preventDefault();
        }
    }
}, { passive: false });