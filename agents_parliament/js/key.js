/**
 * KeyManager - Handles API key storage, retrieval, and validation
 */
export class KeyManager {
    constructor() {
        this.apiKey = null; // Store API key in memory, not DOM
    }

    /**
     * Restore API key from sessionStorage if available
     * @param {HTMLElement} apiKeyInput - The API key input element (optional, for placeholder update)
     * @returns {boolean} True if API key was successfully restored
     */
    restoreFromStorage(apiKeyInput = null) {
        try {
            const stored = sessionStorage.getItem('parliament_api_key_remember');
            if (stored === 'true') {
                const key = sessionStorage.getItem('parliament_api_key');
                if (key && key.trim() !== '') {
                    // Store in memory but don't show in input field for security
                    this.apiKey = key.trim();
                    if (apiKeyInput) {
                        apiKeyInput.placeholder = 'API key restored from session (hidden)';
                    }
                    return true;
                } else {
                    // Clear invalid stored key
                    sessionStorage.removeItem('parliament_api_key');
                    sessionStorage.removeItem('parliament_api_key_remember');
                }
            }
        } catch (error) {
            // sessionStorage not available or blocked
            console.warn('Could not access sessionStorage:', error);
        }
        return false;
    }

    /**
     * Get API key from input field or memory
     * @param {string} inputKey - The API key from the input field
     * @returns {string|null} The API key, or null if not available
     */
    getKey(inputKey = null) {
        return inputKey || this.apiKey;
    }

    /**
     * Validate and set API key from input or memory
     * @param {string} inputKey - The API key from the input field
     * @returns {string|null} The validated API key, or null if invalid
     */
    validateAndSet(inputKey = null) {
        let apiKey = this.getKey(inputKey);
        
        if (!apiKey || apiKey.trim() === '') {
            return null;
        }

        // Trim whitespace
        apiKey = apiKey.trim();

        // If user entered a new key, use that (they may want to change it)
        if (inputKey && inputKey.trim() !== this.apiKey) {
            apiKey = inputKey.trim();
        }

        // Validate API key format (OpenRouter keys typically start with 'sk-or-')
        if (!apiKey.startsWith('sk-')) {
            console.warn('API key format may be incorrect. OpenRouter keys typically start with "sk-or-"');
        }

        // Store in memory
        this.apiKey = apiKey;
        
        return apiKey;
    }

    /**
     * Save API key to sessionStorage if user opts in
     */
    saveToStorage() {
        try {
            // Check if user wants to remember (could add a checkbox in UI)
            // For now, we'll save it for the session only
            if (this.apiKey) {
                sessionStorage.setItem('parliament_api_key', this.apiKey);
                sessionStorage.setItem('parliament_api_key_remember', 'true');
            }
        } catch (error) {
            // sessionStorage not available
            console.warn('Could not save to sessionStorage:', error);
        }
    }

    /**
     * Clear API key from memory (for security)
     */
    clear() {
        this.apiKey = null;
        try {
            sessionStorage.removeItem('parliament_api_key');
            sessionStorage.removeItem('parliament_api_key_remember');
        } catch (error) {
            // Ignore
        }
    }

    /**
     * Get the current API key from memory
     * @returns {string|null} The API key, or null if not set
     */
    getCurrentKey() {
        return this.apiKey;
    }
}

