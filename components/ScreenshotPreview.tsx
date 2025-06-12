// components/ScreenshotPreview.tsx
import React, { useState } from 'react';

export interface ScreenshotData {
  dataUrl: string;
  filename: string;
  timestamp: string;
  type: string;
  caseId: string;
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
  isUploading = false 
}: ScreenshotPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const formatFileSize = (dataUrl: string): string => {
    // Estimate file size from base64 data
    const base64Length = dataUrl.split(',')[1]?.length || 0;
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

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <>
      {/* Main Preview Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full mx-4 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Screenshot Preview</h2>
              <p className="text-sm text-gray-500">{screenshot.filename}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Screenshot Info */}
          <div className="px-4 py-3 bg-gray-50 border-b">
            <div className="flex flex-wrap gap-6 text-sm text-gray-600">
              <div>
                <span className="font-medium">Case:</span> {screenshot.caseId}
              </div>
              <div>
                <span className="font-medium">Type:</span> {screenshot.type}
              </div>
              <div>
                <span className="font-medium">Size:</span> {formatFileSize(screenshot.dataUrl)}
              </div>
              <div>
                <span className="font-medium">Captured:</span> {formatTimestamp(screenshot.timestamp)}
              </div>
            </div>
          </div>

          {/* Image Container */}
          <div className="flex-1 overflow-auto p-4">
            <div className="relative group">
              <img
                src={screenshot.dataUrl}
                alt="Screenshot preview"
                className="max-w-full h-auto border border-gray-300 rounded cursor-pointer"
                onClick={toggleFullscreen}
              />
              
              {/* Fullscreen button overlay */}
              <button
                onClick={toggleFullscreen}
                className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                title="View fullscreen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between p-4 border-t bg-gray-50">
            <div className="text-sm text-gray-600">
              Click image to view fullscreen
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={onRetake}
                disabled={isUploading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Retake
              </button>
              
              <button
                onClick={onDownload}
                disabled={isUploading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download</span>
              </button>
              
              <button
                onClick={onSave}
                disabled={isUploading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    <span>Save to Case</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60]">
          <div className="relative max-w-full max-h-full p-4">
            <img
              src={screenshot.dataUrl}
              alt="Screenshot fullscreen"
              className="max-w-full max-h-full object-contain"
            />
            
            {/* Close fullscreen button */}
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-70 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Fullscreen info overlay */}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded">
              <p className="text-sm">{screenshot.filename}</p>
              <p className="text-xs opacity-75">{formatFileSize(screenshot.dataUrl)} • {formatTimestamp(screenshot.timestamp)}</p>
            </div>

            {/* Fullscreen actions */}
            <div className="absolute bottom-4 right-4 flex space-x-2">
              <button
                onClick={onDownload}
                className="bg-black bg-opacity-50 text-white p-2 rounded hover:bg-opacity-70 transition-all"
                title="Download"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              
              <button
                onClick={onSave}
                disabled={isUploading}
                className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50 transition-all"
                title="Save to Case"
              >
                {isUploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}