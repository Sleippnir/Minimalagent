// Supabase configuration with environment variables
import { envLoader } from './env.js';

// Async initialization of Supabase configuration
let supabaseConfig = null;
let supabaseClient = null;

/**
 * Initialize and cache the Supabase configuration and client.
 *
 * Ensures environment variables are loaded, validates required variables, builds and caches
 * the config object, and creates a Supabase client instance for subsequent calls.
 *
 * @returns {{url: string, key: string}} The Supabase configuration object with `url` and `key`.
 * @throws {Error} If required Supabase environment variables are missing.
 */
export async function initializeSupabase() {
    if (supabaseConfig) return supabaseConfig;

    // Ensure environment is loaded
    await envLoader.load();

    // Load environment variables
    const SUPABASE_URL = envLoader.get('VITE_SUPABASE_URL');
    const SUPABASE_KEY = envLoader.get('VITE_SUPABASE_ANON_KEY');

    // Validate required environment variables
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing required Supabase environment variables. Please check your .env.local file.');
        throw new Error('Supabase configuration incomplete');
    }

    supabaseConfig = {
        url: SUPABASE_URL,
        key: SUPABASE_KEY
    };

    // Create Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

    return supabaseConfig;
}

/**
 * Retrieve the cached Supabase configuration, initializing it first if it has not been created.
 * @returns {{url: string, key: string}} The Supabase configuration object with `url` and `key`.
 * @throws {Error} If required environment variables are missing and initialization fails.
 */
export async function getSupabaseConfig() {
    if (!supabaseConfig) {
        await initializeSupabase();
    }
    return supabaseConfig;
}

/**
 * Gets the initialized Supabase client, initializing it if necessary.
 * @returns {any} The Supabase client instance.
 */
export async function getSupabaseClient() {
    if (!supabaseClient) {
        await initializeSupabase();
    }
    return supabaseClient;
}

// For backward compatibility, export a promise that resolves to the config
export const SUPABASE_CONFIG = initializeSupabase();

// For backward compatibility, export a promise that resolves to the client
export const supabase = getSupabaseClient();

// Keep the createClient export for compatibility
export const createClient = async (url, key) => {
    const { createClient: create } = await import('https://esm.sh/@supabase/supabase-js@2');
    return create(url, key);
};