// components/VideoPreviewApp.tsx - Updated to use enhanced VideoPreview component
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import VideoPreview, { VideoData } from './VideoPreview';

interface PreviewWindowState {
  video: VideoData | null;
  isLoading: boolean;
  error: string | null;
}

function VideoPreviewWindow() {
  const [state, setState] = useState<PreviewWindowState>({
    video: null,
    isLoading: true,
    error: null
  });

  useEffect(() => {
    // Inject enhanced CSS into the document
    injectEnhancedCSS();

    // Hide loading indicator initially shown in HTML
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }

    // Get video data from URL parameters or storage
    loadVideoData();

    // Listen for messages from popup window
    const messageListener = (message: any, sender: chrome.runtime.MessageSender) => {
      if (message.type === 'VIDEO_DATA') {
        setState(prev => ({
          ...prev,
          video: message.data,
          isLoading: false,
          error: null
        }));
      }
      
      if (message.type === 'CLOSE_PREVIEW') {
        window.close();
      }
    };

    // Add message listener
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener(messageListener);
    }

    // Handle window close events
    const handleBeforeUnload = () => {
      // Notify popup that preview window is closing
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'PREVIEW_WINDOW_CLOSED'
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

  const injectEnhancedCSS = () => {
    // Enhanced CSS for the new video preview layout
    const css = `
      /* Reset and base */
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      html, body, #root {
        height: 100%;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: #f9fafb;
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
      .space-x-4 > * + * { margin-left: 1rem !important; }
      .grid { display: grid !important; }
      .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .gap-3 { gap: 0.75rem !important; }

      /* Colors */
      .bg-white { background-color: #fff !important; }
      .bg-gray-50 { background-color: #f9fafb !important; }
      .bg-gray-100 { background-color: #f3f4f6 !important; }
      .bg-gray-200 { background-color: #e5e7eb !important; }
      .bg-gray-300 { background-color: #d1d5db !important; }
      .bg-gray-600 { background-color: #4b5563 !important; }
      .bg-gray-700 { background-color: #374151 !important; }
      .bg-gray-900 { background-color: #111827 !important; }
      .bg-blue-600 { background-color: #2563eb !important; }
      .bg-blue-700 { background-color: #1d4ed8 !important; }
      .bg-green-600 { background-color: #059669 !important; }
      .bg-red-600 { background-color: #dc2626 !important; }
      .bg-black { background-color: #000 !important; }
      .bg-opacity-50 { background-color: rgba(0, 0, 0, 0.5) !important; }
      .bg-opacity-70 { background-color: rgba(0, 0, 0, 0.7) !important; }
      .bg-opacity-95 { background-color: rgba(0, 0, 0, 0.95) !important; }
      .bg-gradient-to-t { background-image: linear-gradient(to top, var(--tw-gradient-stops)) !important; }
      .from-black\\/70 { --tw-gradient-from: rgba(0, 0, 0, 0.7) !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(0, 0, 0, 0)) !important; }
      .to-transparent { --tw-gradient-to: transparent !important; }

      /* Text */
      .text-white { color: #fff !important; }
      .text-gray-300 { color: #d1d5db !important; }
      .text-gray-400 { color: #9ca3af !important; }
      .text-gray-500 { color: #6b7280 !important; }
      .text-gray-600 { color: #4b5563 !important; }
      .text-gray-700 { color: #374151 !important; }
      .text-gray-900 { color: #111827 !important; }
      .text-blue-600 { color: #2563eb !important; }
      .text-green-600 { color: #059669 !important; }
      .text-red-600 { color: #dc2626 !important; }
      .text-xs { font-size: 0.75rem !important; }
      .text-sm { font-size: 0.875rem !important; }
      .text-lg { font-size: 1.125rem !important; }
      .text-xl { font-size: 1.25rem !important; }
      .text-2xl { font-size: 1.5rem !important; }
      .font-medium { font-weight: 500 !important; }
      .font-semibold { font-weight: 600 !important; }
      .truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }

      /* Spacing */
      .p-2 { padding: 0.5rem !important; }
      .p-3 { padding: 0.75rem !important; }
      .p-4 { padding: 1rem !important; }
      .p-6 { padding: 1.5rem !important; }
      .p-8 { padding: 2rem !important; }
      .px-3 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
      .px-4 { padding-left: 1rem !important; padding-right: 1rem !important; }
      .px-6 { padding-left: 1.5rem !important; padding-right: 1.5rem !important; }
      .py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
      .py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
      .py-4 { padding-top: 1rem !important; padding-bottom: 1rem !important; }
      .mb-2 { margin-bottom: 0.5rem !important; }
      .mb-3 { margin-bottom: 0.75rem !important; }
      .mb-4 { margin-bottom: 1rem !important; }
      .ml-4 { margin-left: 1rem !important; }
      .mr-2 { margin-right: 0.5rem !important; }
      .pt-6 { padding-top: 1.5rem !important; }

      /* Sizing */
      .w-4 { width: 1rem !important; }
      .w-6 { width: 1.5rem !important; }
      .w-20 { width: 5rem !important; }
      .w-96 { width: 24rem !important; }
      .w-full { width: 100% !important; }
      .h-1 { height: 0.25rem !important; }
      .h-2 { height: 0.5rem !important; }
      .h-4 { height: 1rem !important; }
      .h-6 { height: 1.5rem !important; }
      .h-full { height: 100% !important; }
      .max-w-4xl { max-width: 56rem !important; }
      .max-w-full { max-width: 100% !important; }
      .max-h-full { max-height: 100% !important; }

      /* Borders */
      .border { border-width: 1px !important; }
      .border-t { border-top-width: 1px !important; }
      .border-b { border-bottom-width: 1px !important; }
      .border-l { border-left-width: 1px !important; }
      .border-gray-200 { border-color: #e5e7eb !important; }
      .border-gray-300 { border-color: #d1d5db !important; }
      .border-gray-600 { border-color: #4b5563 !important; }
      .rounded { border-radius: 0.25rem !important; }
      .rounded-md { border-radius: 0.375rem !important; }
      .rounded-lg { border-radius: 0.5rem !important; }
      .rounded-full { border-radius: 9999px !important; }

      /* Position */
      .absolute { position: absolute !important; }
      .relative { position: relative !important; }
      .top-4 { top: 1rem !important; }
      .right-4 { right: 1rem !important; }
      .bottom-0 { bottom: 0px !important; }
      .bottom-4 { bottom: 1rem !important; }
      .left-0 { left: 0px !important; }
      .left-4 { left: 1rem !important; }

      /* Z-index */
      .z-50 { z-index: 50 !important; }
      .z-\\[60\\] { z-index: 60 !important; }

      /* Effects */
      .opacity-0 { opacity: 0 !important; }
      .opacity-75 { opacity: 0.75 !important; }
      .hover\\:opacity-100:hover { opacity: 1 !important; }
      .transition-colors { transition-property: color, background-color, border-color !important; transition-duration: 0.15s !important; }
      .transition-opacity { transition-property: opacity !important; transition-duration: 0.15s !important; }
      .transition-all { transition-property: all !important; transition-duration: 0.3s !important; }

      /* Interactions */
      .cursor-pointer { cursor: pointer !important; }
      .cursor-not-allowed { cursor: not-allowed !important; }
      .hover\\:bg-gray-50:hover { background-color: #f9fafb !important; }
      .hover\\:bg-gray-600:hover { background-color: #4b5563 !important; }
      .hover\\:bg-blue-700:hover { background-color: #1d4ed8 !important; }
      .hover\\:bg-opacity-70:hover { background-color: rgba(0, 0, 0, 0.7) !important; }
      .hover\\:text-gray-300:hover { color: #d1d5db !important; }
      .hover\\:text-gray-600:hover { color: #4b5563 !important; }
      .focus\\:outline-none:focus { outline: none !important; }
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

      /* Form elements */
      input, textarea, select {
        font-family: inherit !important;
        font-size: 0.875rem !important;
      }
      
      input[type="text"], input[type="url"], textarea {
        border: 1px solid #d1d5db !important;
        border-radius: 0.375rem !important;
        padding: 0.5rem 0.75rem !important;
        transition: border-color 0.15s, box-shadow 0.15s !important;
      }
      
      input[type="text"]:focus, input[type="url"]:focus, textarea:focus {
        outline: none !important;
        border-color: #3b82f6 !important;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5) !important;
      }

      input[type="range"] {
        -webkit-appearance: none !important;
        appearance: none !important;
        border: none !important;
        padding: 0 !important;
      }

      .slider {
        -webkit-appearance: none !important;
        appearance: none !important;
        height: 8px !important;
        background: #4b5563 !important;
        outline: none !important;
        border-radius: 4px !important;
      }

      .slider::-webkit-slider-thumb {
        -webkit-appearance: none !important;
        appearance: none !important;
        width: 20px !important;
        height: 20px !important;
        background: #3b82f6 !important;
        border-radius: 50% !important;
        cursor: pointer !important;
      }

      .slider::-moz-range-thumb {
        width: 20px !important;
        height: 20px !important;
        background: #3b82f6 !important;
        border-radius: 50% !important;
        cursor: pointer !important;
        border: none !important;
      }

      /* Button styles */
      button {
        font-family: inherit !important;
        font-weight: 500 !important;
        transition: all 0.2s !important;
        cursor: pointer !important;
      }

      button:disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }

      /* Video styles */
      video {
        background: #000 !important;
      }

      .object-contain { object-fit: contain !important; }

      /* Loading styles */
      .loading-container {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: #f3f4f6;
        color: #374151;
        text-align: center;
      }

      .spinner {
        width: 48px;
        height: 48px;
        border: 4px solid #d1d5db;
        border-top: 4px solid #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.textContent = css;
    document.head.appendChild(styleElement);
    
    console.log('Enhanced CSS injected into video preview window');
  };

  const loadVideoData = async () => {
    try {
      // Try to get data from URL parameters first
      const urlParams = new URLSearchParams(window.location.search);
      const videoId = urlParams.get('id');
      
      if (videoId) {
        // Get data from Chrome storage
        if (typeof chrome !== 'undefined' && chrome.storage) {
          const result = await chrome.storage.local.get([`video_preview_${videoId}`]);
          const data = result[`video_preview_${videoId}`];
          
          if (data) {
            setState(prev => ({
              ...prev,
              video: data,
              isLoading: false,
              error: null
            }));
            
            // Clean up storage after loading
            chrome.storage.local.remove([`video_preview_${videoId}`]);
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
      console.error('Failed to load video data:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load video'
      }));
    }
  };

  const handleSave = async () => {
    // Send save request back to popup/background
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'SAVE_VIDEO',
        data: state.video
      });
    }
    
    // Close window after save
    setTimeout(() => {
      window.close();
    }, 1000);
  };

  const handleDownload = () => {
    if (state.video) {
      const url = URL.createObjectURL(state.video.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = state.video.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleRetake = () => {
    // Send retake request back to popup
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'RETAKE_VIDEO'
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
      <div className="loading-container">
        <div>
          <div className="spinner"></div>
          <div className="text-lg font-medium">Loading video preview...</div>
          <div className="text-sm text-gray-500 mt-2">
            Please wait while we prepare your video...
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (state.error) {
    return (
      <div className="loading-container">
        <div className="max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <div className="text-lg font-medium mb-2">Failed to load video</div>
          <div className="text-sm text-gray-500 mb-6">{state.error}</div>
          <button
            onClick={() => window.close()}
            className="px-6 py-2 bg-blue-600 border-blue-600  text-white rounded hover:bg-blue-700 transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  // Show video preview with enhanced interface
  if (state.video) {
    return (
      <VideoPreview
        video={state.video}
        onSave={handleSave}
        onDownload={handleDownload}
        onRetake={handleRetake}
        onClose={handleClose}
        isUploading={false}
      />
    );
  }

  return null;
}

// Initialize the app function
export function initializeVideoPreviewApp() {
  const init = () => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      const root = createRoot(rootElement);
      root.render(<VideoPreviewWindow />);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}