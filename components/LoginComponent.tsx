// components/LoginComponent.tsx - Cellebrite Style with New Tab Login
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { serviceManager } from "../services/serviceManager";

import logo from "@/assets/logo.png";
interface LoginComponentProps {
  onLoginSuccess?: () => void;
}

interface BackendStatus {
  connected: boolean;
  apiUrl: string;
  mockMode: boolean;
  error?: string;
}

export default function LoginComponent({
  onLoginSuccess,
}: LoginComponentProps) {
  const { state, clearError, checkConnection } = useAuth();
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    connected: false,
    apiUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api",
    mockMode: import.meta.env.VITE_ENABLE_MOCK_MODE === "true",
  });
  const [isCheckingBackend, setIsCheckingBackend] = useState(true);
  const [logoUrl, setLogoUrl] = useState(logo);

  // Check backend status on mount
  useEffect(() => {
    checkBackendStatus();
  }, []);

  // Clear error when component mounts
  useEffect(() => {
    clearError();
  }, []);

  // Handle successful login from new tab
  useEffect(() => {
    if (state.isAuthenticated && onLoginSuccess) {
      serviceManager.onLoginSuccess();
      onLoginSuccess();
    }
  }, [state.isAuthenticated, onLoginSuccess]);

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
        error:
          error instanceof Error ? error.message : "Connection check failed",
      }));
    }
    setIsCheckingBackend(false);
  };

  // Open login in new tab
  const handleLoginClick = () => {
    try {
      // Option 1: Use extension-hosted login page (WXT approach)
      if (typeof chrome !== "undefined" && chrome.runtime) {
        const loginUrl = chrome.runtime.getURL("login/index.html");
        chrome.tabs.create({ url: loginUrl });
      } else {
        // Option 2: Use backend-hosted login page (fallback)
        const loginUrl = `${backendStatus.apiUrl.replace(
          "/api",
          ""
        )}/login?source=extension`;
        window.open(loginUrl, "_blank");
      }
    } catch (error) {
      console.error("Failed to open login page:", error);
      // Fallback to backend URL
      const loginUrl = `${backendStatus.apiUrl.replace(
        "/api",
        ""
      )}/login?source=extension`;
      window.open(loginUrl, "_blank");
    }
  };

  // Use mock credentials for development
  const handleMockLogin = async () => {
    // This would typically trigger some kind of mock authentication
    console.log("Mock login triggered");
  };

  return (
    <div className="w-[402px] h-[277px] bg-white flex flex-col rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-white p-4 flex items-start">
        <div className="flex justify-center items-center flex-1">
          {/* Cellebrite Logo */}
          <div className="flex flex-col items-center">
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Cellebrite Logo"
                className="w-1/2"
              />
            )}
            <p className="text-xs text-gray-500">My insights</p>
          </div>
        </div>
        {/* <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
          JD
        </div> */}
      </div>

      {/* Error Messages */}
      {state.error && (
        <div className="px-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm mb-4">
            <div className="flex items-center">
              <span className="mr-2">❌</span>
              <span>{state.error}</span>
            </div>
            {state.error.includes("Backend") && (
              <div className="text-xs mt-1 opacity-75">
                Check if backend server is running on {backendStatus.apiUrl}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Login Button */}
        <button
          onClick={handleLoginClick}
          disabled={
            state.isLoading ||
            (!backendStatus.connected && !backendStatus.mockMode)
          }
          className="w-[176px] bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mb-8"
        >
          {state.isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Signing in...
            </span>
          ) : (
            "Login"
          )}
        </button>

        {!backendStatus.connected && !backendStatus.mockMode && (
          <div className="text-center text-sm text-red-600 mb-4">
            Backend connection required to login
          </div>
        )}

        {/* Tools Grid */}
        <div className="w-full">
          <div className="grid grid-cols-6 gap-4">
            <div className="flex flex-col items-center">
              <div className="w-10 h-8 bg-gray-200 rounded border flex items-center justify-center mb-1">
              </div>
              <span className="text-xs text-gray-600">Screen</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-10 h-8 bg-gray-200 rounded border flex items-center justify-center mb-1">
              </div>
              <span className="text-xs text-gray-600">Full</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-10 h-8 bg-gray-200 rounded border flex items-center justify-center mb-1">
              </div>
              <span className="text-xs text-gray-600">Region</span>
            </div>

            {/* Divider */}
            <div className="flex items-center justify-center">
              <div className="w-px h-8 bg-gray-300"></div>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-10 h-8 bg-gray-200 rounded border flex items-center justify-center mb-1">
              </div>
              <span className="text-xs text-gray-600">Video</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-10 h-8 bg-gray-200 rounded border flex items-center justify-center mb-1">
              </div>
              <span className="text-xs text-gray-600">R.Video</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Messages */}
      {state.error && (
        <div className="px-4 pb-2">
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
            <div className="flex items-center">
              <span className="mr-2">❌</span>
              <span>{state.error}</span>
            </div>
          </div>
        </div>
      )}

      {/* Backend Status - Only show if error */}
      {!backendStatus.connected && !backendStatus.mockMode && (
        <div className="px-4 pb-2">
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="mr-2">❌</span>
                <span className="font-medium">Backend Offline</span>
              </div>
              <button
                onClick={checkBackendStatus}
                disabled={isCheckingBackend}
                className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Development Mode Indicator */}
      {import.meta.env.VITE_NODE_ENV === "development" &&
        backendStatus.mockMode && (
          <div className="px-4 pb-2">
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded-md text-sm text-center">
              <span className="text-xs">🔧 Development Mode</span>
            </div>
          </div>
        )}
    </div>
  );
}
