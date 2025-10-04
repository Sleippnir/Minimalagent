import { AuthService } from '../services/auth.js';
import { UIUtils } from '../utils/ui.js';

// Reusable auth form component
export class AuthForm {
    constructor(formElement, options = {}) {
        this.form = formElement;
        this.authService = new AuthService();
        this.options = {
            onSuccess: options.onSuccess || (() => {}),
            onError: options.onError || (() => {}),
            redirectTo: options.redirectTo || null,
            ...options
        };

        this.errorElement = options.errorElement;
        this.loadingButton = options.loadingButton;

        this.init();
    }

    init() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
    }

    async handleSubmit(event) {
        event.preventDefault();

        if (this.errorElement) UIUtils.hideError(this.errorElement);

        const formData = new FormData(this.form);
        const email = formData.get('email')?.trim();
        const password = formData.get('password');

        if (!email || !password) {
            if (this.errorElement) UIUtils.showError(this.errorElement, 'Please enter both email and password.');
            return;
        }

        if (this.loadingButton) UIUtils.setLoading(this.loadingButton, 'Signing In...', true);
        if (this.form) UIUtils.setFormDisabled(this.form, true);

        try {
            const { data, error } = await this.authService.signInWithPassword(email, password);

            if (error) throw error;

            this.options.onSuccess(data);

            if (this.options.redirectTo) {
                window.location.href = this.options.redirectTo;
            }

        } catch (error) {
            console.error('Login error:', error);

            let errorMessage = 'Login failed. Please try again.';
            if (error.message.includes('Invalid login credentials')) {
                errorMessage = 'Invalid email or password. Please check your credentials.';
            } else if (error.message.includes('Email not confirmed')) {
                errorMessage = 'Please check your email and confirm your account.';
            } else {
                errorMessage = `Login failed: ${error.message}`;
            }

            if (this.errorElement) UIUtils.showError(this.errorElement, errorMessage);
            this.options.onError(error);

        } finally {
            if (this.loadingButton) UIUtils.setLoading(this.loadingButton, 'Sign In', false);
            if (this.form) UIUtils.setFormDisabled(this.form, false);
        }
    }
}