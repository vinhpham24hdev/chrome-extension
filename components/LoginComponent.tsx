// components/LoginComponent.tsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
// Using Tailwind CSS classes instead of separate CSS file

interface LoginFormData {
  username: string;
  password: string;
}

interface LoginComponentProps {
  onLoginSuccess?: () => void;
}

export default function LoginComponent({
  onLoginSuccess,
}: LoginComponentProps) {
  const { state, login, clearError } = useAuth();
  const [formData, setFormData] = useState<LoginFormData>({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Clear error when component mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Handle successful login
  useEffect(() => {
    if (state.isAuthenticated && onLoginSuccess) {
      onLoginSuccess();
    }
  }, [state.isAuthenticated, onLoginSuccess]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }

    // Clear auth error when user starts typing
    if (state.error) {
      clearError();
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setValidationErrors([]);
    clearError();

    // Client-side validation
    const errors: string[] = [];
    if (!formData.username.trim()) {
      errors.push("Username is required");
    }
    if (!formData.password) {
      errors.push("Password is required");
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Attempt login
    await login(formData);
  };

  // Fill demo credentials
  const fillDemoCredentials = () => {
    setFormData({
      username: "demo",
      password: "password",
    });
    clearError();
    setValidationErrors([]);
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-5">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-center py-10 px-8">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-semibold mb-2">
            Chrome Extension Login
          </h1>
          <p className="opacity-90">Sign in to continue</p>
        </div>

        {/* Error Messages */}
        {(state.error || validationErrors.length > 0) && (
          <div className="px-8 pt-4">
            {state.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm mb-2">
                {state.error}
              </div>
            )}
            {validationErrors.map((error, index) => (
              <div
                key={index}
                className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded-md text-sm mb-2"
              >
                {error}
              </div>
            ))}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-8">
          <div className="mb-5">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                👤
              </span>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter username"
                disabled={state.isLoading}
                className={`w-full pl-10 pr-4 py-3 border-2 rounded-lg transition-all duration-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  validationErrors.some((e) => e.includes("Username"))
                    ? "border-red-300 bg-red-50"
                    : "border-gray-200"
                }`}
              />
            </div>
          </div>

          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Password
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                🔒
              </span>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter password"
                disabled={state.isLoading}
                className={`w-full pl-10 pr-12 py-3 border-2 rounded-lg transition-all duration-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  validationErrors.some((e) => e.includes("Password"))
                    ? "border-red-300 bg-red-50"
                    : "border-gray-200"
                }`}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                disabled={state.isLoading}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50 p-1 rounded transition-colors duration-200"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={state.isLoading}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-lg font-semibold transition-all duration-200 hover:shadow-lg hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
          >
            {state.isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Demo Credentials */}
        <div className="bg-gray-50 px-8 py-5 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-600 mb-1">
            Demo credentials:
          </p>
          <p className="text-xs text-gray-500 font-mono bg-white px-3 py-2 rounded border mb-3">
            Username: demo | Password: password
          </p>
          <button
            type="button"
            onClick={fillDemoCredentials}
            disabled={state.isLoading}
            className="bg-green-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:bg-green-600 hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
          >
            Fill Demo Credentials
          </button>
        </div>
      </div>
    </div>
  );
}
