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

// Mock cases for dropdown
const mockCases = [
  { id: "Case-120320240830", title: "Website Bug Investigation" },
  { id: "Case-120320240829", title: "Performance Issue Analysis" },
  { id: "Case-120320240828", title: "User Experience Review" },
];

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
  }, [screenshot.dataUrl, windowOpened]);

  const handleOpenInNewWindow = () => {
    if (windowOpened) return;
    
    try {
      setWindowOpened(true);
      
      // Create the HTML content for the new window
      const htmlContent = createPreviewHTML(screenshot);
      
      // Open new window with larger size
      const newWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes,location=no,menubar=no,toolbar=no');
      
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

    const snapshotId = `Snapshot ${Math.floor(Math.random() * 100000000)}`;

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
            background: rgba(0, 0, 0, 0.5);
            color: #1f2937;
            line-height: 1.5;
            padding: 2rem;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .modal-container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            max-width: 1200px;
            width: 100%;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem;
            border-bottom: 1px solid #e5e7eb;
            background: white;
          }
          
          .header h2 {
            font-size: 1.125rem;
            font-weight: 500;
            color: #111827;
          }
          
          .close-btn {
            background: none;
            border: none;
            color: #9ca3af;
            cursor: pointer;
            padding: 0.25rem;
            border-radius: 0.25rem;
            transition: all 0.2s ease;
          }
          
          .close-btn:hover {
            background: #f3f4f6;
            color: #6b7280;
          }
          
          .upload-section {
            background: #dbeafe;
            border-bottom: 1px solid #93c5fd;
            padding: 0.75rem 1rem;
            display: none;
          }
          
          .upload-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
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
            background: #3b82f6;
            transition: width 0.3s ease;
            border-radius: 0.5rem;
            width: 0%;
          }
          
          .main-content {
            flex: 1;
            display: flex;
            overflow: hidden;
          }
          
          .screenshot-container {
            flex: 1;
            padding: 1rem;
            background: #f3f4f6;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .screenshot-image {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border: 1px solid #d1d5db;
            border-radius: 0.25rem;
            background: white;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
          }
          
          .details-panel {
            width: 320px;
            background: white;
            border-left: 1px solid #e5e7eb;
            display: flex;
            flex-direction: column;
          }
          
          .details-header {
            padding: 1rem;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .details-header h3 {
            font-size: 1.125rem;
            font-weight: 500;
            color: #111827;
          }
          
          .form-container {
            flex: 1;
            padding: 1rem;
          }
          
          .form-group {
            margin-bottom: 1rem;
          }
          
          .form-label {
            display: block;
            font-size: 0.875rem;
            font-weight: 500;
            color: #374151;
            margin-bottom: 0.25rem;
          }
          
          .form-input {
            width: 100%;
            padding: 0.5rem 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            transition: all 0.2s ease;
            font-family: inherit;
          }
          
          .form-input:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 1px #3b82f6;
          }
          
          .form-textarea {
            width: 100%;
            padding: 0.5rem 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            transition: all 0.2s ease;
            resize: none;
            font-family: inherit;
            rows: 3;
          }
          
          .form-textarea:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 1px #3b82f6;
          }
          
          .form-select {
            width: 100%;
            padding: 0.5rem 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            transition: all 0.2s ease;
            background: white;
            font-family: inherit;
          }
          
          .form-select:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 1px #3b82f6;
          }
          
          .footer {
            padding: 1rem;
            border-top: 1px solid #e5e7eb;
            display: flex;
            gap: 0.75rem;
          }
          
          .btn {
            flex: 1;
            padding: 0.5rem 1rem;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
            font-family: inherit;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
          }
          
          .btn-cancel {
            background: white;
            color: #374151;
            border: 1px solid #d1d5db;
          }
          
          .btn-cancel:hover {
            background: #f9fafb;
          }
          
          .btn-primary {
            background: #3b82f6;
            color: white;
            border: 1px solid #3b82f6;
          }
          
          .btn-primary:hover {
            background: #2563eb;
          }
          
          .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .loading {
            width: 1rem;
            height: 1rem;
            border: 2px solid currentColor;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          
          .success-message {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #16a34a;
            padding: 0.75rem 1rem;
            font-size: 0.875rem;
            display: none;
          }
          
          .error-message {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 0.75rem 1rem;
            font-size: 0.875rem;
            display: none;
          }
        </style>
      </head>
      <body>
        <div class="modal-container">
          <!-- Header -->
          <div class="header">
            <h2>${snapshotId}</h2>
            <button id="closeBtn" class="close-btn">
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <!-- Upload Progress (Initially Hidden) -->
          <div id="uploadSection" class="upload-section">
            <div class="upload-header">
              <span class="upload-status" id="uploadStatus">Uploading...</span>
              <span class="upload-percent" id="uploadPercent">0%</span>
            </div>
            <div class="upload-progress">
              <div class="upload-progress-bar" id="progressBar"></div>
            </div>
          </div>

          <!-- Success/Error Messages -->
          <div id="successMessage" class="success-message">
            Successfully uploaded to S3
          </div>
          <div id="errorMessage" class="error-message">
            <span id="errorText">Upload failed</span>
          </div>

          <!-- Main Content -->
          <div class="main-content">
            <!-- Screenshot -->
            <div class="screenshot-container">
              <img
                src="${screenshot.dataUrl}"
                alt="Screenshot preview"
                class="screenshot-image"
              />
            </div>

            <!-- Details Panel -->
            <div class="details-panel">
              <!-- Details Header -->
              <div class="details-header">
                <h3>Details</h3>
              </div>

              <!-- Form -->
              <div class="form-container">
                <div class="form-group">
                  <label class="form-label">Name</label>
                  <input
                    type="text"
                    id="nameInput"
                    class="form-input"
                    value="${screenshot.filename.replace(/\.[^/.]+$/, "")}"
                    placeholder="Enter name"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">Description</label>
                  <textarea
                    id="descriptionInput"
                    class="form-textarea"
                    rows="3"
                    placeholder="Enter description"
                  ></textarea>
                </div>

                <div class="form-group">
                  <label class="form-label">URL</label>
                  <input
                    type="url"
                    id="urlInput"
                    class="form-input"
                    value=""
                    placeholder="Enter URL"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">Case</label>
                  <select id="caseSelect" class="form-select">
                    ${mockCases.map((case_) => 
                      `<option value="${case_.id}" ${case_.id === screenshot.caseId ? 'selected' : ''}>
                        ${case_.id} - ${case_.title}
                      </option>`
                    ).join('')}
                  </select>
                </div>
              </div>

              <!-- Footer -->
              <div class="footer">
                <button id="cancelBtn" class="btn btn-cancel">
                  Cancel
                </button>
                <button id="addBtn" class="btn btn-primary">
                  Add to case
                </button>
              </div>
            </div>
          </div>
        </div>

        <script>
          // All JavaScript code without inline event handlers
          (function() {
            let isUploading = false;
            
            function initializeURL() {
              if (window.opener && !window.opener.closed) {
                try {
                  document.getElementById('urlInput').value = window.opener.location.href;
                } catch (error) {
                  console.log('Could not access opener URL');
                }
              }
            }
            
            function handleCancel() {
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ action: 'cancel' }, '*');
              }
              window.close();
            }
            
            function handleAddToCase() {
              if (isUploading) return;
              
              const name = document.getElementById('nameInput').value.trim();
              const description = document.getElementById('descriptionInput').value.trim();
              const url = document.getElementById('urlInput').value.trim();
              const selectedCase = document.getElementById('caseSelect').value;
              
              if (!name) {
                alert('Please enter a name for the screenshot');
                return;
              }
              
              // Show upload progress
              isUploading = true;
              document.getElementById('uploadSection').style.display = 'block';
              document.getElementById('cancelBtn').disabled = true;
              document.getElementById('addBtn').disabled = true;
              document.getElementById('addBtn').innerHTML = '<div class="loading"></div> Adding...';
              
              // Simulate upload progress
              let progress = 0;
              const interval = setInterval(function() {
                progress += Math.random() * 15;
                if (progress > 100) progress = 100;
                
                document.getElementById('progressBar').style.width = progress + '%';
                document.getElementById('uploadPercent').textContent = Math.round(progress) + '%';
                
                if (progress >= 100) {
                  clearInterval(interval);
                  document.getElementById('uploadStatus').textContent = 'Upload completed!';
                  document.getElementById('successMessage').style.display = 'block';
                  
                  setTimeout(function() {
                    if (window.opener && !window.opener.closed) {
                      window.opener.postMessage({ 
                        action: 'addedToCase', 
                        data: { name: name, description: description, url: url, selectedCase: selectedCase }
                      }, '*');
                    }
                    window.close();
                  }, 1500);
                }
              }, 100);
            }
            
            // Setup event listeners when DOM is loaded
            document.addEventListener('DOMContentLoaded', function() {
              // Initialize URL
              initializeURL();
              
              // Close button
              const closeBtn = document.getElementById('closeBtn');
              if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                  window.close();
                });
              }
              
              // Cancel button
              const cancelBtn = document.getElementById('cancelBtn');
              if (cancelBtn) {
                cancelBtn.addEventListener('click', handleCancel);
              }
              
              // Add to case button
              const addBtn = document.getElementById('addBtn');
              if (addBtn) {
                addBtn.addEventListener('click', handleAddToCase);
              }
              
              // Auto-focus on name input
              const nameInput = document.getElementById('nameInput');
              if (nameInput) {
                nameInput.focus();
              }
            });
            
            // Listen for messages from parent
            window.addEventListener('message', function(event) {
              // Handle any messages if needed
            });
          })();
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
          case 'cancel':
            onClose();
            break;
          case 'addedToCase':
            console.log('Screenshot added to case:', event.data.data);
            onSave();
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
                <strong>Popup blocked:</strong> Please allow popups to open the full preview window.
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
              Open Preview
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