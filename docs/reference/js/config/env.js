// Environment configuration loader
// Loads environment variables from .env.local file for client-side use

class EnvLoader {
    constructor() {
        this.env = {};
        this.loaded = false;
    }

    async load() {
        if (this.loaded) return this.env;

        try {
            // Try to load .env.local file from frontend root
            const response = await fetch('../../.env.local');
            if (response.ok) {
                const envText = await response.text();
                this.parseEnvFile(envText);
            } else {
                console.warn('.env.local file not found, using default values');
                this.setDefaults();
            }
        } catch (error) {
            console.warn('Error loading .env.local:', error);
            this.setDefaults();
        }

        this.loaded = true;
        return this.env;
    }

    parseEnvFile(content) {
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
                    this.env[key.trim()] = value.trim();
                }
            }
        }
    }

    setDefaults() {
        // Default values for development - these should be overridden by .env.local
        console.warn('Using default environment values. Make sure .env.local is properly configured.');
        this.env = {
            VITE_SUPABASE_URL: '',
            VITE_SUPABASE_ANON_KEY: '',
            VITE_API_BASE_URL: 'http://localhost:8000',
            VITE_APP_ENV: 'development'
        };
    }

    get(key, defaultValue = null) {
        return this.env[key] || defaultValue;
    }

    getAll() {
        return { ...this.env };
    }
}

// Create singleton instance
export const envLoader = new EnvLoader();

// Convenience function to get environment variables
export const getEnv = (key, defaultValue = null) => envLoader.get(key, defaultValue);

// Load environment on module import
envLoader.load().then(() => {
    // Environment loaded silently for security
}).catch(error => {
    console.error('Failed to load environment');
});