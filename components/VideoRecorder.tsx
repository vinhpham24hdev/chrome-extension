// components/VideoRecorder.tsx - Simple & clean like Loom
import React, { useState, useEffect, useRef } from "react";
import { FaPlay, FaPause, FaStop, FaTimes, FaCircle } from "react-icons/fa";

import {
  videoService,
  VideoOptions,
  VideoResult,
  RecordingState,
  RecordingControls,
} from "../services/videoService";
import { s3Service, UploadProgress, UploadResult } from "../services/s3Service";
import { caseService } from "../services/caseService";
import { toast } from "react-toastify";

interface VideoRecorderProps {
  caseId: string;
  autoStart?: boolean;
  defaultOptions?: Partial<VideoOptions>;
  onVideoCapture?: (result: VideoResult) => void;
  onClose?: () => void;
}

export default function VideoRecorder({
  caseId,
  autoStart = false,
  defaultOptions = {},
  onVideoCapture,
  onClose,
}: VideoRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>(
    videoService.getCurrentState()
  );
  const [recordingControls, setRecordingControls] =
    useState<RecordingControls | null>(null);
  const [videoOptions] = useState<VideoOptions>({
    type: "desktop",
    format: "webm",
    quality: "high",
    maxDuration: 1200, 
    includeAudio: false,
    ...defaultOptions,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  
  // ✅ ADDED: S3 Upload State (minimal addition)
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

  const [videoForm, setVideoForm] = useState({
    name: "",
    description: "",
    url: window.location.href || "",
  });
  const [videoResult, setVideoResult] = useState<VideoResult | null>(null);
  const hasAutoStarted = useRef(false);

  const handleFormChange = (field: keyof typeof videoForm, value: string) => {
    setVideoForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Set default video name when video result is available
  useEffect(() => {
    if (videoResult && videoResult.filename && !videoForm.name) {
      const defaultName = videoResult.filename.replace(/\.[^/.]+$/, ""); // Remove extension
      setVideoForm((prev) => ({
        ...prev,
        name: defaultName,
      }));
    }
  }, [videoResult, videoForm.name]);

  useEffect(() => {
    setIsSupported(videoService.isSupported());
  }, []);

  // Auto-start recording when component mounts
  useEffect(() => {
    if (
      autoStart &&
      isSupported &&
      !hasAutoStarted.current &&
      !recordingState.isRecording
    ) {
      hasAutoStarted.current = true;
      handleStartRecording();
    }
  }, [autoStart, isSupported]);

  const handleStartRecording = async () => {
    try {
      setError(null);
      setIsInitializing(true);

      const controls = await videoService.startRecording(videoOptions, {
        onStateChange: (state) => {
          setRecordingState(state);
          if (state.status === "completed") {
            setRecordingControls(null);
          }
        },
      });

      setRecordingControls(controls);
      setIsInitializing(false);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to start recording"
      );
      setIsInitializing(false);
    }
  };

  const handleStopRecording = async () => {
    if (!recordingControls) return;

    try {
      const result = await recordingControls.stop();
      if (result.success) {
        // Show result in same tab instead of opening preview window
        setVideoResult(result);
      } else {
        setError(result.error || "Recording failed");
      }
      setRecordingControls(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to stop recording"
      );
    }
  };

  const handlePauseRecording = () => {
    recordingControls?.pause();
  };

  const handleResumeRecording = () => {
    recordingControls?.resume();
  };

  // ✅ UPDATED: Enhanced save video with S3 upload (keeping original logic)
  const handleSaveVideo = async () => {
    if (!videoResult || !videoForm.name.trim()) {
      toast.error("Please enter a name for this video");
      return;
    }

    setUploadState({
      isUploading: true,
      progress: null,
      result: null,
      error: null,
    });

    try {
      console.log("🎬 Preparing to upload video...", {
        filename: videoResult.filename,
        size: videoResult.size,
        caseId: caseId,
        name: videoForm.name,
        description: videoForm.description,
        url: videoForm.url,
      });

      const isCustomerTestMode =
        import.meta.env.VITE_CUSTOMER_TEST_MODE === "true";
      const customerBucket = import.meta.env.VITE_CUSTOMER_S3_BUCKET || "";

      if (isCustomerTestMode) {
        console.log("🧪 Using customer bucket for video upload...", {
          bucket: customerBucket,
          filename: videoResult.filename,
          caseId: caseId,
          size: videoResult.size,
        });

        const { customerS3Service } = await import(
          "../services/customerS3Service"
        );

        const result = await customerS3Service.uploadFile(
          videoResult.blob!,
          videoResult.filename!,
          caseId,
          "video",
          {
            onProgress: (progress) => {
              console.log(
                `📤 Customer video upload progress: ${progress.percentage}%`
              );
              setUploadState((prev) => ({ ...prev, progress }));
            },
            onSuccess: (result) => {
              console.log("✅ Customer video upload successful:", result);
              setUploadState((prev) => ({
                ...prev,
                isUploading: false,
                result,
              }));
            },
            onError: (error) => {
              console.error("❌ Customer video upload failed:", error);
              setUploadState((prev) => ({
                ...prev,
                isUploading: false,
                error,
              }));
            },
            metadata: {
              capturedAt: new Date().toISOString(),
              originalFilename: videoResult.filename,
              description: videoForm.description,
              sourceUrl: videoForm.url,
              captureType: "video-recording",
              recordingType: videoOptions.type,
              quality: videoOptions.quality,
              caseName: videoForm.name,
              duration: videoResult.duration,
              testMode: "customer-bucket",
            },
            description: videoForm.description.trim() || undefined,
            sourceUrl: videoForm.url.trim() || undefined,
          }
        );

        if (result.success) {
          console.log(
            "🎉 Video uploaded to customer bucket successfully!"
          );
          toast.success(`✅ Customer Bucket Test Successful!\n\n`);
          onClose?.();
        } else {
          throw new Error(result.error || "Customer bucket upload failed");
        }
      } else {
        console.log("🚀 Using backend S3 service for video...", {
          filename: videoResult.filename,
          caseId: caseId,
          size: videoResult.size,
        });

        // ✅ Backend S3 upload with description and sourceUrl
        const result = await s3Service.uploadFile(
          videoResult.blob!,
          videoResult.filename!,
          caseId,
          "video",
          {
            onProgress: (progress) => {
              console.log(`📤 Backend video upload progress: ${progress.percentage}%`);
              setUploadState((prev) => ({ ...prev, progress }));
            },
            onSuccess: (result) => {
              console.log("✅ Backend video upload successful:", result);
              setUploadState((prev) => ({
                ...prev,
                isUploading: false,
                result,
              }));
            },
            onError: (error) => {
              console.error("❌ Backend video upload failed:", error);
              setUploadState((prev) => ({
                ...prev,
                isUploading: false,
                error,
              }));
            },
            tags: ["video", "recording", "capture", videoForm.name],
            metadata: {
              capturedAt: new Date().toISOString(),
              originalFilename: videoResult.filename,
              description: videoForm.description,
              sourceUrl: videoForm.url,
              captureType: "video-recording",
              recordingType: videoOptions.type,
              quality: videoOptions.quality,
              caseName: videoForm.name,
              duration: videoResult.duration,
            },
            description: videoForm.description.trim() || undefined,
            sourceUrl: videoForm.url.trim() || undefined,
          }
        );

        if (result.success) {
          console.log("🎉 Video uploaded to backend S3 successfully!");

          // Update case metadata via real backend API
          try {
            const caseData = await caseService.getCaseById(caseId);
            if (caseData && caseData.metadata) {
              await caseService.updateCaseMetadata(caseId, {
                totalVideos: (caseData.metadata.totalVideos || 0) + 1,
                totalFileSize: (caseData.metadata.totalFileSize || 0) + (videoResult.size || 0),
                lastActivity: new Date().toISOString(),
              });
              console.log("✅ Case metadata updated successfully");
            }
          } catch (metadataError) {
            console.error("❌ Failed to update case metadata:", metadataError);
          }

          // Show success message
          toast.success(`Video "${videoForm.name}" added to case "${caseId}" successfully!`);
          onClose?.();
        } else {
          throw new Error(result.error || "Backend upload failed");
        }
      }
    } catch (error) {
      console.error("❌ Video upload process failed:", error);
      setUploadState((prev) => ({
        ...prev,
        isUploading: false,
        error: error instanceof Error ? error.message : "Video upload failed",
      }));
    }
  };

  const handleCancelRecording = () => {
    recordingControls?.cancel();
    setRecordingControls(null);
    setError(null);
    onClose?.();
  };

  if (!isSupported) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            Video recording not supported
          </h3>
          <p className="text-gray-600 mb-6">
            Please use a modern Chrome browser
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Screen Selection State
  if (isInitializing && !recordingState.isRecording) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className="text-2xl font-medium text-gray-900 mb-4">
            Choose what to share
          </h3>
          <p className="text-gray-600 max-w-md">
            Select your entire screen, a window, or a browser tab in the popup,
            then click Share
          </p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            Something went wrong
          </h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-x-4">
            <button
              onClick={handleStartRecording}
              className="px-6 py-2 bg-blue-600 border-blue-600  text-white rounded-lg hover:bg-blue-700"
            >
              Try again
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Recording State - Clean minimal design like real Loom
  if (recordingState.isRecording) {
    return (
      <div className="min-h-screen p-6 bg-gray-50 relative flex-col items-center justify-center">
        {/* Floating Control Bar */}
        <div className="flex justify-center left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-white backdrop-blur-sm border border-gray-200 rounded-full px-4 py-2 shadow-xl flex items-center space-x-3 transition-all duration-300 ease-in-out">
            {/* Timer indicator with red dot */}
            <div className="flex items-center space-x-2 px-2 py-1 rounded-full bg-red-50">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-700 font-medium text-sm tabular-nums">
                {videoService.formatDuration(recordingState.duration)}
              </span>
            </div>

            {/* Control buttons */}
            <div className="flex items-center space-x-1">
              {recordingState.isPaused ? (
                <button
                  onClick={handleResumeRecording}
                  className="w-8 h-8 cursor-pointer bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-colors"
                  title="Resume"
                >
                  <FaPlay className="w-3.5 h-3.5 text-white" />
                </button>
              ) : (
                <button
                  onClick={handlePauseRecording}
                  className="w-8 h-8 cursor-pointer bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                  title="Pause"
                >
                  <FaPause className="w-3.5 h-3.5 text-gray-700" />
                </button>
              )}

              <button
                onClick={handleStopRecording}
                className="w-8 h-8 cursor-pointer bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
                title="Stop"
              >
                <FaStop className="w-3.5 h-3.5 text-white" />
              </button>

              <button
                onClick={handleCancelRecording}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors ml-1"
                title="Cancel"
              >
                <FaTimes className="w-3.5 h-3.5 text-gray-700" />
              </button>
            </div>
          </div>
        </div>

        {/* Centered Content */}
        <div className="text-center p-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
            <FaCircle className="w-10 h-10 text-red-500 animate-pulse" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            {recordingState.isPaused ? "Recording Paused" : "Recording..."}
          </h2>
          <p className="text-gray-500 text-sm">
            {videoService.formatFileSize(recordingState.size)} • Use controls
            above to manage recording
          </p>
        </div>
      </div>
    );
  }

  // Video Preview State - Show result in same tab (ORIGINAL DESIGN)
  if (videoResult && videoResult.success && videoResult.dataUrl) {
    return (
      <div className="relative items-center justify-center z-50">
        <button
          onClick={onClose}
          className="flex items-center text-gray-400 hover:text-gray-600 absolute top-0 right-4"
        >
          <FaTimes className="w-4 h-4" />
        </button>

        {/* ✅ ADDED: Upload Progress Overlay (minimal addition) */}
        {uploadState.isUploading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Uploading Video to S3
                </h3>
                {uploadState.progress && (
                  <>
                    <div className="text-sm text-gray-600 mb-3">
                      {uploadState.progress.percentage}% complete
                      {uploadState.progress.speed && (
                        <span className="ml-2">
                          ({Math.round(uploadState.progress.speed / 1024)} KB/s)
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadState.progress.percentage}%` }}
                      ></div>
                    </div>
                  </>
                )}
                <p className="text-sm text-gray-500">
                  Please wait while we save your video...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ✅ ADDED: Upload Error Modal */}
        {uploadState.error && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="text-center">
                <div className="text-red-500 text-4xl mb-4">⚠️</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Upload Failed
                </h3>
                <p className="text-sm text-gray-600 mb-4">{uploadState.error}</p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setUploadState((prev) => ({ ...prev, error: null }))}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveVideo}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg w-full max-w-6xl flex">
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between py-4 border-b">
              <div>
                <h2 className="text-2xl font-medium text-gray-900">
                  Snapshot 65890983
                </h2>
                <p className="text-sm text-gray-600">
                  {videoService.formatDuration(videoResult.duration || 0)} •{" "}
                  {videoService.formatFileSize(videoResult.size || 0)}
                </p>
              </div>
            </div>

            {/* Video Player */}
            <div className="py-6 flex-1">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden h-full flex items-center justify-center">
                <video
                  src={videoResult.dataUrl}
                  controls
                  className="w-full h-auto"
                  style={{ maxHeight: "70vh" }}
                >
                  Your browser does not support video playback.
                </video>
              </div>
            </div>
          </div>

          {/* Right Side: Details form (ORIGINAL LAYOUT) */}
          <div className="w-80 p-6 flex flex-col">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Details</h3>
            <input
              type="text"
              placeholder="Name"
              value={videoForm.name}
              onChange={(e) => handleFormChange("name", e.target.value)}
              className="mt-1 mb-4 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={uploadState.isUploading}
            />
            <textarea
              placeholder="Description"
              rows={4}
              value={videoForm.description}
              onChange={(e) => handleFormChange("description", e.target.value)}
              className="mt-1 mb-4 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={uploadState.isUploading}
            />
            <div className="py-2">
              <label className="text-sm font-medium text-gray-700">URL</label>
              <input
                type="url"
                value={videoForm.url}
                onChange={(e) => handleFormChange("url", e.target.value)}
                className="mt-1 mb-6 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
                disabled={uploadState.isUploading}
              />
            </div>
            <div className="mt-auto flex justify-end space-x-2 pt-6 border-t">
              <button
                onClick={onClose}
                disabled={uploadState.isUploading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVideo}
                disabled={uploadState.isUploading || !videoForm.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border-blue-600  rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {uploadState.isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Saving...
                  </>
                ) : uploadState.result ? (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Saved
                  </>
                ) : (
                  "Add to case"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Completed State
  if (recordingState.status === "completed" && !videoResult) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-2xl font-medium text-gray-900 mb-2">
            Processing video...
          </h3>
          <p className="text-gray-600 mb-4">
            {videoService.formatDuration(recordingState.duration)} •{" "}
            {videoService.formatFileSize(recordingState.size)}
          </p>
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // Initial State - Simple start screen
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-6">🎬</div>
        <h3 className="text-2xl font-medium text-gray-900 mb-4">
          Ready to record
        </h3>
        <p className="text-gray-600 mb-8 max-w-md">
          Record your screen to create a video for case {caseId}
        </p>
        <button
          onClick={handleStartRecording}
          className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
        >
          Start recording
        </button>
      </div>
    </div>
  );
}