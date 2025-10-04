// Main application entry point
// Global utilities and initialization

// Debug mode
window.DEBUG = window.location.search.includes('debug');

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.DEBUG) {
        alert(`Error: ${event.error.message}`);
    }
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.DEBUG) {
        alert(`Unhandled error: ${event.reason}`);
    }
});

// Utility to check if we're in development
window.isDevelopment = () => {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
};

// Export for modules
export { }; // Empty export to make this a module