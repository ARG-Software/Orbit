// Waitlist Form Handler
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('waitlist-form');
    const emailInput = document.getElementById('email-input');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const btnLoader = document.getElementById('btn-loader');
    const successMessage = document.getElementById('success-message');

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const email = emailInput.value;
            if (!email) return;

            emailInput.disabled = true;
            submitBtn.disabled = true;
            btnText.classList.add('hidden');
            btnLoader.classList.remove('hidden');

            setTimeout(() => {
                form.classList.add('hidden');
                successMessage.classList.remove('hidden');
                console.log(`User joined waitlist: ${email}`);
            }, 1500);
        });
    }

    initScreenshotModal();
    initScrollReveal();
});

// Screenshot Modal
function initScreenshotModal() {
    const screenshots = document.querySelectorAll('.screenshot-zoom');
    const modal = document.getElementById('screenshot-modal');
    const modalImage = document.getElementById('modal-image');

    screenshots.forEach(screenshot => {
        screenshot.addEventListener('click', () => {
            const img = screenshot.querySelector('img');
            if (img && modal && modalImage) {
                modalImage.src = img.src;
                modalImage.alt = img.alt;
                modal.showModal();
            }
        });
    });
}

// Tab content
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
const indicator = document.getElementById("tab-indicator");

function switchTab(index) {
    const panels = document.querySelectorAll('.tab-panel');
    const indicator = document.getElementById('tab-indicator');

    // Move indicator smoothly
    if (indicator) {
        const containerWidth = indicator.parentElement.offsetWidth;
        const tabWidth = (containerWidth - 24) / 3;
        indicator.style.width = `${tabWidth}px`;
        indicator.style.transform = `translateX(${8 + index * (tabWidth + 8)}px)`;
    }

    // Fade out current panel
    const activePanel = Array.from(panels).find(p => !p.classList.contains('hidden'));
    if (activePanel) {
        activePanel.style.opacity = '0';
        setTimeout(() => activePanel.classList.add('hidden'), 200);
    }

    // Fade in new panel
    const newPanel = panels[index];
    setTimeout(() => {
        newPanel.classList.remove('hidden');
        newPanel.style.opacity = '0';

        requestAnimationFrame(() => {
            newPanel.style.transition = 'opacity 0.35s ease';
            newPanel.style.opacity = '1';
        });
    }, 200);

    // Button state
    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
        if (i === index) {
            btn.classList.add('text-white');
            btn.classList.remove('text-base-content/60', 'hover:text-base-content');
        } else {
            btn.classList.remove('text-white');
            btn.classList.add('text-base-content/60', 'hover:text-base-content');
        }
    });
}


// Scroll reveal

function initScrollReveal() {
    // Cards
    const cardObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
            }
        });
    }, { 
        threshold: 0.15,
        rootMargin: '-50px'
    });

    document.querySelectorAll('.card').forEach(el => {
        el.classList.add('scroll-reveal');
        cardObserver.observe(el);
    });

    // Sections
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
            }
        });
    }, { 
        threshold: 0.1,
        rootMargin: '-100px'
    });

    document.querySelectorAll('section').forEach(el => {
        sectionObserver.observe(el);
    });

    // Stats – count-up numbers
    const statObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.counted) {
                entry.target.dataset.counted = 'true';
                animateValue(entry.target);
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('.text-4xl').forEach(el => {
        if (el.textContent.match(/[\d,]+/)) {
            statObserver.observe(el);
        }
    });
}

// Count up
function animateValue(element) {
    const text = element.textContent;
    const hasPlus = text.includes('+');
    const hasPercent = text.includes('%');
    const hasDollar = text.includes('$');
    const hasM = text.includes('M');
    const hasK = text.includes('k');
    
    const numMatch = text.match(/[\d,.]+/);
    if (!numMatch) return;
    
    const numStr = numMatch[0].replace(/,/g, '');
    const endValue = parseFloat(numStr);
    const duration = 1500;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        
        let currentValue = endValue * ease;
        let displayValue;
        
        if (hasM) {
            displayValue = currentValue.toFixed(1);
        } else {
            displayValue = Math.floor(currentValue).toLocaleString();
        }
        
        let newText = displayValue;
        if (hasDollar) newText = '$' + newText;
        if (hasM) newText += 'M';
        if (hasK) newText += 'k';
        if (hasPercent) newText += '%';
        if (hasPlus) newText += '+';
        
        element.textContent = newText;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}
