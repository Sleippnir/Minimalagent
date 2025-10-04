import { AuthService } from './js/services/auth.js';
import { UIUtils } from './js/utils/ui.js';
import { authState } from './js/state/auth-state.js';

// DOM Elements
const loadingState = document.getElementById('loading-state');
const successState = document.getElementById('success-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const debugInfo = document.getElementById('debug-info');
const debugInterviewId = document.getElementById('debug-interview-id');
const debugAuthState = document.getElementById('debug-auth-state');
const debugUrlParams = document.getElementById('debug-url-params');

// Initialize services
const authService = new AuthService();

let interviewId = null;

// Parse URL parameters
function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    interviewId = urlParams.get('interview_id');
    debugInterviewId.textContent = interviewId || 'Not found';
    debugUrlParams.textContent = window.location.search || 'No parameters';
    return interviewId;
}

// Show different states
function showState(state) {
    UIUtils.hide(loadingState);
    UIUtils.hide(successState);
    UIUtils.hide(errorState);

    if (state === 'loading') UIUtils.show(loadingState);
    else if (state === 'success') UIUtils.show(successState);
    else if (state === 'error') UIUtils.show(errorState);
}

// Handle authentication state changes
async function handleAuthStateChange() {
    try {
        const session = authState.getSession();

        debugAuthState.textContent = session ? 'Authenticated' : 'Not authenticated';

        if (session) {
            // User is authenticated, redirect to interview
            showState('success');

            // Redirect to interview page with auth token
            setTimeout(() => {
                window.location.href = `/interview.html?interview_id=${interviewId}&token=${session.access_token}`;
            }, 2000);
        } else {
            // No session, this might be a magic link callback
            // The auth state listener will handle the magic link automatically
        }
    } catch (err) {
        console.error('Error checking auth state:', err);
        showState('error');
        UIUtils.showError(errorMessage, `Error: ${err.message}`);
    }
}

// Retry authentication
function retryAuth() {
    showState('loading');
    handleAuthStateChange();
}

// Initialize
async function init() {
    // Parse URL parameters
    if (!parseUrlParams()) {
        showState('error');
        UIUtils.showError(errorMessage, 'No interview ID found in URL. Please check your email link.');
        return;
    }

    // Initialize auth state
    await authState.initialize();

    // Listen for auth state changes (handles magic link authentication)
    const unsubscribe = authState.subscribe((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            showState('success');
            setTimeout(() => {
                window.location.href = `/interview.html?interview_id=${interviewId}&token=${session.access_token}`;
            }, 2000);
        } else if (event === 'SIGNED_OUT') {
            // Handle sign out if needed
        } else if (event === 'initialized') {
            handleAuthStateChange();
        }
    });

    // Check current auth state
    await handleAuthStateChange();

    // Show debug info if URL contains debug parameter
    if (window.location.search.includes('debug')) {
        UIUtils.show(debugInfo);
    }
}

// Start the authentication process
init().catch(err => {
    console.error('Initialization error:', err);
    showState('error');
    UIUtils.showError(errorMessage, `Initialization failed: ${err.message}`);
});