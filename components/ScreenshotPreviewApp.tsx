// components/ScreenshotPreviewApp.tsx - Main app component for screenshot preview window
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import ScreenshotPreview, { ScreenshotData } from "./ScreenshotPreview";

interface PreviewWindowState {
  screenshot: ScreenshotData | null;
  isLoading: boolean;
  error: string | null;
}

function ScreenshotPreviewWindow() {
  const [state, setState] = useState<PreviewWindowState>({
    screenshot: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    // Inject Tailwind CSS into the document
    injectTailwindCSS();

    // Hide loading indicator initially shown in HTML
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
      loadingElement.style.display = "none";
    }

    // Get screenshot data from URL parameters or storage
    loadScreenshotData();

    // Listen for messages from popup window
    const messageListener = (
      message: any,
      sender: chrome.runtime.MessageSender
    ) => {
      if (message.type === "SCREENSHOT_DATA") {
        setState((prev) => ({
          ...prev,
          screenshot: message.data,
          isLoading: false,
          error: null,
        }));
      }

      if (message.type === "CLOSE_PREVIEW") {
        window.close();
      }
    };

    // Add message listener
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener(messageListener);
    }

    // Handle window close events
    const handleBeforeUnload = () => {
      // Notify popup that preview window is closing
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime
          .sendMessage({
            type: "PREVIEW_WINDOW_CLOSED",
          })
          .catch(() => {
            // Ignore errors if popup is closed
          });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const injectTailwindCSS = () => {
    // Create and inject Tailwind CSS
    const css = `
      /* Tailwind CSS Base */
      .fixed { position: fixed !important; }
      .inset-0 { top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }
      .flex { display: flex !important; }
      .flex-1 { flex: 1 1 0% !important; }
      .flex-col { flex-direction: column !important; }
      .items-center { align-items: center !important; }
      .items-start { align-items: flex-start !important; }
      .justify-center { justify-content: center !important; }
      .justify-between { justify-content: space-between !important; }
      .space-x-3 > * + * { margin-left: 0.75rem !important; }
      .space-y-4 > * + * { margin-top: 1rem !important; }
      
      /* Colors */
      .bg-black { background-color: #000 !important; }
      .bg-white { background-color: #fff !important; }
      .bg-gray-50 { background-color: #f9fafb !important; }
      .bg-gray-100 { background-color: #f3f4f6 !important; }
      .bg-gray-200 { background-color: #e5e7eb !important; }
      .bg-blue-50 { background-color: #eff6ff !important; }
      .bg-blue-600 { background-color: #2563eb !important; }
      .bg-blue-700 { background-color: #1d4ed8 !important; }
      .bg-red-50 { background-color: #fef2f2 !important; }
      .bg-green-50 { background-color: #f0fdf4 !important; }
      .bg-opacity-90 { background-color: rgba(0, 0, 0, 0.9) !important; }
      .bg-opacity-50 { background-color: rgba(0, 0, 0, 0.5) !important; }
      
      /* Text */
      .text-white { color: #fff !important; }
      .text-gray-300 { color: #d1d5db !important; }
      .text-gray-700 { color: #374151 !important; }
      .text-gray-900 { color: #111827 !important; }
      .text-blue-700 { color: #1d4ed8 !important; }
      .text-red-400 { color: #f87171 !important; }
      .text-red-700 { color: #b91c1c !important; }
      .text-green-700 { color: #15803d !important; }
      .text-sm { font-size: 0.875rem !important; }
      .text-lg { font-size: 1.125rem !important; }
      .text-6xl { font-size: 3.75rem !important; }
      .text-center { text-align: center !important; }
      .font-medium { font-weight: 500 !important; }
      
      /* Spacing */
      .p-1 { padding: 0.25rem !important; }
      .p-2 { padding: 0.5rem !important; }
      .p-4 { padding: 1rem !important; }
      .px-3 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
      .px-4 { padding-left: 1rem !important; padding-right: 1rem !important; }
      .px-6 { padding-left: 1.5rem !important; padding-right: 1.5rem !important; }
      .py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
      .py-3 { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
      .mb-1 { margin-bottom: 0.25rem !important; }
      .mb-2 { margin-bottom: 0.5rem !important; }
      .mb-4 { margin-bottom: 1rem !important; }
      .mb-6 { margin-bottom: 1.5rem !important; }
      .mr-2 { margin-right: 0.5rem !important; }
      .mt-2 { margin-top: 0.5rem !important; }
      
      /* Sizing */
      .w-4 { width: 1rem !important; }
      .w-6 { width: 1.5rem !important; }
      .w-12 { width: 3rem !important; }
      .w-80 { width: 20rem !important; }
      .w-full { width: 100% !important; }
      .h-2 { height: 0.5rem !important; }
      .h-4 { height: 1rem !important; }
      .h-6 { height: 1.5rem !important; }
      .h-12 { height: 3rem !important; }
      .max-w-md { max-width: 28rem !important; }
      .max-w-6xl { max-width: 72rem !important; }
      .max-h-full { max-height: 100% !important; }
      .max-w-full { max-width: 100% !important; }
      
      /* Borders */
      .border { border-width: 1px !important; }
      .border-blue-600 { border-color: #2563eb !important; }
      .border-gray-200 { border-color: #e5e7eb !important; }
      .border-gray-300 { border-color: #d1d5db !important; }
      .border-blue-200 { border-color: #bfdbfe !important; }
      .border-red-200 { border-color: #fecaca !important; }
      .border-green-200 { border-color: #bbf7d0 !important; }
      .border-l { border-left-width: 1px !important; }
      .border-b { border-bottom-width: 1px !important; }
      .border-t { border-top-width: 1px !important; }
      .rounded { border-radius: 0.25rem !important; }
      .rounded-lg { border-radius: 0.5rem !important; }
      .rounded-md { border-radius: 0.375rem !important; }
      .rounded-full { border-radius: 9999px !important; }
      
      /* Effects */
      .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important; }
      .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important; }
      .overflow-hidden { overflow: hidden !important; }
      
      /* Interactions */
      .transition-colors { transition-property: color, background-color, border-color !important; transition-duration: 0.15s !important; }
      .cursor-not-allowed { cursor: not-allowed !important; }
      .hover\\:bg-gray-50:hover { background-color: #f9fafb !important; }
      .hover\\:bg-gray-100:hover { background-color: #f3f4f6 !important; }
      .hover\\:bg-blue-700:hover { background-color: #1d4ed8 !important; }
      .hover\\:text-gray-600:hover { color: #4b5563 !important; }
      .focus\\:outline-none:focus { outline: none !important; }
      .focus\\:ring-1:focus { box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.5) !important; }
      .focus\\:ring-2:focus { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5) !important; }
      .focus\\:ring-blue-500:focus { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5) !important; }
      .focus\\:border-blue-500:focus { border-color: #3b82f6 !important; }
      .disabled\\:opacity-50:disabled { opacity: 0.5 !important; }
      .disabled\\:cursor-not-allowed:disabled { cursor: not-allowed !important; }
      
      /* Animations */
      .animate-spin { animation: spin 1s linear infinite !important; }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      /* Custom animations */
      .fade-in { animation: fadeIn 0.3s ease-in-out !important; }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .error-shake { animation: shake 0.5s ease-in-out !important; }
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
      
      .btn-hover-scale:hover { transform: scale(1.02) !important; }
      
      .progress-bar-fill { transition: width 0.3s ease-in-out !important; }
      
      /* Object fit */
      .object-contain { object-fit: contain !important; }
      
      /* Z-index */
      .z-50 { z-index: 50 !important; }
      
      /* Specific styles for screenshot preview */
      .preview-image {
        max-height: calc(90vh - 200px) !important;
      }
      
      /* Form elements */
      input, textarea, select {
        border: 1px solid #d1d5db !important;
        border-radius: 0.375rem !important;
        padding: 0.5rem 0.75rem !important;
        font-size: 0.875rem !important;
        width: 100% !important;
      }
      
      input:focus, textarea:focus, select:focus {
        outline: none !important;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5) !important;
        border-color: #3b82f6 !important;
      }
      
      input:disabled, textarea:disabled, select:disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }
      
      /* Button styles */
      button {
        transition: all 0.2s !important;
        font-weight: 500 !important;
      }
      
      button:disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }
    `;

    const styleElement = document.createElement("style");
    styleElement.textContent = css;
    document.head.appendChild(styleElement);

    console.log("Tailwind CSS injected into preview window");
  };

  const loadScreenshotData = async () => {
    try {
      console.log("🔍 Loading screenshot data in preview window...");

      // Method 1: Try to get data from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const screenshotId = urlParams.get("id");
      const type = urlParams.get("type");

      console.log("📋 URL params:", { screenshotId, type });

      if (screenshotId) {
        console.log("💾 Trying to load from storage with ID:", screenshotId);

        if (typeof chrome !== "undefined" && chrome.storage) {
          // Try multiple storage keys for reliability
          const storageKeys = [
            `screenshot_preview_${screenshotId}`,
            `region_preview_data`,
            `latest_screenshot_preview`,
          ];

          console.log("🔑 Checking storage keys:", storageKeys);

          for (const key of storageKeys) {
            try {
              const result = await chrome.storage.local.get([key]);
              const data = result[key];

              console.log(
                `📦 Storage key ${key}:`,
                data ? "Found" : "Not found"
              );

              if (data && data.dataUrl) {
                console.log("✅ Found screenshot data via key:", key);
                console.log("📊 Data info:", {
                  hasDataUrl: !!data.dataUrl,
                  filename: data.filename,
                  type: data.type,
                  dataUrlLength: data.dataUrl?.length,
                });

                setState((prev) => ({
                  ...prev,
                  screenshot: data,
                  isLoading: false,
                  error: null,
                }));

                // Clean up storage after loading (except latest fallback)
                if (key !== "latest_screenshot_preview") {
                  chrome.storage.local.remove([key]);
                }

                return;
              }
            } catch (keyError) {
              console.warn(`⚠️ Error checking storage key ${key}:`, keyError);
            }
          }

          console.warn("⚠️ No data found in storage with any key");
        }
      }

      // Method 2: Wait for message from background script
      console.log("📨 Waiting for data message from background...");

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      // Set up timeout for waiting
      const timeout = setTimeout(() => {
        console.error("⏰ Timeout waiting for screenshot data");
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Timeout loading screenshot data. Please try again.",
        }));
      }, 10000); // 10 second timeout

      // Listen for incoming data
      const messageListener = (
        message: any,
        sender: chrome.runtime.MessageSender
      ) => {
        console.log("📨 Received message in preview window:", message.type);

        if (message.type === "SCREENSHOT_DATA") {
          clearTimeout(timeout);
          console.log("✅ Received screenshot data via message");
          console.log("📊 Message data info:", {
            hasDataUrl: !!message.data?.dataUrl,
            filename: message.data?.filename,
            type: message.data?.type,
          });

          setState((prev) => ({
            ...prev,
            screenshot: message.data,
            isLoading: false,
            error: null,
          }));
        }
      };

      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.onMessage.addListener(messageListener);

        // Cleanup listener when component unmounts or data is received
        window.addEventListener("beforeunload", () => {
          chrome.runtime.onMessage.removeListener(messageListener);
          clearTimeout(timeout);
        });
      }
    } catch (error) {
      console.error("❌ Failed to load screenshot data:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error ? error.message : "Failed to load screenshot",
      }));
    }
  };

  // ENHANCED error display with more helpful information
  if (state.error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center fade-in">
        <div className="text-center text-white max-w-md error-shake">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <div className="text-lg mb-2">Failed to load screenshot</div>
          <div className="text-sm text-gray-300 mb-6">{state.error}</div>

          {/* Debug info */}
          <div className="text-xs text-gray-400 mb-4 text-left bg-gray-800 p-3 rounded">
            <div>
              <strong>Debug Info:</strong>
            </div>
            <div>URL: {window.location.href}</div>
            <div>Time: {new Date().toISOString()}</div>
            <div>User Agent: {navigator.userAgent.split(" ")[0]}</div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="block w-full px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors btn-hover-scale"
            >
              Retry Loading
            </button>
            <button
              onClick={() => {
                // Try to load latest data from storage
                if (typeof chrome !== "undefined" && chrome.storage) {
                  chrome.storage.local.get(
                    ["latest_screenshot_preview"],
                    (result) => {
                      if (result.latest_screenshot_preview) {
                        setState((prev) => ({
                          ...prev,
                          screenshot: result.latest_screenshot_preview,
                          isLoading: false,
                          error: null,
                        }));
                      }
                    }
                  );
                }
              }}
              className="block w-full px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Try Load Latest
            </button>
            <button
              onClick={() => window.close()}
              className="block w-full px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    // Send save request back to popup/background
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: "SAVE_SCREENSHOT",
        data: state.screenshot,
      });
    }

    // Close window after save
    setTimeout(() => {
      window.close();
    }, 1000);
  };

  const handleDownload = () => {
    if (state.screenshot) {
      const link = document.createElement("a");
      link.href = state.screenshot.dataUrl;
      link.download = state.screenshot.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleRetake = () => {
    // Send retake request back to popup
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: "RETAKE_SCREENSHOT",
      });
    }

    window.close();
  };

  const handleClose = () => {
    window.close();
  };

  // Show loading state
  if (state.isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center fade-in">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg">Loading screenshot preview...</div>
          <div className="text-sm text-gray-300 mt-2">
            If this takes too long, please close this window and try again.
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (state.error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center fade-in">
        <div className="text-center text-white max-w-md error-shake">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <div className="text-lg mb-2">Failed to load screenshot</div>
          <div className="text-sm text-gray-300 mb-6">{state.error}</div>
          <button
            onClick={() => window.close()}
            className="px-6 py-2 bg-blue-600 border-blue-600  text-white rounded hover:bg-blue-700 transition-colors btn-hover-scale"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  // Show screenshot preview
  if (state.screenshot) {
    return (
      <div className="fixed inset-0 preview-fullscreen fade-in">
        <ScreenshotPreview
          screenshot={state.screenshot}
          onSave={handleSave}
          onDownload={handleDownload}
          onRetake={handleRetake}
          onClose={handleClose}
          isUploading={false}
        />
      </div>
    );
  }

  return null;
}

// Initialize the app function
export function initializeScreenPreviewApp() {
  const init = () => {
    const rootElement = document.getElementById("root");
    if (rootElement) {
      const root = createRoot(rootElement);
      root.render(<ScreenshotPreviewWindow />);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
