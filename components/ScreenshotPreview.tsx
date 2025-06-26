// components/ScreenshotPreview.tsx - Updated with Larger Preview matching Figma
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

interface AddToCaseFormData {
  name: string;
  description: string;
  url: string;
}

export default function ScreenshotPreview({
  screenshot,
  onSave,
  onDownload,
  onRetake,
  onClose,
  isUploading = false,
}: ScreenshotPreviewProps) {
  const [showAddToCase, setShowAddToCase] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [formData, setFormData] = useState<AddToCaseFormData>({
    name: "",
    description: "",
    url: window.location.href || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadState, setUploadState] = useState<{
    isUploading: boolean;
    progress: UploadProgress | null;
    result: UploadResult | null;
    error: string | null;
  }>({
    isUploading: false,
    progress: null,
    result: null,
    error: null
  });

  // Auto-populate name from filename
  useEffect(() => {
    if (screenshot.filename) {
      const nameWithoutExt = screenshot.filename.replace(/\.[^/.]+$/, "");
      setFormData(prev => ({
        ...prev,
        name: prev.name || nameWithoutExt
      }));
    }
  }, [screenshot.filename]);

  const handleAddToCase = () => {
    setShowAddToCase(true);
  };

  const handleSubmitToCase = async () => {
    if (!formData.name.trim()) {
      alert("Please enter a name for the screenshot");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload to S3 first
      if (!screenshot.blob && screenshot.dataUrl) {
        const response = await fetch(screenshot.dataUrl);
        screenshot.blob = await response.blob();
      }

      if (!screenshot.blob) {
        throw new Error('No screenshot data available');
      }

      const result = await s3Service.uploadFile(
        screenshot.blob,
        formData.name + '.png',
        screenshot.caseId,
        'screenshot',
        {
          onProgress: (progress) => {
            setUploadState(prev => ({ ...prev, progress }));
          },
          onSuccess: (result) => {
            setUploadState(prev => ({ ...prev, result }));
          },
          onError: (error) => {
            setUploadState(prev => ({ ...prev, error }));
          },
          tags: ['screenshot', 'capture', screenshot.type],
          metadata: {
            capturedAt: screenshot.timestamp,
            originalFilename: screenshot.filename,
            captureType: screenshot.type,
            description: formData.description,
            sourceUrl: formData.url,
            name: formData.name
          }
        }
      );

      if (result.success) {
        // Update case metadata
        await updateCaseMetadata(screenshot.caseId);
        
        // Close dialog and preview
        setShowAddToCase(false);
        onClose();
        
        // Show success message
        alert(`Screenshot "${formData.name}" added to case ${screenshot.caseId} successfully!`);
      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error) {
      console.error('Failed to add to case:', error);
      alert(`Failed to add to case: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateCaseMetadata = async (caseId: string) => {
    try {
      const caseData = await caseService.getCaseById(caseId);
      if (caseData && caseData.metadata) {
        await caseService.updateCaseMetadata(caseId, {
          totalScreenshots: (caseData.metadata.totalScreenshots || 0) + 1,
          lastActivity: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Failed to update case metadata:', error);
    }
  };

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

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <>
      {/* Main Screenshot Preview - Larger Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col overflow-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b bg-white">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">Screenshot Preview</h2>
              <p className="text-sm text-gray-500 mt-1">{screenshot.filename}</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={toggleFullscreen}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded"
                title="Toggle fullscreen"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded"
                title="Close preview"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Screenshot Info */}
          <div className="px-6 py-4 bg-gray-50 border-b">
            <div className="flex flex-wrap gap-6 text-sm text-gray-600">
              <div><span className="font-medium">Case:</span> {screenshot.caseId}</div>
              <div><span className="font-medium">Type:</span> {screenshot.type}</div>
              <div><span className="font-medium">Size:</span> {formatFileSize(screenshot.dataUrl)}</div>
              <div><span className="font-medium">Captured:</span> {formatTimestamp(screenshot.timestamp)}</div>
            </div>
          </div>

          {/* Large Image Container */}
          <div className="flex-1 flex items-center justify-center p-6 bg-gray-100">
            <div className="relative group w-full h-full">
              <img
                src={screenshot.dataUrl}
                alt="Screenshot preview"
                className="max-w-full max-h-full object-contain border border-gray-300 rounded-lg shadow-lg cursor-zoom-in mx-auto bg-white"
                onClick={toggleFullscreen}
              />
              
              {/* Image overlay controls */}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="bg-black bg-opacity-75 rounded-lg px-3 py-2 text-white text-sm">
                  Click to view fullscreen
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t bg-white">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={onRetake}
                disabled={isUploading}
                className="flex items-center justify-center px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retake
              </button>

              <button
                onClick={onDownload}
                disabled={isUploading}
                className="flex items-center justify-center px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
              </button>

              <button
                onClick={onSave}
                disabled={isUploading}
                className="flex items-center justify-center px-4 py-3 text-sm font-medium text-white bg-gray-600 border border-transparent rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save Local
              </button>

              <button
                onClick={handleAddToCase}
                disabled={isUploading}
                className="flex items-center justify-center px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add to case
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-[60]">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <img
              src={screenshot.dataUrl}
              alt="Screenshot fullscreen"
              className="max-w-full max-h-full object-contain cursor-zoom-out"
              onClick={toggleFullscreen}
            />

            {/* Close fullscreen button */}
            <button
              onClick={toggleFullscreen}
              className="absolute top-6 right-6 bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-70 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Fullscreen info overlay */}
            <div className="absolute bottom-6 left-6 bg-black bg-opacity-50 text-white px-4 py-3 rounded-lg">
              <p className="text-sm font-medium">{screenshot.filename}</p>
              <p className="text-xs opacity-75 mt-1">
                {formatFileSize(screenshot.dataUrl)} • {formatTimestamp(screenshot.timestamp)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add to Case Dialog */}
      {showAddToCase && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Dialog Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Add to case</h3>
              <button
                onClick={() => setShowAddToCase(false)}
                disabled={isSubmitting}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Upload Progress */}
            {uploadState.progress && (
              <div className="px-4 py-3 border-b bg-blue-50">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-blue-600 font-medium">
                    Uploading... {uploadState.progress.percentage}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadState.progress.percentage}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Form */}
            <div className="p-4 space-y-4">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter screenshot name"
                  disabled={isSubmitting}
                />
              </div>

              {/* Description Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional description"
                  disabled={isSubmitting}
                />
              </div>

              {/* URL Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Source URL"
                  disabled={isSubmitting}
                />
              </div>

              {/* Case Info */}
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Adding to case:</span> {screenshot.caseId}
                </p>
              </div>
            </div>

            {/* Dialog Actions */}
            <div className="flex space-x-3 p-4 border-t">
              <button
                type="button"
                onClick={() => setShowAddToCase(false)}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitToCase}
                disabled={!formData.name.trim() || isSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Adding...
                  </>
                ) : (
                  'Add to case'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}