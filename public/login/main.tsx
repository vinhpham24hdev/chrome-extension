// public/login/main.tsx - CSP Compliant with DOM Handler Integration
import React from "react";
import ReactDOM from "react-dom/client";
import LoginApp from "./App";

// Enhanced message communication that works with DOM handler
class LoginPageCommunicator {
  private static instance: LoginPageCommunicator;
  private retryCount: number = 0;
  private maxRetries: number = 3;

  private constructor() {
    this.setupMessageHandlers();
    this.setupConnectionRetry();
  }

  public static getInstance(): LoginPageCommunicator {
    if (!LoginPageCommunicator.instance) {
      LoginPageCommunicator.instance = new LoginPageCommunicator();
    }
    return LoginPageCommunicator.instance;
  }

  private setupMessageHandlers() {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      // Listen for messages from popup
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("Login page received message:", message);

        switch (message.type) {
          case "CHECK_AUTH_STATUS":
            this.handleAuthStatusCheck(sendResponse);
            return true; // Keep message channel open

          case "LOGOUT":
            this.handleLogout(sendResponse);
            return true;

          case "PING":
            sendResponse({ status: "pong", timestamp: Date.now() });
            return true;

          default:
            console.log("Unknown message type:", message.type);
        }
      });

      // Handle extension context invalidation
      chrome.runtime.onConnect.addListener((port) => {
        console.log("Extension connected to login page");
        port.onDisconnect.addListener(() => {
          console.log("Extension disconnected from login page");
        });
      });
    }
  }

  private async handleAuthStatusCheck(sendResponse: (response: any) => void) {
    try {
      const authState = await this.getAuthState();
      sendResponse({
        isAuthenticated: authState?.isLoggedIn || false,
        user: authState?.currentUser || null,
        timestamp: authState?.timestamp || null,
      });
    } catch (error) {
      sendResponse({
        isAuthenticated: false,
        user: null,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async handleLogout(sendResponse: (response: any) => void) {
    try {
      // Clear auth state
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.remove(["authState"]);
      } else {
        localStorage.removeItem("authState");
      }

      sendResponse({ success: true });
      console.log("Auth state cleared from login page");
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async getAuthState(): Promise<any> {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        const result = await chrome.storage.local.get(["authState"]);
        return result.authState;
      } else {
        const stored = localStorage.getItem("authState");
        return stored ? JSON.parse(stored) : null;
      }
    } catch (error) {
      console.error("Failed to get auth state:", error);
      return null;
    }
  }

  private setupConnectionRetry() {
    // Auto-retry connection if initially failed
    setTimeout(() => {
      this.retryConnection();
    }, 1000);
  }

  private async retryConnection() {
    if (this.retryCount >= this.maxRetries) {
      console.log("Max retries reached");
      return;
    }

    this.retryCount++;
    console.log(`Retrying connection (${this.retryCount}/${this.maxRetries})`);

    try {
      const apiUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
      const response = await fetch(`${apiUrl}/health`);

      if (response.ok) {
        console.log("Connection retry successful");
        // Update status via DOM handler if available
        if (window.loginPageDOMHandler) {
          window.loginPageDOMHandler.updateStatusIndicator(
            "connected", 
            "✅ Backend connected - Ready to login"
          );
        }
      } else {
        setTimeout(() => this.retryConnection(), 2000 * this.retryCount); // Exponential backoff
      }
    } catch (error) {
      console.error("Retry failed:", error);
      setTimeout(() => this.retryConnection(), 2000 * this.retryCount);
    }
  }

  public cleanup() {
    // Cleanup is handled by the DOM handler
  }
}

// Initialize React app
function initializeReactApp() {
  const rootElement = document.getElementById("root") || document.body;
  
  // Create a hidden root element for React since we're using the HTML template
  let reactRoot = document.getElementById("react-root");
  if (!reactRoot) {
    reactRoot = document.createElement("div");
    reactRoot.id = "react-root";
    reactRoot.style.display = "none";
    document.body.appendChild(reactRoot);
  }

  ReactDOM.createRoot(reactRoot).render(
    <React.StrictMode>
      <LoginApp />
    </React.StrictMode>
  );

  console.log("✅ React app initialized");
}

// Wait for DOM handler to be ready
function waitForDOMHandler(callback: () => void, maxAttempts: number = 50) {
  let attempts = 0;
  
  const check = () => {
    attempts++;
    
    if (window.loginPageDOMHandler) {
      console.log("✅ DOM handler ready");
      callback();
    } else if (attempts < maxAttempts) {
      setTimeout(check, 100);
    } else {
      console.error("❌ DOM handler not available after maximum attempts");
      // Initialize anyway - React app can work without DOM handler
      callback();
    }
  };
  
  check();
}

// Initialize everything when DOM is ready
function initialize() {
  console.log("🚀 Initializing login page...");

  // Initialize enhanced communication
  const communicator = LoginPageCommunicator.getInstance();

  // Wait for DOM handler then initialize React
  waitForDOMHandler(() => {
    initializeReactApp();
  });

  // Add enhanced styles for better UX
  addEnhancedStyles();

  // Setup global error handlers
  setupErrorHandlers();

  console.log("✅ Login page initialization complete");
}

function addEnhancedStyles() {
  const style = document.createElement("style");
  style.textContent = `
    /* Enhanced transitions and animations */
    .form-input, .login-button, .mock-mode-toggle {
      transition: all 0.2s ease-in-out;
    }

    /* Smooth focus transitions */
    .form-input:focus {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
    }

    /* Button hover effects */
    .login-button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
    }

    /* Loading animation improvements */
    .loading {
      animation: spin 1s linear infinite;
    }

    /* Success message pulse */
    .success-message {
      animation: slideIn 0.3s ease-out, pulse 2s infinite;
    }

    /* Error message shake */
    .error-message {
      animation: slideIn 0.3s ease-out, shake 0.5s ease-in-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    /* Status indicator animations */
    .status-connected {
      position: relative;
      overflow: hidden;
    }

    .status-connected::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      animation: shimmer 2s infinite;
    }

    @keyframes shimmer {
      0% { left: -100%; }
      100% { left: 100%; }
    }

    /* Form validation styles */
    .form-input.valid {
      border-color: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }

    .form-input.invalid {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }

    /* Mobile optimizations */
    @media (max-width: 480px) {
      .login-container {
        margin: 0.5rem;
        max-width: calc(100% - 1rem);
        border-radius: 8px;
      }
      
      .form-input {
        font-size: 16px; /* Prevent zoom on iOS */
      }
    }

    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .form-input:focus {
        outline: 3px solid;
      }
      
      .login-button {
        border: 2px solid;
      }
    }

    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }

    /* Dark mode support (if needed) */
    @media (prefers-color-scheme: dark) {
      /* Dark mode styles would go here if needed */
    }
  `;
  document.head.appendChild(style);
}

function setupErrorHandlers() {
  // Global error handler
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    // Show user-friendly error message
    if (window.loginPageDOMHandler) {
      window.loginPageDOMHandler.showMessage(
        'An unexpected error occurred. Please refresh the page and try again.',
        'error'
      );
    }
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Show user-friendly error message
    if (window.loginPageDOMHandler) {
      window.loginPageDOMHandler.showMessage(
        'A network error occurred. Please check your connection and try again.',
        'error'
      );
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  const communicator = LoginPageCommunicator.getInstance();
  communicator.cleanup();
});