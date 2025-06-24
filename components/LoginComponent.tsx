// components/LoginComponent.tsx - Cellebrite Style with New Tab Login
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { serviceManager } from "../services/serviceManager";

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
        error: error instanceof Error ? error.message : "Connection check failed",
      }));
    }
    setIsCheckingBackend(false);
  };

  // Open login in new tab
  const handleLoginClick = () => {
    const loginUrl = `${backendStatus.apiUrl.replace('/api', '')}/login?source=extension`;
    chrome.tabs.create({ url: loginUrl });
  };

  // Use mock credentials for development
  const handleMockLogin = async () => {
    // This would typically trigger some kind of mock authentication
    console.log("Mock login triggered");
  };

  return (
    <div className="w-[400px] h-[600px] bg-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6 text-center">
        <div className="flex items-center justify-center mb-4">
          {/* Cellebrite Logo Dots */}
          <div className="flex items-center space-x-1 mr-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Cellebrite</h1>
        </div>
        <p className="text-gray-600">My insights</p>
      </div>

      {/* Backend Status */}
      <div className="px-6 pt-4">
        <div
          className={`p-3 rounded-md text-sm mb-4 ${
            isCheckingBackend
              ? "bg-gray-100 text-gray-700"
              : backendStatus.connected
              ? "bg-green-50 border border-green-200 text-green-700"
              : backendStatus.mockMode
              ? "bg-yellow-50 border border-yellow-200 text-yellow-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="mr-2">
                {isCheckingBackend
                  ? "🔄"
                  : backendStatus.connected
                  ? "✅"
                  : backendStatus.mockMode
                  ? "⚠️"
                  : "❌"}
              </span>
              <span className="font-medium">
                {isCheckingBackend
                  ? "Checking backend..."
                  : backendStatus.connected
                  ? "Backend Connected"
                  : backendStatus.mockMode
                  ? "Mock Mode Active"
                  : "Backend Offline"}
              </span>
            </div>
            {!backendStatus.connected &&
              !backendStatus.mockMode &&
              !isCheckingBackend && (
                <button
                  onClick={checkBackendStatus}
                  className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition-colors"
                >
                  Retry
                </button>
              )}
          </div>

          <div className="text-xs mt-1 opacity-75">
            API:{" "}
            {backendStatus.apiUrl
              .replace("http://", "")
              .replace("https://", "")}
          </div>

          {backendStatus.error && !backendStatus.mockMode && (
            <div className="text-xs mt-1 text-red-600">
              {backendStatus.error}
            </div>
          )}

          {backendStatus.mockMode && (
            <div className="text-xs mt-1">
              Using mock data for development
            </div>
          )}
        </div>
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
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mb-4"
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

        {/* Capture Tools Preview */}
        <div className="w-full mt-8">
          <div className="text-center text-sm text-gray-600 mb-4">
            Available capture tools:
          </div>
          
          {/* Tools Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center p-3 border border-gray-200 rounded-lg bg-gray-50">
              <div className="w-8 h-8 bg-gray-300 rounded mb-2 flex items-center justify-center">
                📱
              </div>
              <span className="text-xs text-gray-600">Screen</span>
            </div>
            
            <div className="flex flex-col items-center p-3 border border-gray-200 rounded-lg bg-gray-50">
              <div className="w-8 h-8 bg-gray-300 rounded mb-2 flex items-center justify-center">
                🖥️
              </div>
              <span className="text-xs text-gray-600">Full</span>
            </div>
            
            <div className="flex flex-col items-center p-3 border border-gray-200 rounded-lg bg-gray-50">
              <div className="w-8 h-8 bg-gray-300 rounded mb-2 flex items-center justify-center">
                ✂️
              </div>
              <span className="text-xs text-gray-600">Region</span>
            </div>
            
            <div className="flex flex-col items-center p-3 border border-gray-200 rounded-lg bg-gray-50">
              <div className="w-8 h-8 bg-gray-300 rounded mb-2 flex items-center justify-center">
                🎥
              </div>
              <span className="text-xs text-gray-600">Video</span>
            </div>
            
            <div className="flex flex-col items-center p-3 border border-gray-200 rounded-lg bg-gray-50">
              <div className="w-8 h-8 bg-gray-300 rounded mb-2 flex items-center justify-center">
                📹
              </div>
              <span className="text-xs text-gray-600">R. Video</span>
            </div>
            
            <div className="flex flex-col items-center p-3 border border-gray-200 rounded-lg bg-gray-50 opacity-50">
              <div className="w-8 h-8 bg-gray-200 rounded mb-2 flex items-center justify-center">
                ➕
              </div>
              <span className="text-xs text-gray-400">More</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
        <div className="text-center">
          {/* Development Buttons */}
          {import.meta.env.VITE_NODE_ENV === 'development' && (
            <div className="space-y-2">
              <button
                onClick={handleMockLogin}
                disabled={state.isLoading}
                className="w-full bg-green-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Use Mock Mode
              </button>

              <button
                onClick={checkBackendStatus}
                disabled={isCheckingBackend}
                className="w-full bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCheckingBackend ? "⏳" : "🔄"} Check Backend
              </button>
            </div>
          )}

          {/* Version Info */}
          <div className="mt-3 text-xs text-gray-500">
            <div>Mode: {backendStatus.mockMode ? "Mock" : "Real API"}</div>
            <div>Env: {import.meta.env.VITE_NODE_ENV}</div>
          </div>
        </div>
      </div>
    </div>
  );
}