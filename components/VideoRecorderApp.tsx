// components/VideoRecorderApp.tsx - Full screen video recorder app
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import VideoRecorder from './VideoRecorder';
import { VideoResult } from '../services/videoService';

interface RecorderWindowState {
  caseId: string | null;
  options: any;
  isLoading: boolean;
  error: string | null;
}

function VideoRecorderWindow() {
  const [state, setState] = useState<RecorderWindowState>({
    caseId: null,
    options: {},
    isLoading: true,
    error: null
  });

  useEffect(() => {
    // Inject Tailwind CSS into the document
    injectTailwindCSS();

    // Hide loading indicator initially shown in HTML
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }

    // Get recording data from URL parameters or storage
    loadRecordingData();

    // Listen for messages from popup window
    const messageListener = (message: any, sender: chrome.runtime.MessageSender) => {
      if (message.type === 'RECORDING_DATA') {
        setState(prev => ({
          ...prev,
          caseId: message.data.caseId,
          options: message.data.options || {},
          isLoading: false,
          error: null
        }));
      }
      
      if (message.type === 'CLOSE_RECORDER') {
        window.close();
      }
    };

    // Add message listener
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener(messageListener);
    }

    // Handle window close events
    const handleBeforeUnload = () => {
      // Notify popup that recording window is closing
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'RECORDING_WINDOW_CLOSED'
        }).catch(() => {
          // Ignore errors if popup is closed
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
      .flex-wrap { flex-wrap: wrap !important; }
      .items-center { align-items: center !important; }
      .items-start { align-items: flex-start !important; }
      .justify-center { justify-content: center !important; }
      .justify-between { justify-content: space-between !important; }
      .space-x-2 > * + * { margin-left: 0.5rem !important; }
      .space-x-3 > * + * { margin-left: 0.75rem !important; }
      .space-y-1 > * + * { margin-top: 0.25rem !important; }
      .space-y-2 > * + * { margin-top: 0.5rem !important; }
      .space-y-3 > * + * { margin-top: 0.75rem !important; }
      .space-y-6 > * + * { margin-top: 1.5rem !important; }
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
      .bg-yellow-500 { background-color: #f59e0b !important; }
      .bg-yellow-600 { background-color: #d97706 !important; }
      .bg-black { background-color: #000 !important; }
      .bg-opacity-50 { background-color: rgba(0, 0, 0, 0.5) !important; }
      
      /* Text */
      .text-white { color: #fff !important; }
      .text-gray-400 { color: #9ca3af !important; }
      .text-gray-600 { color: #4b5563 !important; }
      .text-gray-700 { color: #374151 !important; }
      .text-gray-900 { color: #111827 !important; }
      .text-blue-600 { color: #2563eb !important; }
      .text-blue-700 { color: #1d4ed8 !important; }
      .text-blue-900 { color: #1e3a8a !important; }
      .text-red-600 { color: #dc2626 !important; }
      .text-red-700 { color: #b91c1c !important; }
      .text-red-900 { color: #7f1d1d !important; }
      .text-sm { font-size: 0.875rem !important; }
      .text-lg { font-size: 1.125rem !important; }
      .text-xl { font-size: 1.25rem !important; }
      .text-2xl { font-size: 1.5rem !important; }
      .text-center { text-align: center !important; }
      .font-medium { font-weight: 500 !important; }
      .font-semibold { font-weight: 600 !important; }
      
      /* Spacing */
      .p-2 { padding: 0.5rem !important; }
      .p-4 { padding: 1rem !important; }
      .p-6 { padding: 1.5rem !important; }
      .px-3 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
      .px-4 { padding-left: 1rem !important; padding-right: 1rem !important; }
      .py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
      .py-3 { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
      .mb-2 { margin-bottom: 0.5rem !important; }
      .mb-3 { margin-bottom: 0.75rem !important; }
      .mb-4 { margin-bottom: 1rem !important; }
      .mr-2 { margin-right: 0.5rem !important; }
      .mr-3 { margin-right: 0.75rem !important; }
      .ml-2 { margin-left: 0.5rem !important; }
      .mt-3 { margin-top: 0.75rem !important; }
      
      /* Sizing */
      .w-3 { width: 0.75rem !important; }
      .w-6 { width: 1.5rem !important; }
      .w-full { width: 100% !important; }
      .h-3 { height: 0.75rem !important; }
      .h-6 { height: 1.5rem !important; }
      .h-auto { height: auto !important; }
      .h-96 { height: 24rem !important; }
      .max-w-md { max-width: 28rem !important; }
      .max-h-96 { max-height: 24rem !important; }
      
      /* Borders */
      .border { border-width: 1px !important; }
      .border-t { border-top-width: 1px !important; }
      .border-gray-200 { border-color: #e5e7eb !important; }
      .border-gray-300 { border-color: #d1d5db !important; }
      .border-blue-200 { border-color: #bfdbfe !important; }
      .border-red-200 { border-color: #fecaca !important; }
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
      .cursor-pointer { cursor: pointer !important; }
      .cursor-not-allowed { cursor: not-allowed !important; }
      .hover\\:bg-gray-50:hover { background-color: #f9fafb !important; }
      .hover\\:bg-gray-600:hover { background-color: #4b5563 !important; }
      .hover\\:bg-blue-600:hover { background-color: #2563eb !important; }
      .hover\\:bg-blue-700:hover { background-color: #1d4ed8 !important; }
      .hover\\:bg-red-600:hover { background-color: #dc2626 !important; }
      .hover\\:bg-green-600:hover { background-color: #059669 !important; }
      .hover\\:bg-yellow-600:hover { background-color: #d97706 !important; }
      .hover\\:text-gray-600:hover { color: #4b5563 !important; }
      .focus\\:outline-none:focus { outline: none !important; }
      .focus\\:ring-2:focus { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5) !important; }
      .focus\\:ring-blue-500:focus { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5) !important; }
      .disabled\\:opacity-50:disabled { opacity: 0.5 !important; }
      .disabled\\:cursor-not-allowed:disabled { cursor: not-allowed !important; }
      
      /* Animations */
      .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite !important; }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: .5; }
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
    `;

    const styleElement = document.createElement('style');
    styleElement.textContent = css;
    document.head.appendChild(styleElement);
    
    console.log('Tailwind CSS injected into video recorder window');
  };

  const loadRecordingData = async () => {
    try {
      // Try to get data from URL parameters first
      const urlParams = new URLSearchParams(window.location.search);
      const recordingId = urlParams.get('id');
      
      if (recordingId) {
        // Get data from Chrome storage
        if (typeof chrome !== 'undefined' && chrome.storage) {
          const result = await chrome.storage.local.get([`video_recording_${recordingId}`]);
          const data = result[`video_recording_${recordingId}`];
          
          if (data) {
            setState(prev => ({
              ...prev,
              caseId: data.caseId,
              options: data.options || {},
              isLoading: false,
              error: null
            }));
            
            // Clean up storage after loading
            chrome.storage.local.remove([`video_recording_${recordingId}`]);
            return;
          }
        }
      }

      // If no data found, wait for message from popup
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

    } catch (error) {
      console.error('Failed to load recording data:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load recording data'
      }));
    }
  };

  const handleVideoCapture = (result: VideoResult) => {
    // Send video capture result back to popup
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'VIDEO_RECORDED',
        data: result
      });
    }
    
    // Close recorder window after capture
    setTimeout(() => {
      window.close();
    }, 500);
  };

  const handleClose = () => {
    window.close();
  };

  // Show loading state
  if (state.isLoading) {
    return (
      <div className="fixed inset-0 bg-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-700">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg font-medium">Setting up video recorder...</div>
          <div className="text-sm text-gray-500 mt-2">
            Please wait while we prepare the recording interface...
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (state.error) {
    return (
      <div className="fixed inset-0 bg-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-700 max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <div className="text-lg font-medium mb-2">Failed to load recorder</div>
          <div className="text-sm text-gray-500 mb-6">{state.error}</div>
          <button
            onClick={() => window.close()}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  // Show video recorder
  if (state.caseId) {
    return (
      <div className="w-full h-full bg-gray-100 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow-xl overflow-hidden">
            <VideoRecorder
              caseId={state.caseId}
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
    const rootElement = document.getElementById('root');
    if (rootElement) {
      const root = createRoot(rootElement);
      root.render(<VideoRecorderWindow />);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}