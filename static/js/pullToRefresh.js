const ptrTemplate = document.createElement('div');
ptrTemplate.innerHTML = \<div id='pullToRefresh' class='flex justify-center items-center w-full fixed top-0 left-0 z-50 overflow-hidden text-neutral-500 h-0 transition-all duration-300'>
    <div class='flex flex-col items-center justify-center'>
        <svg class='w-6 h-6 animate-spin text-indigo-500' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
            <circle class='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' stroke-width='4'></circle>
            <path class='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
        </svg>
    </div>
</div>\;

document.addEventListener('DOMContentLoaded', () => {
    document.body.prepend(ptrTemplate.firstElementChild);
});

let startY = 0;
let isPulling = false;
const pThreshold = 80;

document.addEventListener('touchstart', e => {
    if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
    }
}, { passive: true });

document.addEventListener('touchmove', e => {
    if (!isPulling) return;
    const currentY = e.touches[0].clientY;
    const pullDistance = currentY - startY;
    if (pullDistance > 0 && window.scrollY === 0) {
        const ptr = document.getElementById('pullToRefresh');
        if (ptr) {
            ptr.style.transition = 'none';
            ptr.style.height = \\px\;
        }
        if (e.cancelable) e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchend', e => {
    if (!isPulling) return;
    isPulling = false;
    const ptr = document.getElementById('pullToRefresh');
    if (!ptr) return;
    const height = parseInt(ptr.style.height || '0');
    ptr.style.transition = 'height 0.3s cubic-bezier(0.1, 0.7, 0.1, 1)';
    if (height >= 50) {
        ptr.style.height = '60px';
        setTimeout(() => window.location.reload(), 500);
    } else {
        ptr.style.height = '0px';
    }
});