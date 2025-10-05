import { AuthService } from './js/services/auth.js';
import { UIUtils } from './js/utils/ui.js';
import { AuthForm } from './js/components/auth-form.js';
import { authState } from './js/state/auth-state.js';

// DOM Elements
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const errorMessage = document.getElementById('error-message');
const forgotPasswordLink = document.getElementById('forgot-password');
const debugInfo = document.getElementById('debug-info');
const debugAuthState = document.getElementById('debug-auth-state');

// Initialize services
const authService = new AuthService();

// Initialize auth form component
const authForm = new AuthForm(loginForm, {
    errorElement: errorMessage,
    loadingButton: loginBtn,
    redirectTo: null, // We'll handle redirection manually based on role
    onSuccess: (data) => {
        debugAuthState.textContent = 'Authenticated';

        // Role-based redirection
        const user = data.user;
        const isHR = user.user_metadata?.role === 'hr' ||
                    user.user_metadata?.role === 'recruiter' ||
                    user.email?.includes('hr@') ||
                    user.email?.includes('recruiter@');

        if (isHR) {
            window.location.href = 'hr/dashboard.html';
        } else {
            window.location.href = 'interview_creation.html';
        }
    },
    onError: (error) => {
        debugAuthState.textContent = 'Login failed';
    }
});

// Handle forgot password
function handleForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();

    if (!email) {
        UIUtils.showError(errorMessage, 'Please enter your email address first.');
        return;
    }

    // For now, show a simple alert. In production, implement proper forgot password flow
    alert(`Password reset link sent to ${email}. Please check your email.`);

    // Uncomment for actual implementation:
    // authService.resetPassword(email, window.location.origin + '/reset-password');
}

// Check if user is already logged in
function checkAuthState() {
    if (authState.isAuthenticated()) {
        debugAuthState.textContent = 'Already authenticated';

        // Role-based redirection for already logged in users
        const user = authState.getUser();
        const isHR = user.user_metadata?.role === 'hr' ||
                    user.user_metadata?.role === 'recruiter' ||
                    user.email?.includes('hr@') ||
                    user.email?.includes('recruiter@');

        if (isHR) {
            window.location.href = 'hr/dashboard.html';
        } else {
            window.location.href = 'interview_creation.html';
        }
    } else {
        debugAuthState.textContent = 'Not authenticated';
    }
}

// Listen for auth state changes
const unsubscribe = authState.subscribe((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        debugAuthState.textContent = 'Signed in';

        // Role-based redirection
        const user = session.user;
        const isHR = user.user_metadata?.role === 'hr' ||
                    user.user_metadata?.role === 'recruiter' ||
                    user.email?.includes('hr@') ||
                    user.email?.includes('recruiter@');

        if (isHR) {
            window.location.href = 'hr/dashboard.html';
        } else {
            window.location.href = 'interview_creation.html';
        }
    } else if (event === 'SIGNED_OUT') {
        debugAuthState.textContent = 'Signed out';
    } else if (event === 'initialized') {
        checkAuthState();
    }
});

// Event listeners
forgotPasswordLink.addEventListener('click', handleForgotPassword);

// Show debug info if URL contains debug parameter
if (window.location.search.includes('debug')) {
    UIUtils.show(debugInfo);
}