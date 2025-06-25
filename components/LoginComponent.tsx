// components/LoginComponent.tsx - Prevent Auto Close & Better Window Management
import React, { useState, useEffect, useCallback } from "react";
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

interface LoginWindowState {
  isOpen: boolean;
  window: Window | null;
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
  const [loginWindow, setLoginWindow] = useState<LoginWindowState>({
    isOpen: false,
    window: null,
  });
  const [isWaitingForLogin, setIsWaitingForLogin] = useState(false);

  // Handle successful login detection
  useEffect(() => {
    if (state.isAuthenticated && isWaitingForLogin) {
      console.log('✅ Login detected - success!');
      
      // Close login window if open (but don't force it)
      if (loginWindow.window && !loginWindow.window.closed) {
        // CHANGED: Don't force close, just notify
        console.log('🪟 Login successful, but keeping window open as requested');
      }
      
      // Clear intervals
      if (loginWindow.checkInterval) {
        clearInterval(loginWindow.checkInterval);
      }
      
      // Reset states
      setLoginWindow({ isOpen: false, window: null });
      setIsWaitingForLogin(false);
      
      // Call success callback
      if (onLoginSuccess) {
        serviceManager.onLoginSuccess();
        onLoginSuccess();
      }
    }
  }, [state.isAuthenticated, isWaitingForLogin, onLoginSuccess, loginWindow]);

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
        error:
          error instanceof Error ? error.message : "Connection check failed",
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

      console.log('🪟 Opening login window:', loginUrl);

      // Open login page in new window (NOT tab)
      const newWindow = window.open(
        loginUrl,
        'cellebrite-login',
        'width=500,height=600,scrollbars=yes,resizable=yes,status=yes,location=yes'
      );

      if (newWindow) {
        setLoginWindow({
          isOpen: true,
          window: newWindow,
          openTime: Date.now(),
        });
        
        // Start monitoring the window
        startWindowMonitoring(newWindow);
      } else {
        throw new Error('Failed to open login window. Please check popup blocker settings.');
      }
    } catch (error) {
      console.error("Failed to open login window:", error);
      setIsWaitingForLogin(false);
      alert(`Failed to open login window: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const startWindowMonitoring = (loginWindow: Window) => {
    const checkInterval = setInterval(async () => {
      try {
        // Check if window is still open
        if (loginWindow.closed) {
          console.log('🪟 Login window was closed by user');
          clearInterval(checkInterval);
          setLoginWindow({ isOpen: false, window: null });
          
          // CHANGED: Give more time for auth state to be processed
          // and don't immediately reset waiting state
          setTimeout(async () => {
            if (!state.isAuthenticated) {
              console.log('🔄 Window closed but no auth detected, resetting state');
              setIsWaitingForLogin(false);
            } else {
              console.log('✅ Window closed but user is authenticated');
            }
          }, 2000); // Increased from 1000ms to 2000ms
          return;
        }

        // Check auth state - the AuthContext should automatically detect changes
        // No need to manually check here since we have storage listeners
        
      } catch (error) {
        console.error('Window monitoring error:', error);
        clearInterval(checkInterval);
        setLoginWindow({ isOpen: false, window: null });
        // CHANGED: Don't immediately reset waiting state on error
        setTimeout(() => {
          if (!state.isAuthenticated) {
            setIsWaitingForLogin(false);
          }
        }, 2000);
      }
    }, 1000); // Check every second

    setLoginWindow(prev => ({
      ...prev,
      checkInterval,
    }));

    // CHANGED: Increased timeout from 10 to 30 minutes
    setTimeout(() => {
      if (!loginWindow.closed) {
        console.log('🕒 Login window timeout (30 min), cleaning up...');
        // Don't force close, just clean up our tracking
        clearInterval(checkInterval);
        setLoginWindow({ isOpen: false, window: null });
        if (!state.isAuthenticated) {
          setIsWaitingForLogin(false);
        }
      }
    }, 30 * 60 * 1000); // 30 minutes instead of 10
  };

  const handleCancelLogin = () => {
    // CHANGED: Ask user before closing window
    const confirmClose = window.confirm('Are you sure you want to cancel the login process? This will close the login window.');
    
    if (!confirmClose) {
      return;
    }
    
    // Close login window
    if (loginWindow.window && !loginWindow.window.closed) {
      loginWindow.window.close();
    }
    
    // Clear interval
    if (loginWindow.checkInterval) {
      clearInterval(loginWindow.checkInterval);
    }
    
    // Reset states
    setLoginWindow({ isOpen: false, window: null });
    setIsWaitingForLogin(false);
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
    <div className="w-[402px] h-[380px] bg-white flex flex-col">
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
        {/* Connection Status */}
        {isCheckingBackend && (
          <div className="mb-4 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Checking connection...</p>
          </div>
        )}

        {/* Waiting for Login State */}
        {isWaitingForLogin && loginWindow.isOpen && (
          <div className="text-center mb-6 w-full">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-center mb-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                <p className="text-sm font-medium text-blue-800">
                  Login window opened
                </p>
              </div>
              <p className="text-xs text-blue-700 mb-3">
                Complete your login in the popup window. The window will stay open after login.
              </p>
              {backendStatus.mockMode && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-3">
                  <p className="text-xs text-yellow-800">
                    <strong>Demo credentials:</strong><br/>
                    Email: demo.user@cellebrite.com<br/>
                    Password: password
                  </p>
                </div>
              )}
              <button
                onClick={handleCancelLogin}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Cancel Login Process
              </button>
            </div>
          </div>
        )}
        
        {/* Login Button */}
        <button
          onClick={handleLoginClick}
          disabled={
            state.isLoading ||
            isWaitingForLogin ||
            (isCheckingBackend && !backendStatus.mockMode)
          }
          className="w-[176px] bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mb-8"
        >
          {isWaitingForLogin ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Login window open...
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