import { AuthService } from '../services/auth.js';

// Simple state management for authentication
export class AuthState {
    constructor() {
        this.authService = new AuthService();
        this.listeners = [];
        this.currentSession = null;
        this.isInitialized = false;

        // Don't call init() in constructor - let caller handle async initialization
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            const { session } = await this.authService.getSession();
            this.currentSession = session;
            this.isInitialized = true;
            this.notifyListeners('initialized', session);

            // Listen for auth changes
            this.setupAuthListener();

        } catch (error) {
            console.error('Auth state initialization error:', error);
            this.isInitialized = true; // Mark as initialized even on error
            this.notifyListeners('error', error);
        }
    }

    async setupAuthListener() {
        try {
            const supabase = await this.authService.ensureInitialized();
            supabase.auth.onAuthStateChange((event, session) => {
                this.currentSession = session;
                this.notifyListeners(event, session);
            });
        } catch (error) {
            console.error('Failed to setup auth listener:', error);
        }
    }

    // Subscribe to auth state changes
    subscribe(callback) {
        this.listeners.push(callback);

        // If already initialized, call immediately with current state
        if (this.isInitialized) {
            callback('initialized', this.currentSession);
        }

        // Return unsubscribe function
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    // Notify all listeners
    notifyListeners(event, session) {
        this.listeners.forEach(callback => {
            try {
                callback(event, session);
            } catch (error) {
                console.error('Error in auth state listener:', error);
            }
        });
    }

    // Get current session
    getSession() {
        return this.currentSession;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.currentSession;
    }

    // Get current user
    getUser() {
        return this.currentSession?.user || null;
    }
}

// Create singleton instance
export const authState = new AuthState();