import { getSupabaseClient } from '../config/supabase.js';

// Authentication service
export class AuthService {
    constructor() {
        this.supabase = null;
        this.initialized = false;
    }

    async ensureInitialized() {
        if (!this.initialized) {
            this.supabase = await getSupabaseClient();
            this.initialized = true;
        }
        return this.supabase;
    }

    // Sign in with email and password
    async signInWithPassword(email, password) {
        await this.ensureInitialized();
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });
        return { data, error };
    }

    // Sign out
    async signOut() {
        await this.ensureInitialized();
        const { error } = await this.supabase.auth.signOut();
        return { error };
    }

    // Get current session
    async getSession() {
        await this.ensureInitialized();
        const { data: { session }, error } = await this.supabase.auth.getSession();
        return { session, error };
    }

    // Listen to auth state changes
    onAuthStateChange(callback) {
        return this.supabase.auth.onAuthStateChange(callback);
    }

    // Reset password
    async resetPassword(email, redirectTo) {
        const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
            redirectTo
        });
        return { error };
    }

    // Check if user is authenticated
    async isAuthenticated() {
        const { session } = await this.getSession();
        return !!session;
    }
}