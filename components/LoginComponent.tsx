// components/LoginComponent.tsx - Simple Login Form with Conditional Display
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
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
      </div>

      {/* Region Video - Disabled */}
      <div className="flex flex-col items-center space-y-1 opacity-30 relative">
        <div className="w-8 h-6 border-2 border-gray-400 border-dashed rounded-sm flex items-center justify-center">
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        </div>
        <span className="text-xs text-gray-400">R.Video</span>
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

export default function LoginComponent({ onLoginSuccess }: LoginComponentProps) {
  const { state, login, clearError } = useAuth();
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });

  // Clear error when component mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Handle successful login
  useEffect(() => {
    if (state.isAuthenticated) {
      // Reset form state on successful login
      setShowLoginForm(false);
      setCredentials({ username: "", password: "" });
      
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    }
  }, [state.isAuthenticated, onLoginSuccess]);

  const handleLoginClick = () => {
    setShowLoginForm(true);
    clearError();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (state.error) {
      clearError();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!credentials.username.trim() || !credentials.password.trim()) {
      return;
    }

    try {
      await login(credentials);
    } catch (error) {
      // Error is handled by the auth context
      console.error("Login failed:", error);
    }
  };

  const handleCancel = () => {
    setShowLoginForm(false);
    setCredentials({ username: "", password: "" });
    clearError();
  };

  return (
    <div className="min-w-[402px] min-h-[280px] bg-white flex flex-col">
      {/* Header with Cellebrite Logo */}
      <div className="bg-white p-4 flex items-center justify-center">
        <div className="flex flex-col items-center">
          {logo && (
            <img src={logo} alt="Cellebrite Logo" className="w-2/3" />
          )}
          <p className="text-xl text-gray-500">My insights</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {!showLoginForm ? (
          /* Initial Login Button */
          <div className="w-full max-w-sm">
            {/* Demo tip for development */}
            {import.meta.env.VITE_ENABLE_MOCK_MODE === 'true' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-center">
                <p className="text-sm text-blue-600">Demo: demo / password</p>
              </div>
            )}
            
            <button
              onClick={handleLoginClick}
              disabled={state.isLoading}
              className="w-[176px] mx-auto block bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mb-8"
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
          </div>
        ) : (
          /* Login Form */
          <div className="w-full max-w-sm">
            <form onSubmit={handleSubmit}>
              {/* Demo tip for development */}
              {import.meta.env.VITE_ENABLE_MOCK_MODE === 'true' && !state.isLoading && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-center">
                  <p className="text-sm text-blue-600">Demo: demo / password</p>
                </div>
              )}
              
              {/* Error Message */}
              {state.error && !state.isLoading && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{state.error}</p>
                </div>
              )}

              {/* Input Fields - Hidden when loading */}
              {!state.isLoading && (
                <>
                  {/* Username/Email Field */}
                  <div className="mb-4">
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                      Username/Email
                    </label>
                    <input
                      type="text"
                      id="username"
                      name="username"
                      value={credentials.username}
                      onChange={handleInputChange}
                      className="w-full bg-white/20 text-gray-800 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter username or email"
                      required
                      autoFocus
                    />
                  </div>

                  {/* Password Field */}
                  <div className="mb-6">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={credentials.password}
                      onChange={handleInputChange}
                      className="w-full bg-white/20 text-gray-800 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter password"
                      required
                    />
                  </div>
                </>
              )}

              {/* Action Buttons */}
              {state.isLoading ? (
                /* Loading State - Only show loading button */
                <div className="flex justify-center">
                  <button
                    type="button"
                    disabled
                    className="w-[176px] bg-blue-600 text-white py-3 px-4 rounded-md font-medium opacity-70 cursor-not-allowed"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Signing in...
                    </span>
                  </button>
                </div>
              ) : (
                /* Normal State - Show Cancel and Sign In buttons */
                <div className="flex gap-2 mb-6">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-md font-medium transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!credentials.username.trim() || !credentials.password.trim()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Disabled Tools Grid */}
        {!showLoginForm && <DisabledToolsGrid />}
      </div>
    </div>
  );
}