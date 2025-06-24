// entrypoints/login/App.tsx
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

  // Check backend status on mount
  useEffect(() => {
    checkBackendConnection();

    // Pre-fill demo credentials for development
    if (import.meta.env.VITE_NODE_ENV === "development") {
      setCredentials({
        email: "demo.user@cellebrite.com",
        password: "password",
      });
    }
  }, []);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear errors when user starts typing
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Basic validation
      if (!credentials.email || !credentials.password) {
        throw new Error("Please fill in all fields");
      }

      if (!backendStatus.connected) {
        throw new Error("Backend is not available. Please try again later.");
      }

      // Make login request
      const response = await fetch(`${backendStatus.apiUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: credentials.email, // Backend expects 'username' field
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

        // Show success message
        setSuccess(
          "Login successful! You can now close this tab and use the extension."
        );

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

        // Auto-close tab after a delay
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        throw new Error(data.error || "Invalid response from server");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    alert("Password reset functionality will be implemented soon.");
  };

  // Don't render anything, the HTML template handles the UI
  useEffect(() => {
    // Set up form handlers
    const form = document.getElementById("login-form") as HTMLFormElement;
    const emailInput = document.getElementById("email") as HTMLInputElement;
    const passwordInput = document.getElementById(
      "password"
    ) as HTMLInputElement;
    const loginButton = document.getElementById(
      "login-button"
    ) as HTMLButtonElement;
    const forgotPasswordLink = document.getElementById(
      "forgot-password-link"
    ) as HTMLAnchorElement;
    const statusIndicator = document.getElementById(
      "status-indicator"
    ) as HTMLDivElement;
    const statusText = document.getElementById(
      "status-text"
    ) as HTMLSpanElement;
    const errorContainer = document.getElementById(
      "error-container"
    ) as HTMLDivElement;
    const successContainer = document.getElementById(
      "success-container"
    ) as HTMLDivElement;

    // Update backend status display
    if (statusIndicator && statusText) {
      statusIndicator.style.display = "block";
      if (backendStatus.connected) {
        statusIndicator.className = "status-indicator status-connected";
        statusText.textContent = "✅ Backend connected - Ready to login";
      } else {
        statusIndicator.className = "status-indicator status-error";
        statusText.textContent = `❌ ${
          backendStatus.error || "Backend not available"
        }`;
      }
    }

    // Set form values
    if (emailInput) emailInput.value = credentials.email;
    if (passwordInput) passwordInput.value = credentials.password;

    // Update button state
    if (loginButton) {
      loginButton.disabled = isLoading || !backendStatus.connected;
      loginButton.innerHTML = isLoading
        ? '<span class="loading"></span>Signing in...'
        : "Sign in";
    }

    // Show error/success messages
    if (errorContainer) {
      errorContainer.innerHTML = error
        ? `<div class="error-message">❌ ${error}</div>`
        : "";
    }

    if (successContainer) {
      successContainer.innerHTML = success
        ? `<div class="success-message">✅ ${success}</div>`
        : "";
    }

    // Event listeners
    const handleFormSubmit = (e: Event) => {
      e.preventDefault();

      // Get current values
      const email = (emailInput?.value || "").trim();
      const password = (passwordInput?.value || "").trim();

      setCredentials({ email, password });
      handleSubmit(e as any);
    };

    const handleInputChangeLocal = (e: Event) => {
      const target = e.target as HTMLInputElement;
      handleInputChange({
        target: { name: target.name, value: target.value },
      } as any);
    };

    const handleForgotPasswordClick = (e: Event) => {
      e.preventDefault();
      handleForgotPassword();
    };

    // Add event listeners
    form?.addEventListener("submit", handleFormSubmit);
    emailInput?.addEventListener("input", handleInputChangeLocal);
    passwordInput?.addEventListener("input", handleInputChangeLocal);
    forgotPasswordLink?.addEventListener("click", handleForgotPasswordClick);

    // Cleanup
    return () => {
      form?.removeEventListener("submit", handleFormSubmit);
      emailInput?.removeEventListener("input", handleInputChangeLocal);
      passwordInput?.removeEventListener("input", handleInputChangeLocal);
      forgotPasswordLink?.removeEventListener(
        "click",
        handleForgotPasswordClick
      );
    };
  }, [credentials, isLoading, error, success, backendStatus]);

  return null; // HTML template handles the rendering
}
