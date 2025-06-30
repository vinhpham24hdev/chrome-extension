// components/VideoRecorder.tsx - Video Recording Interface with Auto Start
import React, { useState, useEffect, useRef } from "react";
import {
  videoService,
  VideoOptions,
  VideoResult,
  RecordingState,
  RecordingControls,
} from "../services/videoService";

interface VideoRecorderProps {
  caseId: string;
  autoStart?: boolean; // New prop to auto-start recording
  defaultOptions?: Partial<VideoOptions>; // Default recording options
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
  const [videoOptions, setVideoOptions] = useState<VideoOptions>({
    type: "tab",
    format: "webm",
    quality: "medium",
    maxDuration: 300, // 5 minutes default
    includeAudio: false,
    ...defaultOptions, // Apply any default options passed in
  });
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const hasAutoStarted = useRef(false);

  useEffect(() => {
    // Check if video recording is supported
    setIsSupported(videoService.isSupported());
  }, []);

  // Auto-start recording when component mounts if autoStart is true
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

          // Auto-handle completion
          if (state.status === "completed") {
            setRecordingControls(null);
          }
        },
        onProgress: (progress) => {
          // Progress updates are handled in state
        },
      });

      setRecordingControls(controls);
      setIsInitializing(false);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to start recording"
      );
      setIsInitializing(false);
      console.error("Recording start failed:", error);
    }
  };

  const handleStopRecording = async () => {
    if (!recordingControls) return;

    try {
      const result = await recordingControls.stop();

      if (result.success) {
        // Show preview
        if (videoPreviewRef.current && result.dataUrl) {
          videoPreviewRef.current.src = result.dataUrl;
        }

        // Call callback
        onVideoCapture?.(result);
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
    if (!recordingControls) return;
    recordingControls.pause();
  };

  const handleResumeRecording = () => {
    if (!recordingControls) return;
    recordingControls.resume();
  };

  const handleCancelRecording = () => {
    if (!recordingControls) return;
    recordingControls.cancel();
    setRecordingControls(null);
    setError(null);
  };

  const handleOptionsChange = (updates: Partial<VideoOptions>) => {
    if (recordingState.isRecording) return; // Can't change options during recording
    setVideoOptions((prev) => ({ ...prev, ...updates }));
  };

  if (!isSupported) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <div className="text-red-600 text-4xl mb-4">⚠️</div>
        <h3 className="text-lg font-medium text-red-900 mb-2">
          Video Recording Not Supported
        </h3>
        <p className="text-red-700 mb-4">
          Video recording requires Chrome extension permissions and modern
          browser features.
        </p>
        <button
          onClick={onClose}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 border-t">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Video Recording</h3>
          <p className="text-sm text-gray-600">Case: {caseId}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Initializing State */}
      {isInitializing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
            <div>
              <h4 className="font-medium text-blue-900">
                Starting Recording...
              </h4>
              <p className="text-sm text-blue-700">
                Setting up video capture, please wait...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="text-red-500 mr-3">❌</div>
              <div>
                <h4 className="font-medium text-red-900">Recording Error</h4>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
            <button
              onClick={handleStartRecording}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Recording Status - Prominent when recording */}
      {recordingState.isRecording && (
        <div className="bg-black/80 border border-red-700 rounded p-3 text-white font-sans">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full mr-2 ${
                  recordingState.isPaused ? "bg-yellow-500" : "bg-red-500"
                }`}
              ></div>
              <div>
                <div className="text-sm font-bold">
                  {recordingState.isPaused ? "⏸️ Paused" : "🎥 Recording"}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {videoService.formatDuration(recordingState.duration)} |{" "}
                  {videoService.formatFileSize(recordingState.size)}
                </div>
              </div>
            </div>

            <div className="text-xl">
              {recordingState.isPaused ? "⏸️" : "🎥"}
            </div>
          </div>

          {/* Controls - Gọn và dễ nhấn */}
          <div className="flex gap-2">
            <button
              onClick={handleStopRecording}
              disabled={recordingState.status === "stopping"}
              className="px-3 py-1 bg-gray-900 border border-red-600 text-red-400 hover:bg-red-900 hover:text-white text-xs transition-all disabled:opacity-50"
            >
              ⏹️ Stop
            </button>

            {recordingState.isPaused ? (
              <button
                onClick={handleResumeRecording}
                className="px-3 py-1 bg-green-900 border border-green-700 hover:bg-green-700 text-xs transition-all"
              >
                ▶️ Resume
              </button>
            ) : (
              <button
                onClick={handlePauseRecording}
                className="px-3 py-1 bg-yellow-900 border border-yellow-700 hover:bg-yellow-700 text-xs transition-all"
              >
                ⏸️ Pause
              </button>
            )}

            <button
              onClick={handleCancelRecording}
              className="px-3 py-1 bg-red-900 border border-red-700 hover:bg-red-700 text-xs transition-all"
            >
              ❌ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Quick Settings for Auto-started Recording */}
      {autoStart && !recordingState.isRecording && !isInitializing && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-3">📹 Quick Settings</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>
              <strong>Type:</strong>{" "}
              {videoOptions.type === "tab" ? "Current Tab" : "Desktop/Window"}
            </p>
            <p>
              <strong>Quality:</strong> {videoOptions.quality}
            </p>
            <p>
              <strong>Audio:</strong>{" "}
              {videoOptions.includeAudio ? "Enabled" : "Disabled"}
            </p>
            <p>
              <strong>Max Duration:</strong>{" "}
              {(videoOptions.maxDuration || 300) / 60} minutes
            </p>
          </div>
        </div>
      )}

      {/* Video Preview */}
      {recordingState.status === "completed" && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Recording Preview</h4>
          <div className="bg-black rounded-lg overflow-hidden">
            <video
              ref={videoPreviewRef}
              controls
              className="w-full h-auto max-h-96"
              preload="metadata"
            >
              Your browser does not support video playback.
            </video>
          </div>

          <div className="mt-3 text-sm text-gray-600">
            Duration: {videoService.formatDuration(recordingState.duration)} |
            Size: {videoService.formatFileSize(recordingState.size)}
          </div>
        </div>
      )}

      {/* Recording Tips */}
      {!recordingState.isRecording && !isInitializing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">💡 Recording Tips</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>
              • <strong>Tab Recording:</strong> Records only the current browser
              tab
            </li>
            <li>
              • <strong>Desktop Recording:</strong> Records entire screen or
              selected window
            </li>
            <li>
              • <strong>Audio:</strong> May require additional permissions
            </li>
            <li>
              • <strong>Performance:</strong> Lower quality settings use less
              resources
            </li>
            <li>
              • <strong>Storage:</strong> Videos will be uploaded to S3 after
              recording
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
