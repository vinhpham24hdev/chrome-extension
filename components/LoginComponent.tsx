// components/LoginComponent.tsx - Updated to match Figma design
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { serviceManager } from "../services/serviceManager";
import logo from "@/assets/logo.png";


// Tools Grid Component for disabled state
const DisabledToolsGrid = () => (
  <div className="w-full">
    <div className="flex items-start justify-between">
      {/* Screen Capture - Disabled */}
      <div className="flex flex-col items-center space-y-1 opacity-30">
        <div className="w-8 h-6 border-2 border-gray-400 rounded-sm flex items-center justify-center">
          <div className="w-4 h-3 bg-gray-400 rounded-xs"></div>
        </div>
        <span className="text-xs text-gray-400">Screen</span>
      </div>

      {/* Full Page Capture - Disabled */}
      <div className="flex flex-col items-center space-y-1 opacity-30">
        <div className="w-8 h-6 border-2 border-gray-400 rounded-sm relative">
          <div className="w-6 h-4 bg-gray-400 rounded-xs absolute top-0.5 left-0.5"></div>
        </div>
        <span className="text-xs text-gray-400">Full</span>
      </div>

      {/* Region Capture - Disabled */}
      <div className="flex flex-col items-center space-y-1 opacity-30">
        <div className="w-8 h-6 border-2 border-gray-400 border-dashed rounded-sm"></div>
        <span className="text-xs text-gray-400">Region</span>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-300"></div>

      {/* Video Recording - Disabled */}
      <div className="flex flex-col items-center space-y-1 opacity-30 relative">
        <div className="w-8 h-6 border-2 border-gray-400 rounded-sm flex items-center justify-center">
          <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
        </div>
        <span className="text-xs text-gray-400">Video</span>
        {/* Red notification dot */}
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
      </div>

      {/* Region Video - Disabled */}
      <div className="flex flex-col items-center space-y-1 opacity-30 relative">
        <div className="w-8 h-6 border-2 border-gray-400 border-dashed rounded-sm flex items-center justify-center">
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        </div>
        <span className="text-xs text-gray-400">R.Video</span>
        {/* Red notification dot */}
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
      </div>

      {/* More Options - Disabled */}
      <div className="flex flex-col items-center space-y-1 opacity-30">
        <div className="w-4 h-6 flex flex-col justify-center items-center space-y-0.5">
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
        </div>
      </div>
    </div>
  </div>
);

interface LoginComponentProps {
  onLoginSuccess?: () => void;
}

interface BackendStatus {
  connected: boolean;
  apiUrl: string;
  mockMode: boolean;
  error?: string;
}

export default function LoginComponent({ onLoginSuccess }: LoginComponentProps) {
  const { state, clearError, checkConnection } = useAuth();
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    connected: false,
    apiUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api",
    mockMode: import.meta.env.VITE_ENABLE_MOCK_MODE === "true",
  });
  const [isCheckingBackend, setIsCheckingBackend] = useState(true);
  const [logoUrl, setLogoUrl] = useState(logo);
  const [isWaitingForLogin, setIsWaitingForLogin] = useState(false);

  // Handle successful login detection
  useEffect(() => {
    if (state.isAuthenticated && isWaitingForLogin) {
      console.log("✅ Login detected - success!");
      setIsWaitingForLogin(false);

      if (onLoginSuccess) {
        serviceManager.onLoginSuccess();
        onLoginSuccess();
      }
    }
  }, [state.isAuthenticated, isWaitingForLogin, onLoginSuccess]);

  // Check backend status on mount
  useEffect(() => {
    checkBackendStatus();
  }, []);

  // Clear error when component mounts
  useEffect(() => {
    clearError();
  }, []);

  const checkBackendStatus = async () => {
    setIsCheckingBackend(true);
    try {
      const connected = await checkConnection();
      setBackendStatus((prev) => ({
        ...prev,
        connected,
        error: connected ? undefined : "Backend not reachable",
      }));
    } catch (error) {
      setBackendStatus((prev) => ({
        ...prev,
        connected: false,
        error: error instanceof Error ? error.message : "Connection check failed",
      }));
    }
    setIsCheckingBackend(false);
  };

  const handleLoginClick = async () => {
    try {
      setIsWaitingForLogin(true);

      // Determine login URL
      let loginUrl: string;

      if (typeof chrome !== "undefined" && chrome.runtime) {
        // Use extension-hosted login page
        loginUrl = chrome.runtime.getURL("login/index.html");

        // Add mock mode parameter if needed
        if (backendStatus.mockMode || !backendStatus.connected) {
          loginUrl += "?mock=true";
        }
      } else {
        // Fallback to backend-hosted login page
        loginUrl = `${backendStatus.apiUrl.replace("/api", "")}/login?source=extension`;
      }

      console.log("🪟 Opening login window:", loginUrl);

      // Open login page in new window
      const newWindow = window.open(
        loginUrl,
        "cellebrite-login",
        "width=500,height=600,scrollbars=yes,resizable=yes,status=yes,location=yes"
      );

      if (!newWindow) {
        throw new Error("Failed to open login window. Please check popup blocker settings.");
      }

      // Start monitoring for login completion
      const checkLoginStatus = setInterval(() => {
        if (state.isAuthenticated) {
          clearInterval(checkLoginStatus);
          setIsWaitingForLogin(false);
          if (onLoginSuccess) {
            onLoginSuccess();
          }
        }
      }, 1000);

      // Clear interval after 30 minutes
      setTimeout(() => {
        clearInterval(checkLoginStatus);
        if (!state.isAuthenticated) {
          setIsWaitingForLogin(false);
        }
      }, 30 * 60 * 1000);

    } catch (error) {
      console.error("Failed to open login window:", error);
      setIsWaitingForLogin(false);
      alert(`Failed to open login window: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  return (
    <div className="w-[402px] h-[277px] bg-white flex flex-col">
      {/* Header with Cellebrite Logo */}
      <div className="bg-white p-4 flex items-center justify-center">
        {/* Cellebrite Logo */}
          <div className="flex flex-col items-center">
            {logoUrl && (
              <img src={logoUrl} alt="Cellebrite Logo" className="w-2/3" />
            )}
            <p className="text-xl text-gray-500">My insights</p>
          </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Connection Status Check */}
        {isCheckingBackend && (
          <div className="mb-6 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Checking connection...</p>
          </div>
        )}

        {/* Login Button */}
        <button
          onClick={handleLoginClick}
          disabled={state.isLoading || isWaitingForLogin || (isCheckingBackend && !backendStatus.mockMode)}
          className="w-[176px] bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mb-8"
        >
          {isWaitingForLogin ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Signing in...
            </span>
          ) : state.isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Signing in...
            </span>
          ) : (
            "Login"
          )}
        </button>

        {/* Disabled Tools Grid */}
        <DisabledToolsGrid />

        {/* Backend Status Details */}
        {backendStatus.error && !backendStatus.mockMode && (
          <div className="mt-4 text-center">
            <p className="text-xs text-red-600">{backendStatus.error}</p>
            <button
              onClick={checkBackendStatus}
              className="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
            >
              Retry Connection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}