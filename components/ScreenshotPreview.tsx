// components/ScreenshotPreview.tsx - Updated with S3 Upload Integration
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
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  // Auto-save option
  const [autoSave, setAutoSave] = useState(false);

  // Upload to S3
  const handleUploadToS3 = async () => {
    if (!screenshot.blob && screenshot.dataUrl) {
      // Convert dataUrl to blob if not available
      try {
        const response = await fetch(screenshot.dataUrl);
        screenshot.blob = await response.blob();
      } catch (error) {
        setUploadState(prev => ({
          ...prev,
          error: 'Failed to convert screenshot to blob'
        }));
        return;
      }
    }

    if (!screenshot.blob) {
      setUploadState(prev => ({
        ...prev,
        error: 'No screenshot data available'
      }));
      return;
    }

    setUploadState({
      isUploading: true,
      progress: null,
      result: null,
      error: null
    });

    try {
      const result = await s3Service.uploadFile(
        screenshot.blob,
        screenshot.filename,
        screenshot.caseId,
        'screenshot',
        {
          onProgress: (progress) => {
            setUploadState(prev => ({
              ...prev,
              progress
            }));
          },
          onSuccess: (result) => {
            setUploadState(prev => ({
              ...prev,
              isUploading: false,
              result
            }));

            // Update case metadata
            updateCaseMetadata(screenshot.caseId);
          },
          onError: (error) => {
            setUploadState(prev => ({
              ...prev,
              isUploading: false,
              error
            }));
          },
          tags: ['screenshot', 'capture', screenshot.type],
          metadata: {
            capturedAt: screenshot.timestamp,
            originalFilename: screenshot.filename,
            captureType: screenshot.type
          }
        }
      );

      if (!result.success) {
        setUploadState(prev => ({
          ...prev,
          isUploading: false,
          error: result.error || 'Upload failed'
        }));
      }
    } catch (error) {
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }));
    }
  };

  // Update case metadata after successful upload
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

  // Auto-save on mount if enabled
  useEffect(() => {
    if (autoSave && !uploadState.isUploading && !uploadState.result) {
      handleUploadToS3();
    }
  }, [autoSave]);

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
      {/* Main Preview Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white overflow-y-auto rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full mx-4 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Screenshot Preview
              </h2>
              <p className="text-sm text-gray-500">{screenshot.filename}</p>
            </div>
            <div className="flex items-center space-x-2">
              {/* Auto-save toggle */}
              <label className="flex items-center text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  className="mr-2 rounded"
                  disabled={uploadState.isUploading || !!uploadState.result}
                />
                Auto-save to S3
              </label>
              
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Upload Status */}
          {(uploadState.isUploading || uploadState.progress || uploadState.result || uploadState.error) && (
            <div className="px-4 py-3 border-b bg-gray-50">
              {uploadState.isUploading && uploadState.progress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-600 font-medium">
                      Uploading to S3... {uploadState.progress.percentage}%
                    </span>
                    <span className="text-gray-500">
                      {uploadState.progress.speed && (
                        `${Math.round(uploadState.progress.speed / 1024)} KB/s`
                      )}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadState.progress.percentage}%` }}
                    ></div>
                  </div>
                  {uploadState.progress.timeRemaining && (
                    <div className="text-xs text-gray-500">
                      {Math.round(uploadState.progress.timeRemaining)} seconds remaining
                    </div>
                  )}
                </div>
              )}

              {uploadState.result && (
                <div className="flex items-center text-sm text-green-600">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Successfully uploaded to S3</span>
                  <button
                    onClick={() => window.open(uploadState.result!.fileUrl, '_blank')}
                    className="ml-2 text-blue-600 hover:text-blue-800 underline"
                  >
                    View File
                  </button>
                </div>
              )}

              {uploadState.error && (
                <div className="flex items-center justify-between text-sm text-red-600">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>Upload failed: {uploadState.error}</span>
                  </div>
                  <button
                    onClick={handleUploadToS3}
                    className="text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

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
                <span className="font-medium">Size:</span>{" "}
                {formatFileSize(screenshot.dataUrl)}
              </div>
              <div>
                <span className="font-medium">Captured:</span>{" "}
                {formatTimestamp(screenshot.timestamp)}
              </div>
            </div>
          </div>

          {/* Image Container */}
          <div className="flex-1 p-4">
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
          <div className="p-4 border-t bg-gray-50">
            <div className="text-sm text-gray-600 mb-3">
              Click image to view fullscreen
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={onRetake}
                disabled={uploadState.isUploading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Retake
              </button>

              <button
                onClick={onDownload}
                disabled={uploadState.isUploading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download</span>
              </button>

              <button
                onClick={onSave}
                disabled={uploadState.isUploading || !!uploadState.result}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-600 border border-transparent rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>Save Local</span>
              </button>

              <button
                onClick={handleUploadToS3}
                disabled={uploadState.isUploading || !!uploadState.result}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                {uploadState.isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Uploading...</span>
                  </>
                ) : uploadState.result ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Uploaded</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span>Upload to S3</span>
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
              <p className="text-xs opacity-75">
                {formatFileSize(screenshot.dataUrl)} •{" "}
                {formatTimestamp(screenshot.timestamp)}
              </p>
            </div>

            {/* Upload status in fullscreen */}
            {uploadState.result && (
              <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-2 rounded">
                <p className="text-sm font-medium">✓ Uploaded to S3</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}