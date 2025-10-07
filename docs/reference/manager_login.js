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

/**
 * Handle the forgot-password link click by validating the email and initiating a password-reset flow.
 *
 * Prevents the default link behavior, reads and trims the '#email' input, shows an inline error if the email is empty, and otherwise triggers the password-reset notification/flow (currently a placeholder alert).
 * @param {Event} event - Click event from the forgot-password link. 
 */
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

/**
 * Verifies the current authentication state and performs role-based redirection.
 *
 * If the user is authenticated, updates the debug status and navigates to 'hr/dashboard.html' when the user's role is 'hr' or 'recruiter' (determined from user_metadata.role or the user's email containing 'hr' or 'recruiter'); otherwise navigates to 'interview_creation.html'. If not authenticated, updates the debug status accordingly.
 */
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