
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('waitlist-form');
    const emailInput = document.getElementById('email-input');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const btnLoader = document.getElementById('btn-loader');
    const successMessage = document.getElementById('success-message');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = emailInput.value;
        if (!email) return;

        // Start loading state
        emailInput.disabled = true;
        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');

        // Simulate API request
        setTimeout(() => {
            // Success state
            form.classList.add('hidden');
            successMessage.classList.remove('hidden');
            
            console.log(`User joined waitlist: ${email}`);
        }, 1500);
    });
});
