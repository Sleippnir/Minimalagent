// UI utility functions
export class UIUtils {
    // Show/hide elements
    static show(element) {
        element.classList.remove('hidden');
    }

    static hide(element) {
        element.classList.add('hidden');
    }

    // Set loading state for buttons
    static setLoading(button, text = 'Loading...', loading = true) {
        const loader = button.querySelector('.loader');
        const textSpan = button.querySelector('span') || button;

        if (loading) {
            if (loader) loader.classList.remove('hidden');
            if (textSpan) textSpan.textContent = text;
            button.disabled = true;
        } else {
            if (loader) loader.classList.add('hidden');
            if (textSpan) textSpan.textContent = text;
            button.disabled = false;
        }
    }

    // Show error message
    static showError(element, message) {
        element.textContent = message;
        this.show(element);
    }

    // Hide error message
    static hideError(element) {
        this.hide(element);
    }

    // Create log item for activity logs
    static createLogItem(message, type = 'info') {
        const logItem = document.createElement('div');
        logItem.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logItem.className = `log-item log-${type}`;
        return logItem;
    }

    // Add log to activity log container
    static addLog(container, message, type = 'info') {
        const logItem = this.createLogItem(message, type);
        container.prepend(logItem);
    }

    // Enable/disable form inputs
    static setFormDisabled(form, disabled = true) {
        const inputs = form.querySelectorAll('input, button, select, textarea');
        inputs.forEach(input => {
            input.disabled = disabled;
        });
    }
}