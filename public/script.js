
document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector("form");
    const emailInput = document.querySelector(".email-input");
    const passwordInput = document.querySelector(".password-input");
    const reEnterPasswordInput = document.querySelector(".re-enter-password-input");
    const emailError = document.querySelector(".email-error");
    const passwordError = document.querySelector(".password-error");
    const reEnterPasswordError = document.querySelector(".re-enter-password-error");

    form.addEventListener("submit", function (event) {
        let valid = true;

        // Reset error messages
        emailError.style.display = "none";
        passwordError.style.display = "none";
        reEnterPasswordError.style.display = "none";

        // Email validation (standard email format)
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(emailInput.value)) {
            emailError.textContent = "Invalid email format";
            emailError.style.display = "block";
            valid = false;
        }

        // Password validation (Minimum 8 characters, at least one letter and one number)
        const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        let isPasswordValid = passwordRegex.test(passwordInput.value);
        if (!isPasswordValid) {
            passwordError.textContent = "Password must be at least 8 characters long and include at least one letter one number and one special character.";
            passwordError.style.display = "block";
            valid = false;
        }

        // Check if re-entered password matches the original password only if password format is correct
        if (isPasswordValid && reEnterPasswordInput.value !== passwordInput.value) {
            reEnterPasswordError.textContent = "Passwords do not match";
            reEnterPasswordError.style.display = "block";
            valid = false;
        }

        if (!valid) {
            event.preventDefault(); // Prevent form submission if validation fails
        }
    });
});

document.addEventListener("DOMContentLoaded", function () {
    const profileDropdown = document.querySelector(".profile-drop-down");
    const profileIcon = document.querySelector(".profile-icon"); // Adjust according to your HTML

    profileIcon.addEventListener("click", function () {
        profileDropdown.classList.toggle("active");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", function (event) {
        if (!profileDropdown.contains(event.target) && !profileIcon.contains(event.target)) {
            profileDropdown.classList.remove("active");
        }
    });
});

document.getElementById("imageUpload").addEventListener("change", function (event) {
    const file = event.target.files[0]; // Get the selected file
    if (file) {
        const reader = new FileReader(); // Create a FileReader object
        reader.onload = function () {
            document.getElementById("previewImage").src = reader.result; // Set preview image
        };
        reader.readAsDataURL(file); // Read file as a Data URL
    }
});
document.addEventListener("DOMContentLoaded", function () {
    if (window.location.pathname.includes("register")) {
        // Hide login and signup buttons
        document.getElementById("login-button").style.display = "none";
        document.getElementById("signup-button").style.display = "none";
        
        // Center the navbar links by removing margin-left
        const navbarLinks = document.querySelector('.navbar-links');
        if (navbarLinks) {
            navbarLinks.style.display= "none";
        }
    }
});
  // Navbar scroll effect
        window.addEventListener('scroll', function() {
            const navbar = document.querySelector('.navbar');
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });

        // Button ripple effect
        document.querySelectorAll('#login-button, #signup-button, .cta-button').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Create ripple element
                const ripple = document.createElement('span');
                ripple.classList.add('ripple');
                this.appendChild(ripple);
                
                // Get click position
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                // Position and animate ripple
                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';
                
                // Remove ripple after animation
                setTimeout(() => {
                    ripple.remove();
                }, 600);
                
                // Navigate after animation
                setTimeout(() => {
                    window.location.href = this.getAttribute('href');
                }, 300);
            });
        });

        // Form animation on load
        document.addEventListener('DOMContentLoaded', function() {
            // Input focus effects
            const inputs = document.querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('focus', function() {
                    this.parentElement.style.transform = 'scale(1.02)';
                });
                
                input.addEventListener('blur', function() {
                    this.parentElement.style.transform = 'scale(1)';
                });
            });
            
            // Button ripple effect
            const loginBtn = document.querySelector('.login-btn');
            loginBtn.addEventListener('click', function(e) {
                // Create ripple element
                const ripple = document.createElement('span');
                ripple.classList.add('ripple');
                this.appendChild(ripple);
                
                // Get click position
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                // Position and animate ripple
                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';
                
                // Remove ripple after animation
                setTimeout(() => {
                    ripple.remove();
                }, 600);
            });
            
            // Add ripple style
            const style = document.createElement('style');
            style.textContent = `
                .ripple {
                    position: absolute;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.3);
                    transform: scale(0);
                    animation: ripple 0.6s linear;
                }
                
                @keyframes ripple {
                    to {
                        transform: scale(4);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        });