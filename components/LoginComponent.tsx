// components/LoginComponent.tsx - Enhanced with Better Login Tab UX
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

interface LoginTabState {
  isTabOpen: boolean;
  tabId?: number;
  openTime?: number;
  checkInterval?: NodeJS.Timeout;
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
  const [loginTabState, setLoginTabState] = useState<LoginTabState>({
    isTabOpen: false,
  });
  const [showTabInstructions, setShowTabInstructions] = useState(false);

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
      console.log('✅ Login detected in LoginComponent');
      
      // Clean up login tab state
      if (loginTabState.checkInterval) {
        clearInterval(loginTabState.checkInterval);
      }
      setLoginTabState({ isTabOpen: false });
      setShowTabInstructions(false);
      
      // Initialize services and call success callback
      serviceManager.onLoginSuccess();
      onLoginSuccess();
    }
  }, [state.isAuthenticated, onLoginSuccess, loginTabState.checkInterval]);

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

  const handleLoginClick = async () => {
    try {
      setShowTabInstructions(true);
      
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

      console.log('🔗 Opening login tab:', loginUrl);

      // Open login tab
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.create({ url: loginUrl, active: true }, (tab) => {
          if (tab?.id) {
            setLoginTabState({
              isTabOpen: true,
              tabId: tab.id,
              openTime: Date.now(),
            });
            
            // Start monitoring the tab
            startTabMonitoring(tab.id);
          }
        });
      } else {
        // Fallback for development
        const newTab = window.open(loginUrl, "_blank");
        if (newTab) {
          setLoginTabState({
            isTabOpen: true,
            openTime: Date.now(),
          });
          
          // Start monitoring for auth changes
          startAuthMonitoring();
        }
      }
    } catch (error) {
      console.error("Failed to open login page:", error);
      setShowTabInstructions(false);
      
      // Fallback to backend URL
      try {
        const loginUrl = `${backendStatus.apiUrl.replace("/api", "")}/login?source=extension`;
        window.open(loginUrl, "_blank");
      } catch (fallbackError) {
        console.error("Fallback login failed:", fallbackError);
        alert("Failed to open login page. Please check your connection.");
      }
    }
  };

  const startTabMonitoring = (tabId: number) => {
    const checkInterval = setInterval(async () => {
      try {
        // Check if tab still exists
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError || !tab) {
            // Tab was closed
            console.log('Login tab was closed');
            clearInterval(checkInterval);
            setLoginTabState({ isTabOpen: false });
            setShowTabInstructions(false);
          }
        });
      } catch (error) {
        console.error('Tab monitoring error:', error);
        clearInterval(checkInterval);
        setLoginTabState({ isTabOpen: false });
        setShowTabInstructions(false);
      }
    }, 2000);

    setLoginTabState(prev => ({
      ...prev,
      checkInterval,
    }));

    // Auto-cleanup after 5 minutes
    setTimeout(() => {
      clearInterval(checkInterval);
      setLoginTabState({ isTabOpen: false });
      setShowTabInstructions(false);
    }, 5 * 60 * 1000);
  };

  const startAuthMonitoring = () => {
    const checkInterval = setInterval(async () => {
      // This will be handled by the AuthContext's monitor
      // Just clean up if user is authenticated
      if (state.isAuthenticated) {
        clearInterval(checkInterval);
        setLoginTabState({ isTabOpen: false });
        setShowTabInstructions(false);
      }
    }, 2000);

    setLoginTabState(prev => ({
      ...prev,
      checkInterval,
    }));

    // Auto-cleanup after 5 minutes
    setTimeout(() => {
      clearInterval(checkInterval);
      setLoginTabState({ isTabOpen: false });
      setShowTabInstructions(false);
    }, 5 * 60 * 1000);
  };

  const handleCancelLogin = () => {
    if (loginTabState.checkInterval) {
      clearInterval(loginTabState.checkInterval);
    }
    
    // Close the login tab if we have its ID
    if (loginTabState.tabId && typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.remove(loginTabState.tabId);
    }
    
    setLoginTabState({ isTabOpen: false });
    setShowTabInstructions(false);
  };

  const getStatusColor = (connected: boolean, mockMode: boolean) => {
    if (mockMode) return "bg-yellow-100 text-yellow-800";
    if (connected) return "bg-green-100 text-green-800";
    return "bg-red-100 text-red-800";
  };

  const getStatusText = () => {
    if (backendStatus.mockMode) return "Mock Mode";
    if (backendStatus.connected) return "Connected";
    return "Disconnected";
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
      <div className="flex flex-col items-center justify-center px-6">
        {/* Login Button */}
        <button
          onClick={handleLoginClick}
          disabled={
            state.isLoading ||
            loginTabState.isTabOpen ||
            (isCheckingBackend && !backendStatus.mockMode)
          }
          className="w-[176px] bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mb-8"
        >
          {loginTabState.isTabOpen ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Waiting for login...
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

        {/* Tools Grid */}
        <ToolsGrid />

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