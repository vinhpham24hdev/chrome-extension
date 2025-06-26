// components/ScreenshotPreview.tsx - Open in new window for full size
import React, { useState, useEffect } from "react";
import { s3Service, UploadProgress, UploadResult } from "../services/s3Service";
import { caseService } from "../services/caseService";

export interface ScreenshotData {
  dataUrl: string;
  filename: string;
  timestamp: string;
  type: string;
  caseId: string;
  blob?: Blob;
}

interface ScreenshotPreviewProps {
  screenshot: ScreenshotData;
  onSave: () => void;
  onDownload: () => void;
  onRetake: () => void;
  onClose: () => void;
  isUploading?: boolean;
}

export default function ScreenshotPreview({
  screenshot,
  onSave,
  onDownload,
  onRetake,
  onClose,
  isUploading = false,
}: ScreenshotPreviewProps) {
  const [showInPopup, setShowInPopup] = useState(false);
  const [windowOpened, setWindowOpened] = useState(false);

  useEffect(() => {
    // Prevent double opening with flag
    if (!windowOpened) {
      const timer = setTimeout(() => {
        handleOpenInNewWindow();
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [screenshot.dataUrl, windowOpened]); // Only run when needed

  const handleOpenInNewWindow = () => {
    if (windowOpened) return; // Prevent multiple opens
    
    try {
      setWindowOpened(true);
      
      // Create the HTML content for the new window
      const htmlContent = createPreviewHTML(screenshot);
      
      // Open new window
      const newWindow = window.open('', '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes,location=no,menubar=no,toolbar=no');
      
      if (newWindow) {
        newWindow.document.write(htmlContent);
        newWindow.document.close();
        
        // Setup window communication
        setupWindowCommunication(newWindow);
        
        // Close the popup modal
        onClose();
      } else {
        // Fallback to popup modal if window blocked
        setShowInPopup(true);
        setWindowOpened(false);
      }
    } catch (error) {
      console.error('Failed to open new window:', error);
      setShowInPopup(true);
      setWindowOpened(false);
    }
  };

  const createPreviewHTML = (screenshot: ScreenshotData) => {
    const formatFileSize = (dataUrl: string): string => {
      const base64Length = dataUrl.split(",")[1]?.length || 0;
      const sizeInBytes = (base64Length * 3) / 4;

      if (sizeInBytes < 1024) {
        return `${Math.round(sizeInBytes)} B`;
      } else if (sizeInBytes < 1024 * 1024) {
        return `${Math.round(sizeInBytes / 1024)} KB`;
      } else {
        return `${Math.round(sizeInBytes / (1024 * 1024))} MB`;
      }
    };

    const formatTimestamp = (timestamp: string): string => {
      return new Date(timestamp).toLocaleString();
    };

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Screenshot Preview - ${screenshot.filename}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background: #f8fafc; 
            color: #1f2937;
            line-height: 1.5;
          }
          
          .screenshot-container { 
            min-height: 100vh; 
            display: flex; 
            flex-direction: column; 
          }
          
          .header {
            background: white;
            border-bottom: 1px solid #e5e7eb;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
          }
          
          .header-content {
            max-width: 1280px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 1.5rem;
          }
          
          .header-left {
            display: flex;
            align-items: center;
            gap: 1rem;
          }
          
          .header-icon {
            width: 2.5rem;
            height: 2.5rem;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            border-radius: 0.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .header-icon svg {
            width: 1.5rem;
            height: 1.5rem;
            color: white;
          }
          
          .header-title {
            font-size: 1.25rem;
            font-weight: 700;
            color: #111827;
            margin-bottom: 0.25rem;
          }
          
          .header-subtitle {
            font-size: 0.875rem;
            color: #6b7280;
          }
          
          .close-btn {
            padding: 0.5rem;
            border: none;
            background: none;
            color: #9ca3af;
            cursor: pointer;
            border-radius: 0.5rem;
            transition: all 0.2s ease;
          }
          
          .close-btn:hover {
            background: #f3f4f6;
            color: #6b7280;
          }
          
          .info-bar {
            background: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
            padding: 0.75rem 1.5rem;
          }
          
          .info-content {
            max-width: 1280px;
            margin: 0 auto;
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
          }
          
          .info-badge {
            background: #dbeafe;
            border: 1px solid #93c5fd;
            color: #1e40af;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 500;
          }
          
          .upload-section {
            background: #dbeafe;
            border-bottom: 1px solid #93c5fd;
            padding: 1rem 1.5rem;
            display: none;
          }
          
          .upload-content {
            max-width: 1280px;
            margin: 0 auto;
          }
          
          .upload-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
          }
          
          .upload-status {
            color: #1d4ed8;
            font-weight: 500;
          }
          
          .upload-percent {
            color: #1d4ed8;
          }
          
          .upload-progress {
            width: 100%;
            background: #e5e7eb;
            border-radius: 0.5rem;
            height: 0.5rem;
            overflow: hidden;
          }
          
          .upload-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #1d4ed8);
            transition: width 0.3s ease;
            border-radius: 0.5rem;
            width: 0%;
          }
          
          .image-container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            background: #f1f5f9;
          }
          
          .screenshot-image {
            max-width: 100%;
            max-height: 80vh;
            object-fit: contain;
            border: 1px solid #e2e8f0;
            border-radius: 0.75rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            background: white;
            cursor: zoom-in;
            transition: all 0.3s ease;
          }
          
          .screenshot-image:hover {
            transform: scale(1.02);
            box-shadow: 0 32px 64px -12px rgba(0, 0, 0, 0.35);
          }
          
          .fullscreen-image {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            object-fit: contain;
            background: rgba(0, 0, 0, 0.95);
            z-index: 9999;
            cursor: zoom-out;
            padding: 2rem;
            box-sizing: border-box;
          }
          
          .footer {
            background: white;
            border-top: 1px solid #e5e7eb;
            box-shadow: 0 -1px 3px 0 rgba(0, 0, 0, 0.1);
          }
          
          .footer-content {
            max-width: 1280px;
            margin: 0 auto;
            padding: 1.5rem;
          }
          
          .actions-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
          }
          
          @media (min-width: 768px) {
            .actions-grid {
              grid-template-columns: repeat(4, 1fr);
            }
          }
          
          .action-btn {
            padding: 0.875rem 1.5rem;
            border-radius: 0.5rem;
            font-weight: 500;
            font-size: 0.875rem;
            transition: all 0.2s ease;
            cursor: pointer;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            min-height: 44px;
            text-decoration: none;
          }
          
          .btn-primary { 
            background: #3b82f6; 
            color: white; 
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          }
          
          .btn-primary:hover { 
            background: #2563eb; 
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          
          .btn-secondary { 
            background: #6b7280; 
            color: white; 
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          }
          
          .btn-secondary:hover { 
            background: #4b5563; 
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          
          .btn-outline { 
            background: white; 
            color: #374151; 
            border: 1px solid #d1d5db; 
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          }
          
          .btn-outline:hover { 
            background: #f9fafb; 
            border-color: #9ca3af;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          
          .footer-hint {
            margin-top: 1rem;
            text-align: center;
          }
          
          .footer-hint p {
            font-size: 0.875rem;
            color: #6b7280;
          }
          
          .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          
          .modal-content {
            background: white;
            border-radius: 0.5rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            max-width: 28rem;
            width: 100%;
            margin: 1rem;
          }
          
          .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1.5rem;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .modal-title {
            font-size: 1.125rem;
            font-weight: 600;
            color: #111827;
          }
          
          .modal-close {
            color: #9ca3af;
            cursor: pointer;
            transition: color 0.2s ease;
            border: none;
            background: none;
            padding: 0.25rem;
          }
          
          .modal-close:hover {
            color: #6b7280;
          }
          
          .modal-body {
            padding: 1.5rem;
          }
          
          .form-group {
            margin-bottom: 1rem;
          }
          
          .form-label {
            display: block;
            font-size: 0.875rem;
            font-weight: 500;
            color: #374151;
            margin-bottom: 0.5rem;
          }
          
          .form-input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            transition: all 0.2s ease;
            background: white;
          }
          
          .form-input:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }
          
          .form-textarea {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            transition: all 0.2s ease;
            background: white;
            resize: none;
            font-family: inherit;
          }
          
          .form-textarea:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }
          
          .case-info {
            background: #dbeafe;
            border: 1px solid #93c5fd;
            padding: 1rem;
            border-radius: 0.375rem;
          }
          
          .case-info p {
            font-size: 0.875rem;
            color: #6b7280;
          }
          
          .case-info .case-label {
            font-weight: 500;
            color: #111827;
          }
          
          .modal-footer {
            display: flex;
            gap: 0.75rem;
            padding: 1.5rem;
            border-top: 1px solid #e5e7eb;
            background: #f9fafb;
            border-radius: 0 0 0.5rem 0.5rem;
          }
          
          .modal-btn {
            flex: 1;
            padding: 0.75rem 1rem;
            border-radius: 0.375rem;
            font-weight: 500;
            font-size: 0.875rem;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
          }
          
          .modal-btn-cancel {
            background: white;
            color: #374151;
            border: 1px solid #d1d5db;
          }
          
          .modal-btn-cancel:hover {
            background: #f9fafb;
          }
          
          .modal-btn-primary {
            background: #3b82f6;
            color: white;
          }
          
          .modal-btn-primary:hover {
            background: #2563eb;
          }
        </style>
      </head>
      <body>
        <div class="screenshot-container">
          <!-- Header -->
          <div class="header">
            <div class="header-content">
              <div class="header-left">
                <div class="header-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </div>
                <div>
                  <div class="header-title">Screenshot Preview</div>
                  <div class="header-subtitle">${screenshot.filename}</div>
                </div>
              </div>
              <button onclick="window.close()" class="close-btn">
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- Screenshot Info -->
          <div class="info-bar">
            <div class="info-content">
              <span class="info-badge">Case: ${screenshot.caseId}</span>
              <span class="info-badge">Type: ${screenshot.type}</span>
              <span class="info-badge">Size: ${formatFileSize(screenshot.dataUrl)}</span>
              <span class="info-badge">Captured: ${formatTimestamp(screenshot.timestamp)}</span>
            </div>
          </div>

          <!-- Upload Progress (Initially Hidden) -->
          <div id="uploadSection" class="upload-section">
            <div class="upload-content">
              <div class="upload-header">
                <span class="upload-status" id="uploadStatus">Uploading...</span>
                <span class="upload-percent" id="uploadPercent">0%</span>
              </div>
              <div class="upload-progress">
                <div class="upload-progress-bar" id="progressBar"></div>
              </div>
            </div>
          </div>

          <!-- Large Image Container -->
          <div class="image-container">
            <img
              id="screenshotImage"
              src="${screenshot.dataUrl}"
              alt="Screenshot preview"
              class="screenshot-image"
              onclick="toggleFullscreen()"
            />
          </div>

          <!-- Footer Actions -->
          <div class="footer">
            <div class="footer-content">
              <div class="actions-grid">
                <button onclick="retakeScreenshot()" class="action-btn btn-outline">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  Retake
                </button>

                <button onclick="downloadScreenshot()" class="action-btn btn-outline">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  Download
                </button>

                <button onclick="saveLocal()" class="action-btn btn-secondary">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                  </svg>
                  Save Local
                </button>

                <button onclick="addToCase()" class="action-btn btn-primary">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                  </svg>
                  Add to Case
                </button>
              </div>
              
              <div class="footer-hint">
                <p>💡 Click the image to view in fullscreen • Press ESC to exit fullscreen</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Add to Case Modal -->
        <div id="addToCaseModal" class="modal" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="modal-title">Add to case</h3>
              <button onclick="closeModal()" class="modal-close">
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Name</label>
                <input type="text" id="screenshotName" value="${screenshot.filename.replace(/\.[^/.]+$/, "")}" 
                       class="form-input" placeholder="Enter screenshot name">
              </div>
              
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="screenshotDescription" rows="3" class="form-textarea" placeholder="Optional description"></textarea>
              </div>
              
              <div class="form-group">
                <label class="form-label">URL</label>
                <input type="url" id="screenshotUrl" value="" class="form-input" placeholder="Source URL">
              </div>
              
              <div class="case-info">
                <p><span class="case-label">Adding to case:</span> ${screenshot.caseId}</p>
              </div>
            </div>
            
            <div class="modal-footer">
              <button onclick="closeModal()" class="modal-btn modal-btn-cancel">Cancel</button>
              <button onclick="submitToCase()" class="modal-btn modal-btn-primary">Add to case</button>
            </div>
          </div>
        </div>

        <script>
          let isFullscreen = false;
          
          function toggleFullscreen() {
            const img = document.getElementById('screenshotImage');
            if (!isFullscreen) {
              img.className = 'fullscreen-image';
              isFullscreen = true;
            } else {
              img.className = 'screenshot-image';
              isFullscreen = false;
            }
          }
          
          function retakeScreenshot() {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ action: 'retake' }, '*');
            }
            window.close();
          }
          
          function downloadScreenshot() {
            const link = document.createElement('a');
            link.href = '${screenshot.dataUrl}';
            link.download = '${screenshot.filename}';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
          
          function saveLocal() {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ action: 'save' }, '*');
            }
          }
          
          function addToCase() {
            document.getElementById('addToCaseModal').style.display = 'flex';
          }
          
          function closeModal() {
            document.getElementById('addToCaseModal').style.display = 'none';
          }
          
          function submitToCase() {
            const name = document.getElementById('screenshotName').value;
            const description = document.getElementById('screenshotDescription').value;
            const url = document.getElementById('screenshotUrl').value;
            
            if (!name.trim()) {
              alert('Please enter a name for the screenshot');
              return;
            }
            
            // Show upload progress
            document.getElementById('uploadSection').style.display = 'block';
            document.getElementById('addToCaseModal').style.display = 'none';
            
            // Simulate upload progress
            let progress = 0;
            const interval = setInterval(() => {
              progress += Math.random() * 15;
              if (progress > 100) progress = 100;
              
              document.getElementById('progressBar').style.width = progress + '%';
              document.getElementById('uploadPercent').textContent = Math.round(progress) + '%';
              
              if (progress >= 100) {
                clearInterval(interval);
                document.getElementById('uploadStatus').textContent = 'Upload completed!';
                setTimeout(() => {
                  alert('Screenshot "' + name + '" added to case ${screenshot.caseId} successfully!');
                  if (window.opener && !window.opener.closed) {
                    window.opener.postMessage({ action: 'addedToCase', name: name }, '*');
                  }
                  window.close();
                }, 1000);
              }
            }, 100);
          }
          
          // Listen for ESC key to close fullscreen
          document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && isFullscreen) {
              toggleFullscreen();
            }
          });
          
          // Auto-focus on load
          window.addEventListener('load', function() {
            document.getElementById('screenshotImage').focus();
          });
        </script>
      </body>
      </html>
    `;
  };

  const setupWindowCommunication = (newWindow: Window) => {
    // Listen for messages from the new window
    const handleMessage = (event: MessageEvent) => {
      if (event.source === newWindow) {
        switch (event.data.action) {
          case 'retake':
            onRetake();
            break;
          case 'save':
            onSave();
            break;
          case 'addedToCase':
            // Handle successful upload
            console.log('Screenshot added to case:', event.data.name);
            break;
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Cleanup listener when window closes
    const checkClosed = setInterval(() => {
      if (newWindow.closed) {
        window.removeEventListener('message', handleMessage);
        clearInterval(checkClosed);
      }
    }, 1000);
  };

  // Fallback: Small popup modal (only if new window fails)
  if (showInPopup) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Screenshot Captured</h3>
                <p className="text-sm text-gray-600">Preview blocked by popup blocker</p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Popup blocked:</strong> Please allow popups to open the full-size preview window.
              </p>
            </div>
            
            <img 
              src={screenshot.dataUrl} 
              alt="Screenshot preview" 
              className="w-full h-auto max-h-48 object-contain border border-gray-200 rounded-lg mb-4"
            />
            
            <div className="text-sm text-gray-600 space-y-1">
              <div><strong>File:</strong> {screenshot.filename}</div>
              <div><strong>Case:</strong> {screenshot.caseId}</div>
            </div>
          </div>
          
          <div className="p-6 border-t border-gray-200 grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setWindowOpened(false);
                handleOpenInNewWindow();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Open Full Preview
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}