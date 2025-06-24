// components/LoginComponent.tsx - Cellebrite Style with New Tab Login
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { serviceManager } from "../services/serviceManager";
import ToolsGrid from "./ToolsGrid";

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
    <div className="w-[402px] h-[277px] bg-white flex flex-col">
      {/* Header */}
      <div className="bg-white p-4 flex items-start">
        <div className="flex justify-center items-center flex-1">
          {/* Cellebrite Logo */}
          <div className="flex flex-col items-center">
            {logoUrl && (
              <img src={logoUrl} alt="Cellebrite Logo" className="w-2/3" />
            )}
            <p className="text-xl text-gray-500">My insights</p>
          </div>
        </div>
      </div>

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

        {/* Tools Grid */}
        <ToolsGrid />
      </div>
    </div>
  );
}
