// components/VideoRecorder.tsx - Updated for better integration with video preview window
import React, { useState, useEffect, useRef } from "react";
import { CiPause1 } from "react-icons/ci";
import { CiPlay1 } from "react-icons/ci";
import { CiStop1 } from "react-icons/ci";

import {
  videoService,
  VideoOptions,
  VideoResult,
  RecordingState,
  RecordingControls,
} from "../services/videoService";

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
  const [videoOptions, setVideoOptions] = useState<VideoOptions>({
    type: "tab",
    format: "webm",
    quality: "medium",
    maxDuration: 300,
    includeAudio: false,
    ...defaultOptions,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const hasAutoStarted = useRef(false);

  useEffect(() => {
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
      setCountdown(null);
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

        // Call callback - this will open the video preview window
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
    if (recordingState.isRecording) return;
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

      {/* Countdown Display */}
      {countdown && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-8xl font-bold text-white mb-4 animate-pulse">
              {countdown}
            </div>
            <div className="text-xl text-gray-300">
              Recording starts in {countdown}...
            </div>
            <div className="text-sm text-gray-400 mt-2">
              Position your screen and get ready!
            </div>
          </div>
        </div>
      )}

      {/* Initializing State */}
      {isInitializing && !countdown && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
            <div>
              <h4 className="font-medium text-blue-900">
                Waiting for Screen Share...
              </h4>
              <p className="text-sm text-blue-700">
                Please select what to share in the Chrome dialog, then click "Share"
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
        <div className="bg-gray-900 border border-red-500 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full mr-3 ${
                  recordingState.isPaused ? "bg-yellow-500" : "bg-red-500 animate-pulse"
                }`}
              ></div>
              <div>
                <div className="text-sm font-bold">
                  {recordingState.isPaused ? <CiPause1 /> : "🎥"}
                </div>
                <div className="text-xs text-gray-300 mt-1">
                  {videoService.formatDuration(recordingState.duration)} |{" "}
                  {videoService.formatFileSize(recordingState.size)}
                </div>
              </div>
            </div>

            <div className="text-xl">
              {recordingState.isPaused ? <CiPause1 /> : "🎥"}
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={handleStopRecording}
              disabled={recordingState.status === "stopping"}
              className="px-3 py-2 bg-red-600 border border-red-500 text-white hover:bg-red-700 text-sm rounded transition-all disabled:opacity-50 font-medium"
            >
              <CiStop1 />
            </button>

            {recordingState.isPaused ? (
              <button
                onClick={handleResumeRecording}
                className="px-3 py-2 bg-green-600 border border-green-500 hover:bg-green-700 text-sm rounded transition-all"
              >
                <CiPlay1 />
              </button>
            ) : (
              <button
                onClick={handlePauseRecording}
                className="px-3 py-2 bg-yellow-600 border border-yellow-500 hover:bg-yellow-700 text-sm rounded transition-all"
              >
                <CiPause1 />
              </button>
            )}

            <button
              onClick={handleCancelRecording}
              className="px-3 py-2 bg-gray-600 border border-gray-500 hover:bg-gray-700 text-sm rounded transition-all"
            >
              ❌
            </button>
          </div>
        </div>
      )}

      {/* Auto-start info */}
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

      {/* Recording Options (when not recording) */}
      {!recordingState.isRecording && !autoStart && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Recording Options</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={videoOptions.type}
                onChange={(e) => handleOptionsChange({ type: e.target.value as "tab" | "desktop" })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="tab">Current Tab</option>
                <option value="desktop">Desktop/Window</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quality
              </label>
              <select
                value={videoOptions.quality}
                onChange={(e) => handleOptionsChange({ quality: e.target.value as "low" | "medium" | "high" })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="low">Low (720p)</option>
                <option value="medium">Medium (1080p)</option>
                <option value="high">High (1440p)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Duration (minutes)
              </label>
              <select
                value={(videoOptions.maxDuration || 300) / 60}
                onChange={(e) => handleOptionsChange({ maxDuration: parseInt(e.target.value) * 60 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value={2}>2 minutes</option>
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={videoOptions.includeAudio || false}
                  onChange={(e) => handleOptionsChange({ includeAudio: e.target.checked })}
                  className="mr-2 rounded"
                />
                Include Audio
              </label>
            </div>
          </div>

          <button
            onClick={handleStartRecording}
            disabled={isInitializing}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            {isInitializing ? "Starting..." : "Start Recording"}
          </button>
        </div>
      )}

      {/* Video Preview (hidden, used for processing) */}
      {recordingState.status === "completed" && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Recording Complete</h4>
          <div className="bg-black rounded-lg overflow-hidden">
            <video
              ref={videoPreviewRef}
              className="w-full h-auto max-h-64 hidden"
              preload="metadata"
            >
              Your browser does not support video playback.
            </video>
          </div>

          <div className="mt-3 text-sm text-gray-600 text-center">
            Duration: {videoService.formatDuration(recordingState.duration)} |
            Size: {videoService.formatFileSize(recordingState.size)}
            <br />
            <span className="text-blue-600">Opening preview window...</span>
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
              • <strong>Storage:</strong> Videos will be processed in a separate preview window
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}