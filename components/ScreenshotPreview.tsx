// components/ScreenshotPreview.tsx - Fullscreen design matching the image
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
  const [formData, setFormData] = useState({
    name: screenshot.filename.replace(/\.[^/.]+$/, ""),
    description: "",
    url: window.location.href || "", // Current page URL
  });

  const [uploadState, setUploadState] = useState<{
    isUploading: boolean;
    progress: UploadProgress | null;
    result: UploadResult | null;
    error: string | null;
  }>({
    isUploading: false,
    progress: null,
    result: null,
    error: null,
  });

  // Auto-detect current page URL
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) {
          setFormData(prev => ({ ...prev, url: tabs[0].url! }));
        }
      });
    }
  }, []);

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

  const handleCancel = () => {
    onClose();
  };

  const handleAddToCase = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a name for the screenshot');
      return;
    }

    setUploadState({
      isUploading: true,
      progress: null,
      result: null,
      error: null,
    });

    try {
      let blob = screenshot.blob;
      if (!blob) {
        // Convert dataUrl to blob if not available
        const response = await fetch(screenshot.dataUrl);
        blob = await response.blob();
      }

      const result = await s3Service.uploadFile(
        blob,
        screenshot.filename,
        screenshot.caseId,
        "screenshot",
        {
          onProgress: (progress) => {
            setUploadState((prev) => ({
              ...prev,
              progress,
            }));
          },
          onSuccess: (result) => {
            setUploadState((prev) => ({
              ...prev,
              isUploading: false,
              result,
            }));
          },
          onError: (error) => {
            setUploadState((prev) => ({
              ...prev,
              isUploading: false,
              error,
            }));
          },
          tags: ["screenshot", "capture", formData.name],
          metadata: {
            capturedAt: screenshot.timestamp,
            originalFilename: screenshot.filename,
            description: formData.description,
            sourceUrl: formData.url,
            captureType: screenshot.type,
            caseName: formData.name,
          },
        }
      );

      if (result.success) {
        // Update case metadata
        try {
          const caseData = await caseService.getCaseById(screenshot.caseId);
          if (caseData && caseData.metadata) {
            await caseService.updateCaseMetadata(screenshot.caseId, {
              totalScreenshots: (caseData.metadata.totalScreenshots || 0) + 1,
              totalFileSize: (caseData.metadata.totalFileSize || 0) + blob.size,
              lastActivity: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error("Failed to update case metadata:", error);
        }

        alert(`Screenshot "${formData.name}" added to case ${screenshot.caseId} successfully!`);
        onSave();
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadState((prev) => ({
        ...prev,
        isUploading: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          {/* Icon */}
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          
          {/* Title */}
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Screenshot Preview</h1>
            <p className="text-sm text-gray-600">{screenshot.filename}</p>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={uploadState.isUploading}
          className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-md"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Upload Progress Bar */}
      {uploadState.isUploading && uploadState.progress && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-blue-700 font-medium">
              Uploading to S3... {uploadState.progress.percentage}%
            </span>
            {uploadState.progress.speed && (
              <span className="text-blue-600">
                {Math.round(uploadState.progress.speed / 1024)} KB/s
              </span>
            )}
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadState.progress.percentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Success/Error Messages */}
      {uploadState.result && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-3">
          <div className="flex items-center text-sm text-green-700">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Successfully uploaded to S3</span>
          </div>
        </div>
      )}

      {uploadState.error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3">
          <div className="flex items-center text-sm text-red-700">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>Upload failed: {uploadState.error}</span>
          </div>
        </div>
      )}

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Screenshot Image */}
        <div className="flex-1 bg-gray-100 flex items-center justify-center p-6">
          <div className="max-w-full max-h-full">
            <img
              src={screenshot.dataUrl}
              alt="Screenshot preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg bg-white border border-gray-200"
              style={{ maxHeight: 'calc(100vh - 200px)' }}
            />
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          {/* Screenshot Info */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Screenshot Details</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Case:</span>
                <span className="font-medium text-gray-900">{screenshot.caseId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium text-gray-900 capitalize">{screenshot.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Size:</span>
                <span className="font-medium text-gray-900">{formatFileSize(screenshot.dataUrl)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Captured:</span>
                <span className="font-medium text-gray-900">{formatTimestamp(screenshot.timestamp)}</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 p-6">
            <form className="space-y-6">
              {/* Name Field */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter screenshot name"
                  required
                  disabled={uploadState.isUploading}
                />
              </div>

              {/* Description Field */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional description"
                  disabled={uploadState.isUploading}
                />
              </div>

              {/* URL Field */}
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                  URL
                </label>
                <input
                  type="url"
                  id="url"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Source URL"
                  disabled={uploadState.isUploading}
                />
              </div>
            </form>
          </div>

          {/* Footer Buttons */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex space-x-3">
              {/* Cancel Button */}
              <button
                onClick={handleCancel}
                disabled={uploadState.isUploading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Cancel
              </button>

              {/* Add to Case Button */}
              <button
                onClick={handleAddToCase}
                disabled={!formData.name.trim() || uploadState.isUploading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
              >
                {uploadState.isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Adding...
                  </>
                ) : uploadState.result ? (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Added to Case
                  </>
                ) : (
                  'Add to case'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}