// components/VideoPreview.tsx - Video Preview and Upload Component
import React, { useState, useRef, useEffect } from "react";
import { VideoResult } from "../services/videoService";
import { s3Service, UploadProgress, UploadResult } from "../services/s3Service";
import { caseService } from "../services/caseService";

export interface VideoData {
  blob: Blob;
  dataUrl: string;
  filename: string;
  duration: number;
  size: number;
  timestamp: string;
  caseId: string;
}

interface VideoPreviewProps {
  video: VideoData;
  onSave: () => void;
  onDownload: () => void;
  onRetake: () => void;
  onClose: () => void;
  isUploading?: boolean;
}

export default function VideoPreview({
  video,
  onSave,
  onDownload,
  onRetake,
  onClose,
  isUploading = false,
}: VideoPreviewProps) {
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
    error: null,
  });
  const [autoSave, setAutoSave] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null);

  // Auto-save on mount if enabled
  useEffect(() => {
    if (autoSave && !uploadState.isUploading && !uploadState.result) {
      handleUploadToS3();
    }
  }, [autoSave]);

  // Sync video controls
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Upload to S3
  const handleUploadToS3 = async () => {
    setUploadState({
      isUploading: true,
      progress: null,
      result: null,
      error: null,
    });

    try {
      const result = await s3Service.uploadFile(
        video.blob,
        video.filename,
        video.caseId,
        "video",
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

            // Update case metadata
            updateCaseMetadata(video.caseId);
          },
          onError: (error) => {
            setUploadState((prev) => ({
              ...prev,
              isUploading: false,
              error,
            }));
          },
          tags: ["video", "recording", "capture"],
          metadata: {
            capturedAt: video.timestamp,
            originalFilename: video.filename,
            duration: video.duration,
            captureType: "video-recording",
          },
        }
      );

      if (!result.success) {
        setUploadState((prev) => ({
          ...prev,
          isUploading: false,
          error: result.error || "Upload failed",
        }));
      }
    } catch (error) {
      setUploadState((prev) => ({
        ...prev,
        isUploading: false,
        error: error instanceof Error ? error.message : "Upload failed",
      }));
    }
  };

  // Update case metadata after successful upload
  const updateCaseMetadata = async (caseId: string) => {
    try {
      const caseData = await caseService.getCaseById(caseId);
      if (caseData && caseData.metadata) {
        await caseService.updateCaseMetadata(caseId, {
          totalVideos: (caseData.metadata.totalVideos || 0) + 1,
          totalFileSize: (caseData.metadata.totalFileSize || 0) + video.size,
          lastActivity: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Failed to update case metadata:", error);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const time = parseFloat(event.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    const video = videoRef.current;
    if (video) {
      video.volume = newVolume;
    }
    setVolume(newVolume);
  };

  const handlePlaybackRateChange = (rate: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
    }
    setPlaybackRate(rate);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(video.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = video.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Main Preview Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg overflow-y-auto shadow-xl max-w-5xl max-h-[90vh] w-full mx-4 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Video Preview
              </h2>
              <p className="text-sm text-gray-500">{video.filename}</p>
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
            </div>
          </div>

          {/* Upload Status */}
          {(uploadState.isUploading ||
            uploadState.progress ||
            uploadState.result ||
            uploadState.error) && (
            <div className="px-4 py-3 border-b bg-gray-50">
              {uploadState.isUploading && uploadState.progress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-600 font-medium">
                      Uploading to S3... {uploadState.progress.percentage}%
                    </span>
                    <span className="text-gray-500">
                      {uploadState.progress.speed &&
                        `${Math.round(uploadState.progress.speed / 1024)} KB/s`}
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
                      {Math.round(uploadState.progress.timeRemaining)} seconds
                      remaining
                    </div>
                  )}
                </div>
              )}

              {uploadState.result && (
                <div className="flex items-center text-sm text-green-600">
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="font-medium">
                    Successfully uploaded to S3
                  </span>
                  <button
                    onClick={() =>
                      window.open(uploadState.result!.fileUrl, "_blank")
                    }
                    className="ml-2 text-blue-600 hover:text-blue-800 underline"
                  >
                    View File
                  </button>
                </div>
              )}

              {uploadState.error && (
                <div className="flex items-center justify-between text-sm text-red-600">
                  <div className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
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

          {/* Video Info */}
          <div className="px-4 py-3 bg-gray-50 border-b">
            <div className="flex flex-wrap gap-6 text-sm text-gray-600">
              <div>
                <span className="font-medium">Case:</span> {video.caseId}
              </div>
              <div>
                <span className="font-medium">Duration:</span>{" "}
                {formatDuration(video.duration)}
              </div>
              <div>
                <span className="font-medium">Size:</span>{" "}
                {formatFileSize(video.size)}
              </div>
              <div>
                <span className="font-medium">Recorded:</span>{" "}
                {formatTimestamp(video.timestamp)}
              </div>
            </div>
          </div>

          {/* Video Player */}
          <div className="flex-1 p-4">
            <div className="relative bg-black rounded-lg overflow-hidden group">
              <video
                ref={videoRef}
                src={video.dataUrl}
                className="w-full h-auto max-h-96 cursor-pointer"
                onClick={togglePlayPause}
                preload="metadata"
              />

              {/* Custom Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="space-y-2">
                  {/* Progress Bar */}
                  <input
                    type="range"
                    min="0"
                    max={video.duration}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                  />

                  {/* Control Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={togglePlayPause}
                        className="text-white hover:text-gray-300 text-lg"
                      >
                        {isPlaying ? "⏸️" : "▶️"}
                      </button>

                      <span className="text-white text-sm">
                        {formatDuration(currentTime)} /{" "}
                        {formatDuration(video.duration)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      {/* Playback Speed */}
                      <select
                        value={playbackRate}
                        onChange={(e) =>
                          handlePlaybackRateChange(parseFloat(e.target.value))
                        }
                        className="bg-black/50 text-white text-xs border-gray-600 rounded"
                      >
                        <option value={0.5}>0.5x</option>
                        <option value={1}>1x</option>
                        <option value={1.25}>1.25x</option>
                        <option value={1.5}>1.5x</option>
                        <option value={2}>2x</option>
                      </select>

                      {/* Volume */}
                      <div className="flex items-center space-x-1">
                        <span className="text-white text-sm">🔊</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={handleVolumeChange}
                          className="w-16 h-1"
                        />
                      </div>

                      {/* Fullscreen */}
                      <button
                        onClick={toggleFullscreen}
                        className="text-white hover:text-gray-300"
                      >
                        ⛶
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t bg-gray-50">
            <div className="text-sm text-gray-600 mb-3">
              Click video to play/pause • Use controls for advanced playback
              options
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={onRetake}
                disabled={uploadState.isUploading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Record Again
              </button>

              <button
                onClick={handleDownload}
                disabled={uploadState.isUploading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Download</span>
              </button>

              <button
                onClick={onSave}
                disabled={uploadState.isUploading || !!uploadState.result}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-600 border border-transparent rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
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
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Uploaded</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
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
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-[60]">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <video
              ref={fullscreenVideoRef}
              src={video.dataUrl}
              controls
              className="max-w-full max-h-full object-contain"
              autoPlay={isPlaying}
            />

            {/* Close fullscreen button */}
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-70 transition-all"
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

            {/* Fullscreen info overlay */}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded">
              <p className="text-sm">{video.filename}</p>
              <p className="text-xs opacity-75">
                {formatDuration(video.duration)} • {formatFileSize(video.size)}{" "}
                • {formatTimestamp(video.timestamp)}
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
