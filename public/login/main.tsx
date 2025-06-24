// entrypoints/login/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import LoginApp from "./App";

// Initialize React app
ReactDOM.createRoot(document.getElementById("root") || document.body).render(
  <React.StrictMode>
    <LoginApp />
  </React.StrictMode>
);

// Handle extension message communication
if (typeof chrome !== "undefined" && chrome.runtime) {
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Login page received message:", message);

    if (message.type === "CHECK_AUTH_STATUS") {
      // Check if user is logged in
      chrome.storage.local.get(["authState"], (result) => {
        const authState = result.authState;
        sendResponse({
          isAuthenticated: authState?.isLoggedIn || false,
          user: authState?.currentUser || null,
        });
      });
      return true; // Keep message channel open
    }

    if (message.type === "LOGOUT") {
      // Clear auth state
      chrome.storage.local.remove(["authState"], () => {
        sendResponse({ success: true });
      });
      return true;
    }
  });
}

// Handle page visibility change
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    // Page became visible, check if we need to close it
    setTimeout(() => {
      // Check if login was successful
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get(["authState"], (result) => {
          if (result.authState?.isLoggedIn) {
            // User is logged in, we can close this tab
            console.log("User is logged in, closing login tab");
            window.close();
          }
        });
      }
    }, 1000);
  }
});

// Add some global styles for better UX
const style = document.createElement("style");
style.textContent = `
  /* Add some additional responsive styles */
  @media (max-width: 480px) {
    .login-container {
      margin: 1rem;
      max-width: calc(100% - 2rem);
    }
    
    .login-header {
      padding: 1.5rem;
    }
    
    .login-form {
      padding: 1.5rem;
    }
  }

  /* Smooth transitions */
  .form-input, .login-button {
    transition: all 0.2s ease-in-out;
  }

  /* Focus states */
  .login-button:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
  }

  /* Loading animation improvements */
  .loading {
    animation: spin 1s linear infinite;
  }

  /* Better error/success styling */
  .error-message {
    animation: slideIn 0.3s ease-out;
  }

  .success-message {
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Auto-fill styling */
  .form-input:-webkit-autofill {
    -webkit-box-shadow: 0 0 0 30px white inset !important;
    -webkit-text-fill-color: #374151 !important;
  }
`;
document.head.appendChild(style);

// Add window unload handler
window.addEventListener("beforeunload", () => {
  // Notify extension that login page is closing
  if (typeof chrome !== "undefined" && chrome.runtime) {
    try {
      chrome.runtime.sendMessage({
        type: "LOGIN_PAGE_CLOSING",
      });
    } catch (error) {
      console.warn("Could not notify extension of page closing:", error);
    }
  }
});

// Add keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // ESC to close
  if (e.key === "Escape") {
    window.close();
  }

  // Ctrl/Cmd + R to refresh and retry connection
  if ((e.ctrlKey || e.metaKey) && e.key === "r") {
    e.preventDefault();
    window.location.reload();
  }
});

// Add connection retry functionality
let retryCount = 0;
const maxRetries = 3;

const retryConnection = async () => {
  if (retryCount >= maxRetries) {
    console.log("Max retries reached");
    return;
  }

  retryCount++;
  console.log(`Retrying connection (${retryCount}/${maxRetries})`);

  try {
    const apiUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
    const response = await fetch(`${apiUrl}/health`);

    if (response.ok) {
      console.log("Connection retry successful");
      window.location.reload(); // Refresh to update UI
    } else {
      setTimeout(retryConnection, 2000 * retryCount); // Exponential backoff
    }
  } catch (error) {
    console.error("Retry failed:", error);
    setTimeout(retryConnection, 2000 * retryCount);
  }
};

// Auto-retry connection if initially failed
setTimeout(() => {
  const statusIndicator = document.getElementById("status-indicator");
  if (statusIndicator?.classList.contains("status-error")) {
    retryConnection();
  }
}, 1000);
