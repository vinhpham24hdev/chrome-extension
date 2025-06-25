// public/login/login-dom.js - CSP-compliant DOM handling
(function() {
    'use strict';

    // DOM utility functions
    const DOM = {
        get: (id) => document.getElementById(id),
        show: (element) => element && (element.style.display = 'block'),
        hide: (element) => element && (element.style.display = 'none'),
        addClass: (element, className) => element && element.classList.add(className),
        removeClass: (element, className) => element && element.classList.remove(className),
        setHTML: (element, html) => element && (element.innerHTML = html),
        setText: (element, text) => element && (element.textContent = text),
        getValue: (element) => element ? element.value : '',
        setValue: (element, value) => element && (element.value = value)
    };

    // Auth monitoring system
    let authCheckInterval = null;
    let closeTimeout = null;

    // Initialize when DOM is ready
    function initializePage() {
        console.log('🚀 Initializing login page...');
        
        setupFormHandlers();
        setupAuthMonitoring();
        autoFocusEmail();
        setupKeyboardHandlers();
        setupFormValidation();
        checkInitialState();
    }

    function setupFormHandlers() {
        const form = DOM.get('login-form');
        const emailInput = DOM.get('email');
        const passwordInput = DOM.get('password');
        const forgotPasswordLink = DOM.get('forgot-password-link');
        const mockModeToggle = DOM.get('mock-mode-toggle');

        // Form submission
        if (form) {
            form.addEventListener('submit', handleFormSubmit);
        }

        // Input handlers
        if (emailInput) {
            emailInput.addEventListener('input', handleInputChange);
            emailInput.addEventListener('blur', handleInputBlur);
        }

        if (passwordInput) {
            passwordInput.addEventListener('input', handleInputChange);
            passwordInput.addEventListener('blur', handleInputBlur);
        }

        // Forgot password
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', handleForgotPassword);
        }

        // Mock mode toggle
        if (mockModeToggle) {
            mockModeToggle.addEventListener('click', handleMockModeToggle);
        }
    }

    function handleFormSubmit(event) {
        event.preventDefault();
        
        const emailInput = DOM.get('email');
        const passwordInput = DOM.get('password');
        
        const credentials = {
            email: DOM.getValue(emailInput)?.trim() || '',
            password: DOM.getValue(passwordInput) || ''
        };

        console.log('📤 Form submitted');
        
        // Trigger the React app's form submission
        // This will be handled by the React component
        window.dispatchEvent(new CustomEvent('loginFormSubmit', {
            detail: credentials
        }));
    }

    function handleInputChange(event) {
        const input = event.target;
        
        // Clear error styling
        DOM.removeClass(input, 'error');
        
        // Clear error messages
        clearMessages();
        
        // Trigger React update
        window.dispatchEvent(new CustomEvent('loginInputChange', {
            detail: {
                name: input.name,
                value: input.value
            }
        }));
    }

    function handleInputBlur(event) {
        const input = event.target;
        
        // Visual validation feedback
        if (input.required && !input.value.trim()) {
            DOM.addClass(input, 'error');
        } else {
            DOM.removeClass(input, 'error');
        }
    }

    function handleForgotPassword(event) {
        event.preventDefault();
        
        showMessage('Password reset functionality will be implemented soon.', 'info');
    }

    function handleMockModeToggle(event) {
        event.preventDefault();
        
        // Trigger React mock mode toggle
        window.dispatchEvent(new CustomEvent('mockModeToggle'));
    }

    function setupAuthMonitoring() {
        console.log('👀 Starting auth monitoring...');
        
        authCheckInterval = setInterval(async () => {
            try {
                const authState = await getStoredAuthState();
                
                if (authState && authState.isLoggedIn && authState.currentUser) {
                    console.log('✅ Authentication detected!');
                    handleSuccessfulLogin(authState);
                }
            } catch (error) {
                console.error('Auth monitoring error:', error);
            }
        }, 1000);
    }

    async function handleSuccessfulLogin(authState) {
        // Stop monitoring
        if (authCheckInterval) {
            clearInterval(authCheckInterval);
            authCheckInterval = null;
        }

        // Notify extension
        await notifyExtension(authState);

        // Show success message with countdown
        showSuccessWithCountdown();

        // Schedule tab closure
        scheduleTabClosure();
    }

    async function notifyExtension(authData) {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    type: 'LOGIN_SUCCESS',
                    data: authData,
                    timestamp: Date.now(),
                    source: 'login_page'
                });
                console.log('✅ Notified extension of successful login');
            }
        } catch (error) {
            console.warn('⚠️ Could not notify extension:', error);
        }
    }

    function showSuccessWithCountdown() {
        const successContainer = DOM.get('success-container');
        
        if (successContainer) {
            DOM.setHTML(successContainer, `
                <div class="success-message">
                    ✅ Login successful! Closing tab in <span id="countdown">3</span> seconds...
                </div>
            `);

            // Countdown timer
            let countdown = 3;
            const countdownElement = DOM.get('countdown');
            const countdownInterval = setInterval(() => {
                countdown--;
                if (countdownElement) {
                    DOM.setText(countdownElement, countdown.toString());
                }
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                }
            }, 1000);
        }
    }

    function scheduleTabClosure() {
        // Clear any existing timeout
        if (closeTimeout) {
            clearTimeout(closeTimeout);
        }

        // Close tab after 3 seconds
        closeTimeout = setTimeout(() => {
            closeTab();
        }, 3000);
    }

    function closeTab() {
        console.log('🔄 Attempting to close login tab...');

        try {
            if (typeof chrome !== 'undefined' && chrome.tabs) {
                chrome.tabs.getCurrent((tab) => {
                    if (tab?.id) {
                        chrome.tabs.remove(tab.id, () => {
                            console.log('✅ Tab closed successfully');
                        });
                    } else {
                        console.warn('⚠️ Could not get current tab, trying window.close()');
                        window.close();
                    }
                });
            } else {
                // Fallback for regular browser
                console.log('🔄 Using window.close() fallback');
                window.close();
            }
        } catch (error) {
            console.error('❌ Failed to close tab:', error);
            showManualCloseMessage();
        }
    }

    function showManualCloseMessage() {
        const successContainer = DOM.get('success-container');
        if (successContainer) {
            DOM.setHTML(successContainer, `
                <div class="success-message">
                    ✅ Login successful! You can now close this tab manually.
                </div>
            `);
        }
    }

    function autoFocusEmail() {
        const emailInput = DOM.get('email');
        if (emailInput) {
            emailInput.focus();
        }
    }

    function setupKeyboardHandlers() {
        document.addEventListener('keydown', (event) => {
            // Enter key handler for form submission
            if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') {
                const form = DOM.get('login-form');
                if (form) {
                    form.dispatchEvent(new Event('submit'));
                }
            }

            // ESC to close (after successful login)
            if (event.key === 'Escape') {
                const successContainer = DOM.get('success-container');
                if (successContainer && successContainer.innerHTML.includes('successful')) {
                    closeTab();
                }
            }

            // Ctrl/Cmd + R to refresh
            if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
                event.preventDefault();
                window.location.reload();
            }
        });
    }

    function setupFormValidation() {
        const inputs = document.querySelectorAll('.form-input');
        
        inputs.forEach(input => {
            input.addEventListener('blur', (event) => {
                const target = event.target;
                if (target.required && !target.value.trim()) {
                    target.style.borderColor = '#ef4444';
                } else {
                    target.style.borderColor = '#d1d5db';
                }
            });

            input.addEventListener('input', (event) => {
                const target = event.target;
                target.style.borderColor = '#d1d5db';
            });
        });
    }

    function checkInitialState() {
        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const mockMode = urlParams.get('mock') === 'true' || 
                         localStorage.getItem('mockMode') === 'true';

        if (mockMode) {
            showCredentialsHint();
            showMockModeToggle();
        }

        // Check if in development
        const isDevelopment = window.location.hostname === 'localhost' || 
                            window.location.protocol === 'chrome-extension:';

        if (isDevelopment) {
            showMockModeToggle();
        }
    }

    function showCredentialsHint() {
        const credentialsHint = DOM.get('credentials-hint');
        DOM.show(credentialsHint);
    }

    function showMockModeToggle() {
        const mockModeToggle = DOM.get('mock-mode-toggle');
        DOM.show(mockModeToggle);
    }

    async function getStoredAuthState() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                return new Promise((resolve) => {
                    chrome.storage.local.get(['authState'], (result) => {
                        resolve(result.authState);
                    });
                });
            } else {
                const stored = localStorage.getItem('authState');
                return stored ? JSON.parse(stored) : null;
            }
        } catch (error) {
            console.error('Failed to get auth state:', error);
            return null;
        }
    }

    // UI Helper functions
    function showMessage(message, type = 'error') {
        const container = type === 'error' ? DOM.get('error-container') : DOM.get('success-container');
        const className = type === 'error' ? 'error-message' : 'success-message';
        
        if (container) {
            DOM.setHTML(container, `<div class="${className}">${message}</div>`);
        }
    }

    function clearMessages() {
        const errorContainer = DOM.get('error-container');
        const successContainer = DOM.get('success-container');
        
        if (errorContainer) DOM.setHTML(errorContainer, '');
        if (successContainer) DOM.setHTML(successContainer, '');
    }

    function updateButtonState(isLoading, text) {
        const loginButton = DOM.get('login-button');
        
        if (loginButton) {
            loginButton.disabled = isLoading;
            
            if (isLoading) {
                DOM.setHTML(loginButton, '<span class="loading"></span>' + text);
            } else {
                DOM.setText(loginButton, text);
            }
        }
    }

    function updateStatusIndicator(status, message) {
        const statusIndicator = DOM.get('status-indicator');
        const statusText = DOM.get('status-text');
        
        if (statusIndicator && statusText) {
            DOM.show(statusIndicator);
            
            // Remove existing status classes
            statusIndicator.className = 'status-indicator';
            
            // Add new status class
            switch (status) {
                case 'connected':
                    DOM.addClass(statusIndicator, 'status-connected');
                    break;
                case 'error':
                    DOM.addClass(statusIndicator, 'status-error');
                    break;
                case 'mock':
                    DOM.addClass(statusIndicator, 'status-mock');
                    break;
            }
            
            DOM.setText(statusText, message);
        }
    }

    // Expose functions for React component
    window.loginPageDOMHandler = {
        showMessage,
        clearMessages,
        updateButtonState,
        updateStatusIndicator,
        showCredentialsHint,
        showMockModeToggle,
        DOM
    };

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        console.log('🧹 Cleaning up login page...');
        
        if (authCheckInterval) {
            clearInterval(authCheckInterval);
        }
        if (closeTimeout) {
            clearTimeout(closeTimeout);
        }

        // Notify extension that login page is closing
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    type: 'LOGIN_PAGE_CLOSING',
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.warn('Could not notify extension of page closing:', error);
        }
    });

    // Handle page visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log('Login page became visible');
            setTimeout(async () => {
                const authState = await getStoredAuthState();
                if (authState?.isLoggedIn) {
                    console.log('User is already logged in, closing tab');
                    closeTab();
                }
            }, 1000);
        }
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePage);
    } else {
        initializePage();
    }

    console.log('📄 Login DOM handler loaded');
})();