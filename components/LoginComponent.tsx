import React, { useState, useEffect } from "react";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const LoginComponent = () => {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginStatus, setLoginStatus] = useState<any>(); // 'success', 'error', null
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuthStatus = async () => {
      // In a real Chrome extension, you'd check chrome.storage
      const stored = localStorage.getItem("mockAuth");
      if (stored) {
        const authData = JSON.parse(stored);
        if (authData.isAuthenticated && authData.expiresAt > Date.now()) {
          setIsAuthenticated(true);
        }
      }
    };
    checkAuthStatus();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setCredentials((prev) => ({
      ...prev,
      [field]: value,
    }));
    setLoginStatus(null);
  };

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginStatus(null);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock authentication logic
    if (
      credentials.username === "demo" &&
      credentials.password === "password"
    ) {
      // Success
      const authData = {
        isAuthenticated: true,
        username: credentials.username,
        loginTime: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      };

      localStorage.setItem("mockAuth", JSON.stringify(authData));
      setIsAuthenticated(true);
      setLoginStatus("success");
    } else {
      // Error
      setLoginStatus("error");
    }

    setIsLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("mockAuth");
    setIsAuthenticated(false);
    setCredentials({ username: "", password: "" });
    setLoginStatus(null);
  };

  // Authenticated view
  if (isAuthenticated) {
    return (
      <div className="w-80 bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-3" />
          <h2 className="text-xl font-bold">Authentication Successful</h2>
          <p className="text-blue-100 mt-1">Welcome back!</p>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Logged in as</p>
                <p className="font-semibold text-gray-900">
                  {credentials.username}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">5</div>
                <div className="text-sm text-gray-600">Active Cases</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">12</div>
                <div className="text-sm text-gray-600">Screenshots</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Login form view
  return (
    <div className="w-80 bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 text-center">
        <Lock className="w-12 h-12 mx-auto mb-3" />
        <h2 className="text-xl font-bold">Chrome Extension Login</h2>
        <p className="text-blue-100 mt-1">Sign in to continue</p>
      </div>

      <div className="p-6 space-y-4">
        {/* Username Field */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Username
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={credentials.username}
              onChange={(e) => handleInputChange("username", e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
              placeholder="Enter username"
              required
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={credentials.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
              className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
              placeholder="Enter password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {loginStatus === "error" && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700">
              Invalid credentials. Try demo/password
            </p>
          </div>
        )}

        {loginStatus === "success" && (
          <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <p className="text-sm text-green-700">Login successful!</p>
          </div>
        )}

        {/* Login Button */}
        <button
          type="button"
          onClick={handleLogin}
          disabled={isLoading || !credentials.username || !credentials.password}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
            isLoading || !credentials.username || !credentials.password
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Signing in...</span>
            </div>
          ) : (
            "Sign In"
          )}
        </button>

        {/* Demo Credentials */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 text-center">
            <strong>Demo credentials:</strong>
            <br />
            Username: demo | Password: password
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginComponent;
