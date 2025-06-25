// public/login/App.tsx - CSP Compliant with DOM Handler Integration
import React, { useState, useEffect } from "react";

interface LoginCredentials {
  email: string;
  password: string;
}

interface BackendStatus {
  connected: boolean;
  apiUrl: string;
  error?: string;
}

// Mock user data for development
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

// Type definition for DOM handler
interface DOMHandler {
  showMessage: (message: string, type?: string) => void;
  clearMessages: () => void;
  updateButtonState: (isLoading: boolean, text: string) => void;
  updateStatusIndicator: (status: string, message: string) => void;
  showCredentialsHint: () => void;
  showMockModeToggle: () => void;
  DOM: any;
}

declare global {
  interface Window {
    loginPageDOMHandler: DOMHandler;
  }
}

export default function LoginApp() {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    connected: false,
    apiUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api",
  });
  const [enableMockMode, setEnableMockMode] = useState(
    import.meta.env.VITE_ENABLE_MOCK_MODE === "true"
  );

  // Reference to DOM handler
  const domHandler = window.loginPageDOMHandler;

  // Check backend status on mount
  useEffect(() => {
    checkBackendConnection();

    // Pre-fill demo credentials for development
    if (import.meta.env.VITE_NODE_ENV === "development" || enableMockMode) {
      setCredentials(MOCK_CREDENTIALS);
      updateFormValues(MOCK_CREDENTIALS);
    }
  }, [enableMockMode]);

  // Listen for DOM events from the external script
  useEffect(() => {
    const handleFormSubmit = (event: CustomEvent) => {
      const submittedCredentials = event.detail as LoginCredentials;
      setCredentials(submittedCredentials);
      handleSubmit(submittedCredentials);
    };

    const handleInputChange = (event: CustomEvent) => {
      const { name, value } = event.detail;
      setCredentials(prev => ({
        ...prev,
        [name]: value
      }));
      
      // Clear errors when user types
      if (error) {
        setError(null);
        domHandler?.clearMessages();
      }
    };

    const handleMockToggle = () => {
      handleMockModeToggle();
    };

    // Add event listeners
    window.addEventListener('loginFormSubmit', handleFormSubmit as EventListener);
    window.addEventListener('loginInputChange', handleInputChange as EventListener);
    window.addEventListener('mockModeToggle', handleMockToggle);

    // Cleanup
    return () => {
      window.removeEventListener('loginFormSubmit', handleFormSubmit as EventListener);
      window.removeEventListener('loginInputChange', handleInputChange as EventListener);
      window.removeEventListener('mockModeToggle', handleMockToggle);
    };
  }, [error, domHandler]);

  // Update UI when state changes
  useEffect(() => {
    updateUI();
  }, [isLoading, error, success, backendStatus, enableMockMode, credentials]);

  const checkBackendConnection = async () => {
    try {
      const response = await fetch(`${backendStatus.apiUrl}/health`);
      if (response.ok) {
        setBackendStatus((prev) => ({ ...prev, connected: true }));
      } else {
        setBackendStatus((prev) => ({
          ...prev,
          connected: false,
          error: `Backend health check failed: ${response.status}`,
        }));
      }
    } catch (error) {
      setBackendStatus((prev) => ({
        ...prev,
        connected: false,
        error: `Backend not reachable: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      }));
    }
  };

  const performMockLogin = async (): Promise<boolean> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check mock credentials
    if (
      credentials.email === MOCK_CREDENTIALS.email &&
      credentials.password === MOCK_CREDENTIALS.password
    ) {
      // Generate mock token
      const mockToken = `mock_token_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Create auth data
      const authData = {
        isLoggedIn: true,
        currentUser: MOCK_USER,
        authToken: mockToken,
        timestamp: Date.now(),
      };

      // Store in Chrome storage for extension to access
      try {
        if (typeof chrome !== "undefined" && chrome.storage) {
          await chrome.storage.local.set({ authState: authData });
        } else {
          // Fallback to localStorage
          localStorage.setItem("authState", JSON.stringify(authData));
        }

        // Notify extension popup (if open)
        try {
          if (typeof chrome !== "undefined" && chrome.runtime) {
            chrome.runtime.sendMessage({
              type: "LOGIN_SUCCESS",
              data: authData,
            });
          }
        } catch (error) {
          console.warn("Could not notify extension:", error);
        }

        return true;
      } catch (error) {
        console.error("Failed to store auth data:", error);
        return false;
      }
    }

    return false;
  };

  const performRealLogin = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${backendStatus.apiUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: credentials.email,
          password: credentials.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || `Login failed: ${response.status}`
        );
      }

      if (data.success && data.token && data.user) {
        // Store authentication data for extension
        const authData = {
          isLoggedIn: true,
          currentUser: data.user,
          authToken: data.token,
          timestamp: Date.now(),
        };

        // Store in Chrome storage for extension to access
        if (typeof chrome !== "undefined" && chrome.storage) {
          await chrome.storage.local.set({ authState: authData });
        } else {
          // Fallback to localStorage
          localStorage.setItem("authState", JSON.stringify(authData));
        }

        // Notify extension popup (if open)
        try {
          if (typeof chrome !== "undefined" && chrome.runtime) {
            chrome.runtime.sendMessage({
              type: "LOGIN_SUCCESS",
              data: authData,
            });
          }
        } catch (error) {
          console.warn("Could not notify extension:", error);
        }

        return true;
      }

      throw new Error(data.error || "Invalid response from server");
    } catch (error) {
      console.error("Real login error:", error);
      throw error;
    }
  };

  const handleSubmit = async (submittedCredentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Basic validation
      if (!submittedCredentials.email || !submittedCredentials.password) {
        throw new Error("Please fill in all fields");
      }

      let loginSuccess = false;

      // Try mock login first if enabled or backend not available
      if (enableMockMode || !backendStatus.connected) {
        console.log("🔧 Attempting mock login...");
        loginSuccess = await performMockLogin();

        if (!loginSuccess) {
          throw new Error("Invalid mock credentials. Use demo.user@cellebrite.com / password");
        }
      } else {
        // Try real backend login
        console.log("🔗 Attempting real backend login...");
        loginSuccess = await performRealLogin();
      }

      if (loginSuccess) {
        // Show success message
        setSuccess("Login successful! Closing tab...");
        // The DOM handler will automatically handle the success state and close the tab
      }
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Login failed. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMockModeToggle = () => {
    const newMockMode = !enableMockMode;
    setEnableMockMode(newMockMode);
    
    if (newMockMode) {
      setCredentials(MOCK_CREDENTIALS);
      updateFormValues(MOCK_CREDENTIALS);
    } else {
      const emptyCredentials = { email: "", password: "" };
      setCredentials(emptyCredentials);
      updateFormValues(emptyCredentials);
    }
    
    setError(null);
    setSuccess(null);
  };

  const updateFormValues = (newCredentials: LoginCredentials) => {
    if (domHandler?.DOM) {
      const emailInput = domHandler.DOM.get('email');
      const passwordInput = domHandler.DOM.get('password');
      
      domHandler.DOM.setValue(emailInput, newCredentials.email);
      domHandler.DOM.setValue(passwordInput, newCredentials.password);
    }
  };

  const updateUI = () => {
    if (!domHandler) return;

    // Update backend status indicator
    if (enableMockMode) {
      domHandler.updateStatusIndicator("mock", "🔧 Mock Mode - Use demo credentials");
      domHandler.showCredentialsHint();
    } else if (backendStatus.connected) {
      domHandler.updateStatusIndicator("connected", "✅ Backend connected - Ready to login");
    } else {
      domHandler.updateStatusIndicator("error", `❌ ${backendStatus.error || "Backend not available"}`);
    }

    // Update button state
    domHandler.updateButtonState(isLoading, isLoading ? "Signing in..." : "Sign in");

    // Show/hide mock mode toggle in development
    if (import.meta.env.VITE_NODE_ENV === "development") {
      domHandler.showMockModeToggle();
    }

    // Update mock mode toggle text
    const mockModeToggle = domHandler.DOM?.get('mock-mode-toggle');
    if (mockModeToggle) {
      domHandler.DOM.setText(mockModeToggle, enableMockMode ? "Switch to Real API" : "Switch to Mock Mode");
    }

    // Show error/success messages
    if (error) {
      domHandler.showMessage(error, "error");
    } else if (success) {
      domHandler.showMessage(success, "success");
    }
  };

  // Initialize component
  useEffect(() => {
    // Wait for DOM handler to be available
    const initTimeout = setTimeout(() => {
      if (window.loginPageDOMHandler) {
        console.log('✅ DOM handler connected to React app');
        updateUI();
      } else {
        console.warn('⚠️ DOM handler not available');
      }
    }, 100);

    return () => clearTimeout(initTimeout);
  }, []);

  // This component doesn't render anything - the HTML template handles the UI
  // React is only used for state management and logic
  return null;
}