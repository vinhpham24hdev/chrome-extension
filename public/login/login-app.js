// public/login/login-app.js - CSP Compliant Version (Vanilla JS)
(function() {
    'use strict';

    // Configuration and constants
    const CONFIG = {
        API_BASE_URL: 'http://localhost:3001/api',
        ENABLE_MOCK_MODE: true,
        NODE_ENV: 'development',
        MAX_RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000,
        MESSAGE_TIMEOUT: 5000
    };

    const MOCK_USER = {
        id: "demo-user-001",
        username: "demo.user@cellebrite.com",
        email: "demo.user@cellebrite.com",
        firstName: "Demo",
        lastName: "User",
        role: "analyst",
        permissions: ["screenshot", "video", "case_management"],
        lastLogin: new Date().toISOString(),
    };

    const MOCK_CREDENTIALS = {
        email: "demo.user@cellebrite.com",
        password: "password",
    };

    // Application state
    let state = {
        credentials: { email: "", password: "" },
        isLoading: false,
        error: null,
        success: null,
        backendConnected: false,
        backendError: null,
        enableMockMode: CONFIG.ENABLE_MOCK_MODE,
        authCheckInterval: null,
        isWindow: false
    };

    // Detect if we're in a popup window
    function detectWindowType() {
        try {
            state.isWindow = !!(window.opener || window.parent !== window);
            console.log('🪟 Window type detected:', state.isWindow ? 'popup window' : 'tab');
        } catch (error) {
            console.warn('Could not detect window type:', error);
        }
    }

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

    // Safe Chrome extension communication
    class SafeExtensionCommunicator {
        constructor() {
            this.isExtensionContext = this.checkExtensionContext();
            this.setupMessageHandlers();
        }

        checkExtensionContext() {
            try {
                return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
            } catch (error) {
                console.warn('⚠️ Extension context not available:', error.message);
                return false;
            }
        }

        setupMessageHandlers() {
            if (!this.isExtensionContext) {
                console.log('🔧 Running in non-extension mode');
                return;
            }

            try {
                chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                    console.log('📨 Login window received message:', message.type);
                    sendResponse({ success: true, source: 'login_window' });
                });
            } catch (error) {
                console.error('❌ Failed to setup message handlers:', error);
            }
        }

        async getStoredAuthState() {
            try {
                if (this.isExtensionContext && chrome.storage) {
                    return new Promise((resolve) => {
                        chrome.storage.local.get(['authState'], (result) => {
                            if (chrome.runtime.lastError) {
                                console.error('Chrome storage error:', chrome.runtime.lastError);
                                resolve(null);
                            } else {
                                resolve(result.authState);
                            }
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

        async safeRuntimeSendMessage(message, retryCount = 0) {
            if (!this.isExtensionContext) {
                console.log('🔧 Skipping message send in non-extension mode');
                return { success: false, error: 'Not in extension context' };
            }

            try {
                if (!chrome.runtime.id) {
                    throw new Error('Extension context invalidated');
                }

                return new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Message timeout'));
                    }, CONFIG.MESSAGE_TIMEOUT);

                    chrome.runtime.sendMessage(message, (response) => {
                        clearTimeout(timeout);
                        
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response || { success: true });
                        }
                    });
                });
            } catch (error) {
                console.error(`❌ Message send failed (attempt ${retryCount + 1}):`, error.message);
                
                if (retryCount < CONFIG.MAX_RETRY_ATTEMPTS) {
                    console.log(`🔄 Retrying message send in ${CONFIG.RETRY_DELAY}ms...`);
                    await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (retryCount + 1)));
                    return this.safeRuntimeSendMessage(message, retryCount + 1);
                }
                
                return { success: false, error: error.message };
            }
        }

        async notifyExtension(authData) {
            console.log('📤 Attempting to notify extension...');
            
            const result = await this.safeRuntimeSendMessage({
                type: 'LOGIN_SUCCESS',
                data: authData,
                timestamp: Date.now(),
                source: 'login_window'
            });

            if (result.success) {
                console.log('✅ Successfully notified extension');
            } else {
                console.warn('⚠️ Failed to notify extension:', result.error);
            }
            
            return result;
        }
    }

    // Login logic
    async function performMockLogin() {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (
            state.credentials.email === MOCK_CREDENTIALS.email &&
            state.credentials.password === MOCK_CREDENTIALS.password
        ) {
            const mockToken = `mock_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const authData = {
                isLoggedIn: true,
                currentUser: MOCK_USER,
                authToken: mockToken,
                timestamp: Date.now(),
            };

            try {
                if (extensionComm.isExtensionContext && chrome.storage) {
                    await new Promise((resolve, reject) => {
                        chrome.storage.local.set({ authState: authData }, () => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve();
                            }
                        });
                    });
                } else {
                    localStorage.setItem('authState', JSON.stringify(authData));
                }

                await extensionComm.notifyExtension(authData);
                return true;
            } catch (error) {
                console.error('Failed to store auth data:', error);
                return false;
            }
        }

        return false;
    }

    async function performRealLogin() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: state.credentials.email,
                    password: state.credentials.password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || data.message || `Login failed: ${response.status}`
                );
            }

            if (data.success && data.token && data.user) {
                const authData = {
                    isLoggedIn: true,
                    currentUser: data.user,
                    authToken: data.token,
                    timestamp: Date.now(),
                };

                if (extensionComm.isExtensionContext && chrome.storage) {
                    await new Promise((resolve, reject) => {
                        chrome.storage.local.set({ authState: authData }, () => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve();
                            }
                        });
                    });
                } else {
                    localStorage.setItem('authState', JSON.stringify(authData));
                }

                await extensionComm.notifyExtension(authData);
                return true;
            }

            throw new Error(data.error || 'Invalid response from server');
        } catch (error) {
            console.error('Real login error:', error);
            throw error;
        }
    }

    async function handleLogin() {
        state.isLoading = true;
        state.error = null;
        state.success = null;
        updateUI();

        try {
            if (!state.credentials.email || !state.credentials.password) {
                throw new Error('Please fill in all fields');
            }

            let loginSuccess = false;

            if (state.enableMockMode || !state.backendConnected) {
                console.log('🔧 Attempting mock login...');
                loginSuccess = await performMockLogin();

                if (!loginSuccess) {
                    throw new Error('Invalid mock credentials. Use demo.user@cellebrite.com / password');
                }
            } else {
                console.log('🔗 Attempting real backend login...');
                loginSuccess = await performRealLogin();
            }

            if (loginSuccess) {
                state.success = 'Login successful! You can now close this window.';
                updateUI();
                handleLoginSuccess();
            }
        } catch (error) {
            console.error('Login error:', error);
            state.error = error.message || 'Login failed. Please try again.';
            updateUI();
        } finally {
            state.isLoading = false;
            updateUI();
        }
    }

    function handleLoginSuccess() {
        if (state.authCheckInterval) {
            clearInterval(state.authCheckInterval);
            state.authCheckInterval = null;
        }

        showSuccessMessage();
    }

    // CSP-compliant success message function
    function showSuccessMessage() {
        const successContainer = DOM.get('success-container');
        
        if (successContainer) {
            // Create success message div
            const successDiv = document.createElement('div');
            successDiv.className = 'success-message';
            successDiv.innerHTML = '✅ Login successful! You can now close this window manually or continue using it.<br>';
            
            // Create close button element (CSP compliant)
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close Window';
            closeButton.style.cssText = 'margin-top: 10px; padding: 8px 16px; background: #16a34a; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.875rem; font-family: inherit; transition: background-color 0.2s;';
            
            // Add event listeners (CSP compliant)
            closeButton.addEventListener('click', () => {
                window.close();
            });
            
            closeButton.addEventListener('mouseover', () => {
                closeButton.style.background = '#15803d';
            });
            
            closeButton.addEventListener('mouseout', () => {
                closeButton.style.background = '#16a34a';
            });
            
            // Append button to success message
            successDiv.appendChild(closeButton);
            
            // Clear container and add success message
            successContainer.innerHTML = '';
            successContainer.appendChild(successDiv);
        }
    }

    // Backend connection check
    async function checkBackendConnection() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
                state.backendConnected = true;
                state.backendError = null;
            } else {
                state.backendConnected = false;
                state.backendError = `Backend health check failed: ${response.status}`;
            }
        } catch (error) {
            state.backendConnected = false;
            if (error.name === 'AbortError') {
                state.backendError = 'Backend connection timeout';
            } else {
                state.backendError = `Backend not reachable: ${error.message || 'Unknown error'}`;
            }
        }
        updateUI();
    }

    // Auth state monitoring
    function startAuthMonitoring() {
        console.log('👀 Starting auth monitoring...');
        
        state.authCheckInterval = setInterval(async () => {
            try {
                const authState = await extensionComm.getStoredAuthState();
                
                if (authState && authState.isLoggedIn && authState.currentUser) {
                    console.log('✅ Authentication detected in monitoring!');
                    handleLoginSuccess();
                }
            } catch (error) {
                console.error('Auth monitoring error:', error);
            }
        }, 1000);
    }

    // UI Management
    function updateUI() {
        updateStatusIndicator();
        updateButtonState();
        updateMockModeToggle();
        updateVisibility();
        updateMessages();
    }

    function updateStatusIndicator() {
        const statusIndicator = DOM.get('status-indicator');
        const statusText = DOM.get('status-text');
        
        if (statusIndicator && statusText) {
            DOM.show(statusIndicator);
            statusIndicator.className = 'status-indicator';
            
            if (state.enableMockMode) {
                DOM.addClass(statusIndicator, 'status-mock');
                DOM.setText(statusText, '🔧 Mock Mode - Use demo credentials');
            } else {
                DOM.addClass(statusIndicator, 'status-error');
                DOM.setText(statusText, `❌ ${state.backendError || 'Backend not available'}`);
            }
        }
    }

    function updateButtonState() {
        const loginButton = DOM.get('login-button');
        
        if (loginButton) {
            loginButton.disabled = state.isLoading;
            
            if (state.isLoading) {
                DOM.setHTML(loginButton, '<span class="loading"></span>Signing in...');
            } else {
                DOM.setText(loginButton, 'Sign in');
            }
        }
    }

    function updateMockModeToggle() {
        const mockModeToggle = DOM.get('mock-mode-toggle');
        
        if (mockModeToggle) {
            if (CONFIG.NODE_ENV === 'development') {
                DOM.show(mockModeToggle);
                DOM.setText(mockModeToggle, state.enableMockMode ? 'Switch to Real API' : 'Switch to Mock Mode');
            } else {
                DOM.hide(mockModeToggle);
            }
        }
    }

    function updateVisibility() {
        const credentialsHint = DOM.get('credentials-hint');
        
        if (state.enableMockMode) {
            DOM.show(credentialsHint);
        } else {
            DOM.hide(credentialsHint);
        }
    }

    function updateMessages() {
        const errorContainer = DOM.get('error-container');
        const successContainer = DOM.get('success-container');
        
        if (state.error) {
            DOM.setHTML(errorContainer, `<div class="error-message">❌ ${state.error}</div>`);
        } else {
            DOM.setHTML(errorContainer, '');
        }

        if (state.success && !successContainer.innerHTML.includes('✅')) {
            DOM.setHTML(successContainer, `<div class="success-message">✅ ${state.success}</div>`);
        } else if (!state.success && !successContainer.innerHTML.includes('✅')) {
            DOM.setHTML(successContainer, '');
        }
    }

    function updateFormValues(credentials) {
        const emailInput = DOM.get('email');
        const passwordInput = DOM.get('password');
        
        DOM.setValue(emailInput, credentials.email);
        DOM.setValue(passwordInput, credentials.password);
    }

    // Event handlers
    function setupEventHandlers() {
        const form = DOM.get('login-form');
        const emailInput = DOM.get('email');
        const passwordInput = DOM.get('password');
        const forgotPasswordLink = DOM.get('forgot-password-link');
        const mockModeToggle = DOM.get('mock-mode-toggle');

        if (form) {
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                
                const email = DOM.getValue(emailInput)?.trim() || '';
                const password = DOM.getValue(passwordInput) || '';
                
                state.credentials = { email, password };
                handleLogin();
            });
        }

        if (emailInput) {
            emailInput.addEventListener('input', (event) => {
                state.credentials.email = event.target.value;
                clearErrors();
            });
            
            emailInput.addEventListener('blur', (event) => {
                if (event.target.required && !event.target.value.trim()) {
                    DOM.addClass(event.target, 'error');
                } else {
                    DOM.removeClass(event.target, 'error');
                }
            });
        }

        if (passwordInput) {
            passwordInput.addEventListener('input', (event) => {
                state.credentials.password = event.target.value;
                clearErrors();
            });
            
            passwordInput.addEventListener('blur', (event) => {
                if (event.target.required && !event.target.value.trim()) {
                    DOM.addClass(event.target, 'error');
                } else {
                    DOM.removeClass(event.target, 'error');
                }
            });
        }

        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (event) => {
                event.preventDefault();
                alert('Password reset functionality will be implemented soon.');
            });
        }

        if (mockModeToggle) {
            mockModeToggle.addEventListener('click', (event) => {
                event.preventDefault();
                handleMockModeToggle();
            });
        }

        // Global keyboard handlers
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') {
                const form = DOM.get('login-form');
                if (form) {
                    form.dispatchEvent(new Event('submit'));
                }
            }

            if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
                event.preventDefault();
                window.location.reload();
            }
        });
    }

    function clearErrors() {
        if (state.error) {
            state.error = null;
            updateUI();
        }
    }

    function handleMockModeToggle() {
        state.enableMockMode = !state.enableMockMode;
        
        if (state.enableMockMode) {
            state.credentials = { ...MOCK_CREDENTIALS };
            updateFormValues(MOCK_CREDENTIALS);
        } else {
            const emptyCredentials = { email: '', password: '' };
            state.credentials = { ...emptyCredentials };
            updateFormValues(emptyCredentials);
        }
        
        state.error = null;
        state.success = null;
        updateUI();
    }

    // Page lifecycle handlers
    function setupPageHandlers() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('Login window became visible');
            }
        });

        window.addEventListener('beforeunload', () => {
            console.log('🧹 Cleaning up login window...');
            
            if (state.authCheckInterval) {
                clearInterval(state.authCheckInterval);
            }

            extensionComm.safeRuntimeSendMessage({
                type: 'LOGIN_PAGE_CLOSING',
                timestamp: Date.now()
            }).catch(error => {
                console.warn('Could not notify extension of page closing:', error);
            });
        });

        window.addEventListener('error', (event) => {
            console.error('🚨 Global error:', event.error);
            if (event.error && event.error.message.includes('Extension context invalidated')) {
                console.warn('⚠️ Extension context invalidated, disabling extension features');
                extensionComm.isExtensionContext = false;
            }
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('🚨 Unhandled promise rejection:', event.reason);
            if (event.reason && event.reason.message && event.reason.message.includes('Could not establish connection')) {
                console.warn('⚠️ Extension communication failed, continuing without extension features');
            }
        });
    }

    // Initialization
    let extensionComm;

    function initialize() {
        console.log('🚀 Initializing login window...');

        detectWindowType();
        extensionComm = new SafeExtensionCommunicator();
        checkBackendConnection();

        if (CONFIG.NODE_ENV === 'development' || state.enableMockMode) {
            state.credentials = { ...MOCK_CREDENTIALS };
            updateFormValues(MOCK_CREDENTIALS);
        }

        setupEventHandlers();
        setupPageHandlers();
        startAuthMonitoring();

        const emailInput = DOM.get('email');
        if (emailInput) {
            emailInput.focus();
        }

        updateUI();

        console.log('✅ Login window initialized successfully');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    console.log('📄 Login app script loaded');
})();