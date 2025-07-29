// components/VideoRecorderApp.tsx - Enhanced video recorder for new tab experience like Loom
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import VideoRecorder from './VideoRecorder';
import { VideoResult } from '../services/videoService';
import { ToastContainer } from './ToastContainer';

interface RecorderWindowState {
  caseId: string | null;
  options: any;
  autoStart: boolean;
  isLoading: boolean;
  error: string | null;
}

function VideoRecorderWindow() {
  const [state, setState] = useState<RecorderWindowState>({
    caseId: null,
    options: {},
    autoStart: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    // Enhanced CSS injection for better tab experience
    injectEnhancedCSS();

    // Hide loading indicator initially shown in HTML
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }

    // Get recording data from URL parameters or storage
    loadRecordingData();

    // Listen for messages from popup window
    const messageListener = (
      message: any,
      sender: chrome.runtime.MessageSender
    ) => {
      console.log('🎬 Recorder received message:', message);

      if (message.type === 'RECORDING_DATA') {
        console.log('📝 Received recording data:', message.data);
        setState((prev) => ({
          ...prev,
          caseId: message.data.caseId,
          options: message.data.options || {},
          autoStart: message.data.autoStart || false,
          isLoading: false,
          error: null,
        }));
      }

      if (message.type === 'CLOSE_RECORDER') {
        console.log('🔐 Received close recorder command');
        window.close();
      }
    };

    // Add message listener
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener(messageListener);
    }

    // Handle window close events - notify popup
    const handleBeforeUnload = () => {
      console.log('📄 Recorder window closing, notifying popup...');
      // Notify popup that recording window is closing
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime
          .sendMessage({
            type: 'RECORDING_WINDOW_CLOSED',
            timestamp: Date.now(),
          })
          .catch(() => {
            // Ignore errors if popup is closed
            console.log('⚠️ Could not notify popup (popup may be closed)');
          });
      }
    };

    // Handle tab close/navigation
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab is being hidden/closed
        handleBeforeUnload();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Add page title and favicon for better tab experience
    document.title = '🎬 Video Recorder - Cellebrite';

    // Add favicon if available
    const favicon = document.querySelector(
      "link[rel*='icon']"
    ) as HTMLLinkElement;
    if (favicon) {
      favicon.href = chrome.runtime.getURL('assets/react.svg');
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const injectEnhancedCSS = () => {
    // Enhanced CSS for better tab experience
    const css = `
      /* Enhanced base styles for full tab experience */
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      html, body, #root {
        height: 100vh;
        width: 100vw;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        overflow: hidden;
      }

      /* Full-screen container for Loom-like experience */
      .recorder-container {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      /* Header bar for tab mode */
      .recorder-header {
        background: #ffff;
        backdrop-filter: blur(10px);
        padding: 1rem 2rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
      }

      .recorder-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: #1f2937;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .recorder-close {
        background: #ef4444;
        color: white;
        border: none;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 1.1rem;
      }

      .recorder-close:hover {
        background: #dc2626;
        transform: scale(1.05);
      }

      /* Main content area */
      .recorder-main {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
      }

      .recorder-card {
        background: #ffff;
        backdrop-filter: blur(20px);
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        width: 100%;
        max-width: 900px;
        min-height: 500px;
        border: 1px solid rgba(255, 255, 255, 0.3);
        overflow: hidden;
      }

      /* Layout utilities */
      .fixed { position: fixed !important; }
      .inset-0 { top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }
      .flex { display: flex !important; }
      .flex-1 { flex: 1 1 0% !important; }
      .flex-col { flex-direction: column !important; }
      .items-center { align-items: center !important; }
      .justify-center { justify-content: center !important; }
      .justify-between { justify-content: space-between !important; }
      .space-y-2 > * + * { margin-top: 0.5rem !important; }
      .space-y-3 > * + * { margin-top: 0.75rem !important; }
      .space-y-4 > * + * { margin-top: 1rem !important; }
      .space-y-6 > * + * { margin-top: 1.5rem !important; }
      .space-x-2 > * + * { margin-left: 0.5rem !important; }
      .space-x-3 > * + * { margin-left: 0.75rem !important; }
      .space-x-4 > * + * { margin-left: 1rem !important; }
      .grid { display: grid !important; }
      .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
      .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .gap-3 { gap: 0.75rem !important; }
      .gap-4 { gap: 1rem !important; }
      
      /* Colors */
      .bg-white { background-color: #fff !important; }
      .bg-gray-50 { background-color: #f9fafb !important; }
      .bg-gray-100 { background-color: #f3f4f6 !important; }
      .bg-gray-600 { background-color: #4b5563 !important; }
      .bg-gray-700 { background-color: #374151 !important; }
      .bg-gray-800 { background-color: #1f2937 !important; }
      .bg-gray-900 { background-color: #111827 !important; }
      .bg-blue-50 { background-color: #eff6ff !important; }
      .bg-blue-200 { background-color: #bfdbfe !important; }
      .bg-blue-500 { background-color: #3b82f6 !important; }
      .bg-blue-600 { background-color: #2563eb !important; }
      .bg-blue-700 { background-color: #1d4ed8 !important; }
      .bg-blue-900 { background-color: #1e3a8a !important; }
      .bg-red-50 { background-color: #fef2f2 !important; }
      .bg-red-200 { background-color: #fecaca !important; }
      .bg-red-500 { background-color: #ef4444 !important; }
      .bg-red-600 { background-color: #dc2626 !important; }
      .bg-green-500 { background-color: #10b981 !important; }
      .bg-green-600 { background-color: #059669 !important; }
      .bg-green-700 { background-color: #047857 !important; }
      .bg-yellow-500 { background-color: #f59e0b !important; }
      .bg-yellow-600 { background-color: #d97706 !important; }
      .bg-yellow-700 { background-color: #b45309 !important; }
      .bg-black { background-color: #000 !important; }
      .bg-opacity-50 { background-color: rgba(0, 0, 0, 0.5) !important; }
      
      /* Text */
      .text-white { color: #fff !important; }
      .text-gray-400 { color: #9ca3af !important; }
      .text-gray-500 { color: #6b7280 !important; }
      .text-gray-600 { color: #4b5563 !important; }
      .text-gray-700 { color: #374151 !important; }
      .text-gray-900 { color: #111827 !important; }
      .text-blue-600 { color: #2563eb !important; }
      .text-blue-700 { color: #1d4ed8 !important; }
      .text-blue-900 { color: #1e3a8a !important; }
      .text-red-600 { color: #dc2626 !important; }
      .text-red-700 { color: #b91c1c !important; }
      .text-red-900 { color: #7f1d1d !important; }
      .text-green-600 { color: #059669 !important; }
      .text-green-700 { color: #047857 !important; }
      .text-sm { font-size: 0.875rem !important; }
      .text-lg { font-size: 1.125rem !important; }
      .text-xl { font-size: 1.25rem !important; }
      .text-2xl { font-size: 1.5rem !important; }
      .text-center { text-align: center !important; }
      .font-medium { font-weight: 500 !important; }
      .font-semibold { font-weight: 600 !important; }
      .font-bold { font-weight: 700 !important; }
      
      /* Spacing */
      .p-2 { padding: 0.5rem !important; }
      .p-3 { padding: 0.75rem !important; }
      .p-4 { padding: 1rem !important; }
      .p-6 { padding: 1.5rem !important; }
      .px-3 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
      .px-4 { padding-left: 1rem !important; padding-right: 1rem !important; }
      .px-6 { padding-left: 1.5rem !important; padding-right: 1.5rem !important; }
      .py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
      .py-3 { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
      .py-4 { padding-top: 1rem !important; padding-bottom: 1rem !important; }
      .mb-2 { margin-bottom: 0.5rem !important; }
      .mb-3 { margin-bottom: 0.75rem !important; }
      .mb-4 { margin-bottom: 1rem !important; }
      .mr-2 { margin-right: 0.5rem !important; }
      .mr-3 { margin-right: 0.75rem !important; }
      .ml-2 { margin-left: 0.5rem !important; }
      .mt-3 { margin-top: 0.75rem !important; }
      .mx-auto { margin-left: auto !important; margin-right: auto !important; }
      /* Sizing */
      .w-3 { width: 0.75rem !important; }
      .w-6 { width: 1.5rem !important; }
      .w-8 { width: 2rem !important; }
      .w-12 { width: 3rem !important; }
      .w-full { width: 100% !important; }
      .h-3 { height: 0.75rem !important; }
      .h-6 { height: 1.5rem !important; }
      .h-8 { height: 2rem !important; }
      .h-12 { height: 3rem !important; }
      .h-auto { height: auto !important; }
      .h-96 { height: 24rem !important; }
      .max-w-md { max-width: 28rem !important; }
      .max-w-4xl { max-width: 56rem !important; }
      .max-h-96 { max-height: 24rem !important; }
      
      /* Borders */
      .border { border-width: 1px !important; }
      .border-t { border-top-width: 1px !important; }
      .border-2 { border-width: 2px !important; }
      .border-gray-200 { border-color: #e5e7eb !important; }
      .border-gray-300 { border-color: #d1d5db !important; }
      .border-gray-500 { border-color: #6b7280 !important; }
      .border-blue-200 { border-color: #bfdbfe !important; }
      .border-red-200 { border-color: #fecaca !important; }
      .border-red-500 { border-color: #ef4444 !important; }
      .border-green-500 { border-color: #10b981 !important; }
      .border-yellow-500 { border-color: #f59e0b !important; }
      .rounded { border-radius: 0.25rem !important; }
      .rounded-lg { border-radius: 0.5rem !important; }
      .rounded-md { border-radius: 0.375rem !important; }
      .rounded-full { border-radius: 9999px !important; }
      
      /* Effects */
      .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important; }
      .overflow-auto { overflow: auto !important; }
      .overflow-hidden { overflow: hidden !important; }
      
      /* Interactions */
      .transition-colors { transition-property: color, background-color, border-color !important; transition-duration: 0.15s !important; }
      .transition-all { transition-property: all !important; transition-duration: 0.15s !important; }
      .cursor-pointer { cursor: pointer !important; }
      .cursor-not-allowed { cursor: not-allowed !important; }
      .hover\\:bg-gray-50:hover { background-color: #f9fafb !important; }
      .hover\\:bg-gray-700:hover { background-color: #374151 !important; }
      .hover\\:bg-blue-600:hover { background-color: #2563eb !important; }
      .hover\\:bg-blue-700:hover { background-color: #1d4ed8 !important; }
      .hover\\:bg-red-600:hover { background-color: #dc2626 !important; }
      .hover\\:bg-red-700:hover { background-color: #b91c1c !important; }
      .hover\\:bg-green-600:hover { background-color: #059669 !important; }
      .hover\\:bg-green-700:hover { background-color: #047857 !important; }
      .hover\\:bg-yellow-600:hover { background-color: #d97706 !important; }
      .hover\\:bg-yellow-700:hover { background-color: #b45309 !important; }
      .hover\\:text-gray-600:hover { color: #4b5563 !important; }
      .focus\\:outline-none:focus { outline: none !important; }
      .focus\\:ring-2:focus { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5) !important; }
      .focus\\:ring-blue-500:focus { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5) !important; }
      .disabled\\:opacity-50:disabled { opacity: 0.5 !important; }
      .disabled\\:cursor-not-allowed:disabled { cursor: not-allowed !important; }
      
      /* Animations */
      .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite !important; }
      .animate-spin { animation: spin 1s linear infinite !important; }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: .5; }
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      /* Z-index */
      .z-50 { z-index: 50 !important; }
      
      /* Form elements */
      input, textarea, select {
        border: 1px solid #d1d5db !important;
        border-radius: 0.375rem !important;
        padding: 0.5rem 0.75rem !important;
        font-size: 0.875rem !important;
        width: 100% !important;
        transition: border-color 0.15s, box-shadow 0.15s !important;
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
      
      input[type="checkbox"] {
        width: auto !important;
        margin-right: 0.5rem !important;
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
      
      /* Video styles */
      video {
        background: #000 !important;
        border-radius: 0.5rem !important;
      }

      /* Loading states */
      .loading-container {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        text-align: center;
      }

      .loading-card {
        background: #ffff;
        backdrop-filter: blur(20px);
        padding: 3rem;
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: #1f2937;
      }

      .spinner {
        width: 48px;
        height: 48px;
        border: 4px solid rgba(59, 130, 246, 0.2);
        border-top: 4px solid #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }

      /* Error states */
      .error-container {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .error-card {
        background: #ffff;
        backdrop-filter: blur(20px);
        padding: 3rem;
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.3);
        text-align: center;
        max-width: 500px;
        width: 90%;
      }
      
      .relative {
        position: relative !important;
      }

      .absolute {
        position: absolute !important;
      }

      .top-0 {
        top: 0 !important;
      }

      .right-4 {
        right: 1rem !important;
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.textContent = css;
    document.head.appendChild(styleElement);

    console.log('✨ Enhanced CSS injected into video recorder tab');
  };

  const loadRecordingData = async () => {
    try {
      // Try to get data from URL parameters first
      const urlParams = new URLSearchParams(window.location.search);
      const recordingId = urlParams.get('id');

      console.log('🔍 Loading recording data for ID:', recordingId);

      if (recordingId) {
        // Get data from Chrome storage
        if (typeof chrome !== 'undefined' && chrome.storage) {
          const result = await chrome.storage.local.get([
            `video_recording_${recordingId}`,
          ]);
          const data = result[`video_recording_${recordingId}`];

          if (data) {
            console.log('✅ Recording data loaded from storage:', data);
            setState((prev) => ({
              ...prev,
              caseId: data.caseId,
              options: data.options || {},
              autoStart: data.autoStart || false,
              isLoading: false,
              error: null,
            }));

            // Clean up storage after loading
            chrome.storage.local.remove([`video_recording_${recordingId}`]);
            return;
          }
        }
      }

      // If no data found, wait for message from popup
      console.log('⏳ No stored data found, waiting for popup message...');
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));
    } catch (error) {
      console.error('❌ Failed to load recording data:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load recording data',
      }));
    }
  };

  const handleVideoCapture = (result: VideoResult) => {
    console.log('🎬 Video capture completed:', result);

    // Send video capture result back to popup
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime
        .sendMessage({
          type: 'VIDEO_RECORDED',
          data: result,
          timestamp: Date.now(),
        })
        .then(() => {
          console.log('📤 Video result sent to popup successfully');
        })
        .catch((error) => {
          console.error('❌ Failed to send video result to popup:', error);
        });
    }

    // Close recorder tab after a short delay
    setTimeout(() => {
      console.log('📄 Closing recorder tab...');
      window.close();
    }, 1000);
  };

  const handleClose = () => {
    console.log('🔐 Closing recorder tab (user action)...');

    // Notify popup about cancellation
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime
        .sendMessage({
          type: 'RECORDING_CANCELLED',
          timestamp: Date.now(),
        })
        .catch(() => {
          console.log('⚠️ Could not notify popup about cancellation');
        });
    }

    window.close();
  };

  // Show loading state
  if (state.isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-card">
          <div className="spinner"></div>
          <div className="text-xl font-semibold mb-2">
            🎬 Setting up video recorder...
          </div>
          <div className="text-gray-600">
            Please wait while we prepare the recording interface for you...
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (state.error) {
    return (
      <div className="error-container">
        <div className="error-card">
          <div className="text-6xl mb-4">⚠️</div>
          <div className="text-xl font-semibold text-red-900 mb-2">
            Failed to load recorder
          </div>
          <div className="text-red-700 mb-6">{state.error}</div>
          <div className="space-x-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 border-blue-600  text-white rounded hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show video recorder with enhanced tab experience
  if (state.caseId) {
    return (
      <div className="recorder-container">
        {/* Header for tab mode */}
        <div className="recorder-header">
          <div className="recorder-title">
            🎬 Video Recorder
            <span className="text-gray-500 text-sm font-normal">
              Case: {state.caseId}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="recorder-close"
            title="Close recorder"
          >
            ✕
          </button>
        </div>

        {/* Main recorder area */}
        <div className="recorder-main">
          <div className="recorder-card p-6">
            <VideoRecorder
              caseId={state.caseId}
              autoStart={state.autoStart}
              defaultOptions={state.options}
              onVideoCapture={handleVideoCapture}
              onClose={handleClose}
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Initialize the app function
export function initializeRecorderApp() {
  const init = () => {
    console.log('🎬 Initializing video recorder app...');
    const rootElement = document.getElementById('root');
    if (rootElement) {
      const root = createRoot(rootElement);
      root.render(
        <>
          <ToastContainer />
          <VideoRecorderWindow />
        </>
      );
      console.log('✅ Video recorder app initialized successfully');
    } else {
      console.error('❌ Root element not found');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
