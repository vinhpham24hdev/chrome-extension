import React, { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";
import { serviceManager } from "../../services/serviceManager";
import LoginComponent from "../../components/LoginComponent";
import Dashboard from "../../components/Dashboard";

// Service initialization component
function ServiceInitializer({ children }: { children: React.ReactNode }) {
  const [initializationState, setInitializationState] = useState<{
    isInitialized: boolean;
    isLoading: boolean;
    errors: string[];
    warnings: string[];
  }>({
    isInitialized: false,
    isLoading: true,
    errors: [],
    warnings: [],
  });

  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log("🚀 Initializing application services...");
        const result = await serviceManager.initialize();

        setInitializationState({
          isInitialized: result.success || result.warnings.length > 0,
          isLoading: false,
          errors: result.errors,
          warnings: result.warnings,
        });

        if (result.success) {
          console.log("✅ Application services initialized successfully");
        } else {
          console.error("❌ Service initialization failed:", result.errors);
        }

        // 🔥 FIXED: Notify background script that popup is opened
        try {
          await chrome.runtime.sendMessage({
            type: "POPUP_OPENED",
            timestamp: Date.now(),
          });
          console.log("📤 Notified background script that popup opened");
        } catch (error) {
          console.warn("⚠️ Failed to notify background script:", error);
        }

      } catch (error) {
        console.error("💥 Critical initialization error:", error);
        setInitializationState({
          isInitialized: false,
          isLoading: false,
          errors: [
            error instanceof Error
              ? error.message
              : "Unknown initialization error",
          ],
          warnings: [],
        });
      }
    };

    initializeServices();
  }, []);

  // Show loading state
  if (initializationState.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing services...</p>
          <p className="text-sm text-gray-500 mt-2">
            {import.meta.env.VITE_ENABLE_MOCK_MODE === "true"
              ? "Mock Mode"
              : "Real Backend"}
          </p>
        </div>
      </div>
    );
  }

  // Show initialization errors
  if (
    !initializationState.isInitialized &&
    initializationState.errors.length > 0
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-900 mb-4">
            Service Initialization Failed
          </h2>
          <div className="text-left bg-red-100 p-4 rounded mb-4">
            <h3 className="font-medium text-red-800 mb-2">Errors:</h3>
            <ul className="text-sm text-red-700 space-y-1">
              {initializationState.errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Retry
          </button>
          <div className="mt-4 text-xs text-gray-500">
            API: {import.meta.env.VITE_API_BASE_URL || "Not configured"}
          </div>
        </div>
      </div>
    );
  }

  // Show warnings but continue
  if (initializationState.warnings.length > 0) {
    console.warn("⚠️ Service warnings:", initializationState.warnings);
  }

  return <>{children}</>;
}

// Main app content component
function AppContent() {
  const { state } = useAuth();

  // 🔥 NEW: Setup message listener for background script communications
  useEffect(() => {
    const handleBackgroundMessage = (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      console.log("📨 App received message:", message.type);

      // Handle any app-level messages from background script
      if (message.type === "POPUP_MESSAGE") {
        console.log("📨 Popup message received:", message.data);
        sendResponse({ received: true });
      }

      // Forward region capture messages to Dashboard component
      if (message.type === "REGION_CAPTURE_COMPLETED" || 
          message.type === "REGION_CAPTURE_FAILED" || 
          message.type === "REGION_CAPTURE_CANCELLED") {
        // These will be handled by Dashboard component
        console.log("📨 Region capture message received, will be handled by Dashboard");
      }
    };

    // Add message listener
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener(handleBackgroundMessage);
    }

    return () => {
      // Remove message listener
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(handleBackgroundMessage);
      }
    };
  }, []);

  // Show loading state while checking authentication
  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show dashboard if authenticated, otherwise show login
  return state.isAuthenticated ? (
    <Dashboard />
  ) : (
    <LoginComponent
      onLoginSuccess={() => {
        console.log("✅ Login successful, switching to dashboard");
      }}
    />
  );
}

// Main App component
function App() {
  // 🔥 NEW: Handle popup lifecycle
  useEffect(() => {
    console.log("🎯 Popup App component mounted");

    // Cleanup function when popup closes
    return () => {
      console.log("🚪 Popup App component unmounting");
    };
  }, []);

  return (
    <ServiceInitializer>
      <AuthProvider>
        <div className="min-w-[402px] max-w-full">
          <AppContent />

          {/* Development info */}
          {import.meta.env.VITE_NODE_ENV === "development" && (
            <div className="fixed top-0 left-0 text-xs text-gray-600 px-2 py-1 bg-white/80 rounded-br">
              {import.meta.env.VITE_ENABLE_MOCK_MODE === "true"
                ? "🔧 Mock"
                : "🔗 Real"}{" "}
              |{" "}
              {import.meta.env.VITE_API_BASE_URL?.replace(
                "http://",
                ""
              ).replace("https://", "")}
            </div>
          )}
        </div>
      </AuthProvider>
    </ServiceInitializer>
  );
}

export default App;