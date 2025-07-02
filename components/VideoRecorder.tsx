// components/VideoRecorder.tsx - Simple & clean like Loom
import React, { useState, useEffect, useRef } from "react";
import { FaCircle, FaPlay, FaPause, FaStop, FaTimes } from "react-icons/fa";

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
  const [videoOptions] = useState<VideoOptions>({
    type: "desktop",
    format: "webm",
    quality: "medium",
    maxDuration: 600, // 10 minutes
    includeAudio: false,
    ...defaultOptions,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const hasAutoStarted = useRef(false);

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
    recordingControls?.pause();
  };

  const handleResumeRecording = () => {
    recordingControls?.resume();
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
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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

  // Completed State
  if (recordingState.status === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-2xl font-medium text-gray-900 mb-2">
            Recording complete!
          </h3>
          <p className="text-gray-600 mb-4">
            {videoService.formatDuration(recordingState.duration)} •{" "}
            {videoService.formatFileSize(recordingState.size)}
          </p>
          <p className="text-blue-600 font-medium">Opening preview...</p>
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
