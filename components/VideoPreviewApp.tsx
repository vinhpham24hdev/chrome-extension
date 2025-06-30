// components/VideoPreviewApp.tsx - Full screen video preview app
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
    // Inject Tailwind CSS into the document
    injectTailwindCSS();

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

  const injectTailwindCSS = () => {
    // Create and inject Tailwind CSS (same as VideoRecorderApp but with additional video-specific styles)
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
      .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
      .gap-3 { gap: 0.75rem !important; }
      .gap-6 { gap: 1.5rem !important; }
      .group { }
      .group:hover .group-hover\\:opacity-100 { opacity: 1 !important; }
      
      /* Colors */
      .bg-white { background-color: #fff !important; }
      .bg-gray-50 { background-color: #f9fafb !important; }
      .bg-gray-100 { background-color: #f3f4f6 !important; }
      .bg-gray-200 { background-color: #e5e7eb !important; }
      .bg-gray-300 { background-color: #d1d5db !important; }
      .bg-gray-600 { background-color: #4b5563 !important; }
      .bg-gray-700 { background-color: #374151 !important; }
      .bg-blue-600 { background-color: #2563eb !important; }
      .bg-blue-700 { background-color: #1d4ed8 !important; }
      .bg-green-600 { background-color: #059669 !important; }
      .bg-red-600 { background-color: #dc2626 !important; }
      .bg-black { background-color: #000 !important; }
      .bg-opacity-50 { background-color: rgba(0, 0, 0, 0.5) !important; }
      .bg-opacity-70 { background-color: rgba(0, 0, 0, 0.7) !important; }
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
      .text-blue-800 { color: #1e40af !important; }
      .text-green-600 { color: #059669 !important; }
      .text-red-600 { color: #dc2626 !important; }
      .text-xs { font-size: 0.75rem !important; }
      .text-sm { font-size: 0.875rem !important; }
      .text-lg { font-size: 1.125rem !important; }
      .text-6xl { font-size: 3.75rem !important; }
      .text-center { text-align: center !important; }
      .font-medium { font-weight: 500 !important; }
      .font-semibold { font-weight: 600 !important; }
      
      /* Spacing */
      .p-3 { padding: 0.75rem !important; }
      .p-4 { padding: 1rem !important; }
      .px-3 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
      .px-4 { padding-left: 1rem !important; padding-right: 1rem !important; }
      .px-6 { padding-left: 1.5rem !important; padding-right: 1.5rem !important; }
      .py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
      .py-3 { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
      .mb-2 { margin-bottom: 0.5rem !important; }
      .mb-3 { margin-bottom: 0.75rem !important; }
      .mb-4 { margin-bottom: 1rem !important; }
      .mb-6 { margin-bottom: 1.5rem !important; }
      .mr-2 { margin-right: 0.5rem !important; }
      .ml-2 { margin-left: 0.5rem !important; }
      
      /* Sizing */
      .w-4 { width: 1rem !important; }
      .w-6 { width: 1.5rem !important; }
      .w-12 { width: 3rem !important; }
      .w-16 { width: 4rem !important; }
      .w-full { width: 100% !important; }
      .h-1 { height: 0.25rem !important; }
      .h-2 { height: 0.5rem !important; }
      .h-4 { height: 1rem !important; }
      .h-6 { height: 1.5rem !important; }
      .h-12 { height: 3rem !important; }
      .h-auto { height: auto !important; }
      .h-full { height: 100% !important; }
      .max-w-5xl { max-width: 64rem !important; }
      .max-w-md { max-width: 28rem !important; }
      .max-h-96 { max-height: 24rem !important; }
      .max-h-\\[90vh\\] { max-height: 90vh !important; }
      .max-w-full { max-width: 100% !important; }
      .max-h-full { max-height: 100% !important; }
      
      /* Borders */
      .border { border-width: 1px !important; }
      .border-t { border-top-width: 1px !important; }
      .border-b { border-bottom-width: 1px !important; }
      .border-gray-200 { border-color: #e5e7eb !important; }
      .border-gray-300 { border-color: #d1d5db !important; }
      .border-gray-600 { border-color: #4b5563 !important; }
      .border-transparent { border-color: transparent !important; }
      .rounded { border-radius: 0.25rem !important; }
      .rounded-lg { border-radius: 0.5rem !important; }
      .rounded-md { border-radius: 0.375rem !important; }
      .rounded-full { border-radius: 9999px !important; }
      
      /* Effects */
      .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important; }
      .overflow-auto { overflow: auto !important; }
      .overflow-y-auto { overflow-y: auto !important; }
      .overflow-hidden { overflow: hidden !important; }
      .opacity-0 { opacity: 0 !important; }
      .opacity-75 { opacity: 0.75 !important; }
      .group-hover\\:opacity-100:hover { opacity: 1 !important; }
      
      /* Interactions */
      .transition-colors { transition-property: color, background-color, border-color !important; transition-duration: 0.15s !important; }
      .transition-opacity { transition-property: opacity !important; transition-duration: 0.15s !important; }
      .transition-all { transition-property: all !important; transition-duration: 0.3s !important; }
      .cursor-pointer { cursor: pointer !important; }
      .cursor-not-allowed { cursor: not-allowed !important; }
      .hover\\:bg-gray-50:hover { background-color: #f9fafb !important; }
      .hover\\:bg-gray-700:hover { background-color: #374151 !important; }
      .hover\\:bg-blue-700:hover { background-color: #1d4ed8 !important; }
      .hover\\:bg-opacity-70:hover { background-color: rgba(0, 0, 0, 0.7) !important; }
      .hover\\:text-gray-300:hover { color: #d1d5db !important; }
      .hover\\:text-gray-600:hover { color: #4b5563 !important; }
      .hover\\:text-blue-800:hover { color: #1e40af !important; }
      .focus\\:outline-none:focus { outline: none !important; }
      .disabled\\:opacity-50:disabled { opacity: 0.5 !important; }
      .disabled\\:cursor-not-allowed:disabled { cursor: not-allowed !important; }
      
      /* Animations */
      .animate-spin { animation: spin 1s linear infinite !important; }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
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
      
      /* Video controls */
      .appearance-none { appearance: none !important; }
      .slider { -webkit-appearance: none !important; appearance: none !important; height: 4px !important; background: #4b5563 !important; outline: none !important; border-radius: 4px !important; }
      .slider::-webkit-slider-thumb { -webkit-appearance: none !important; appearance: none !important; width: 16px !important; height: 16px !important; background: #3b82f6 !important; border-radius: 50% !important; cursor: pointer !important; }
      .slider::-moz-range-thumb { width: 16px !important; height: 16px !important; background: #3b82f6 !important; border-radius: 50% !important; cursor: pointer !important; border: none !important; }
      
      /* Form elements */
      input, textarea, select {
        border: 1px solid #d1d5db !important;
        border-radius: 0.375rem !important;
        padding: 0.5rem 0.75rem !important;
        font-size: 0.875rem !important;
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
      
      input[type="range"] {
        padding: 0 !important;
        background: transparent !important;
        border: none !important;
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
      
      /* Object fit */
      .object-contain { object-fit: contain !important; }
      
      /* Underline */
      .underline { text-decoration: underline !important; }
    `;

    const styleElement = document.createElement('style');
    styleElement.textContent = css;
    document.head.appendChild(styleElement);
    
    console.log('Tailwind CSS injected into video preview window');
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
      <div className="fixed inset-0 bg-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-700">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
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
      <div className="fixed inset-0 bg-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-700 max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <div className="text-lg font-medium mb-2">Failed to load video</div>
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

  // Show video preview
  if (state.video) {
    return (
      <div className="w-full h-full bg-gray-100 overflow-auto">
        <div className="p-4">
          <VideoPreview
            video={state.video}
            onSave={handleSave}
            onDownload={handleDownload}
            onRetake={handleRetake}
            onClose={handleClose}
            isUploading={false}
          />
        </div>
      </div>
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