/**
 * Handles all authentication logic for the frontend.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Logic for Login Page ---
    const loginButton = document.getElementById('login-button');
    const passwordInput = document.getElementById('password');
    const errorMessageDiv = document.getElementById('error-message');

    if (loginButton) {
        loginButton.addEventListener('click', handleLogin);
    }

    if (passwordInput) {
        passwordInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                handleLogin();
            }
        });
    }

    async function handleLogin() {
        const password = passwordInput.value;
        if (!password) {
            showError('Password tidak boleh kosong.');
            return;
        }

        showError(''); // Clear previous errors
        loginButton.innerHTML = 'Memproses...';
        loginButton.disabled = true;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
            });

            const data = await response.json();

            if (response.ok) {
                // On successful login, redirect to the main app
                window.location.href = '/';
            } else {
                showError(data.error || 'Terjadi kesalahan tidak diketahui.');
            }
        } catch (error) {
            console.error('Login request failed:', error);
            showError('Tidak dapat terhubung ke server.');
        } finally {
            loginButton.innerHTML = 'Login';
            loginButton.disabled = false;
        }
    }

    function showError(message) {
        if (message) {
            errorMessageDiv.textContent = message;
            errorMessageDiv.style.display = 'block';
        } else {
            errorMessageDiv.style.display = 'none';
        }
    }

    window.togglePasswordVisibility = function() {
        const icon = document.getElementById('toggle-icon');
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
        passwordInput.focus();
    };
});

// --- Logic for Main Application ---

/**
 * Checks login status when the main app loads.
 * If not logged in, redirects back to the login page.
 */
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/status');
        if (!response.ok) {
             // If status check fails, redirect to login
            window.location.href = '/login';
            return;
        }
        const data = await response.json();
        if (!data.logged_in) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Error checking login status:', error);
        // If there's a network error, it's safer to redirect to login
        window.location.href = '/login';
    }
}

/**
 * Handles the logout process with a confirmation dialog.
 */
async function handleLogout() {
    // Show a confirmation dialog before logging out
    if (confirm('Apakah Anda yakin ingin logout?')) {
        try {
            await fetch('/api/logout');
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            // Always redirect to login page after attempting logout
            window.location.href = '/login';
        }
    }
}

// This function can be called from a logout button in the main app's HTML
// e.g., <button onclick="logout()">Logout</button>
window.logout = handleLogout;

// If we are on the main page, check the status
if (document.getElementById('main-content')) { // Check if it's the main app page
    checkLoginStatus();
}
