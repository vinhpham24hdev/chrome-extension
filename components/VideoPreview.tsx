// components/VideoPreview.tsx - Enhanced with larger video and better controls
import React, { useState, useRef, useEffect } from "react";
import {
  FaPlay,
  FaPause,
  FaVolumeHigh,
  FaVolumeLow,
  FaVolumeXmark,
} from "react-icons/fa6";
import { FaExpandAlt } from "react-icons/fa";

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

  // Case form state
  const [caseForm, setCaseForm] = useState({
    name: `Video Recording - ${new Date().toLocaleDateString()}`,
    description: "",
    url: window.location.href || "",
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(
    null
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null);

  // Auto-play video when loaded
  useEffect(() => {
    const video = videoRef.current;
    if (video && video.src) {
      // Try to autoplay
      video.play().catch((error) => {
        console.log("Autoplay prevented:", error);
      });
    }
  }, [video.dataUrl]);

  // Generate unique snapshot ID based on timestamp
  const snapshotId = `${Date.now().toString().slice(-8)}`;

  // Sync video controls
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      // Auto-play when metadata is loaded
      video.play().catch(() => {
        // Ignore autoplay errors
      });
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, []);

  // Auto-hide controls
  const handleMouseActivity = () => {
    setShowControls(true);
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
    const timeout = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
    setControlsTimeout(timeout);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
    };
  }, [controlsTimeout]);

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
            caseName: caseForm.name,
            caseDescription: caseForm.description,
            caseUrl: caseForm.url,
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

  const handleFormChange = (field: keyof typeof caseForm, value: string) => {
    setCaseForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddToCase = async () => {
    if (!caseForm.name.trim()) {
      alert("Please enter a name for this video");
      return;
    }

    // Automatically upload to S3 when adding to case
    await handleUploadToS3();

    // Call the onSave callback
    onSave();
  };

  return (
    <>
      {/* Main Preview Window - Enhanced Layout */}
      <div className="fixed inset-0 bg-gray-900 flex flex-col z-50">
        {/* Header - Compact */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center">
            <h1 className="text-lg font-semibold text-gray-900">
              Video Preview
            </h1>
            <span className="ml-3 text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              #{snapshotId}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
          >
            <svg
              className="w-5 h-5"
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

        <div className="flex-1 flex min-h-0">
          {/* Video Preview Area - Much Larger */}
          <div
            className="flex-1 bg-black flex items-center justify-center relative"
            onMouseMove={handleMouseActivity}
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => {
              if (isPlaying) {
                const timeout = setTimeout(() => setShowControls(false), 1000);
                setControlsTimeout(timeout);
              }
            }}
          >
            <div className="relative w-full h-full max-w-none">
              <video
                ref={videoRef}
                src={video.dataUrl}
                className="w-full h-full object-contain cursor-pointer"
                controls={false}
                preload="metadata"
                onClick={togglePlayPause}
              />

              {/* Enhanced Control Overlay */}
              <div
                className={`w-full absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-6 transition-opacity duration-300 ${
                  showControls ? "opacity-100" : "opacity-0"
                }`}
              >
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-white mb-2">
                    <span>{formatDuration(currentTime)}</span>
                    <span>{formatDuration(video.duration)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={video.duration}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer 
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white 
          [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg
          [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500
          [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full 
          [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500
          [&::-moz-range-thumb]:cursor-pointer"
                  />
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Play/Pause Button - using react-icons */}
                  
                      {isPlaying ? (
                        <FaPause onClick={togglePlayPause} className="w-6 h-6 text-white" />
                      ) : (
                        <FaPlay onClick={togglePlayPause} className="w-6 h-6 ml-1 text-white" />
                      )}

                    {/* Volume Control */}
                    <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
                        {volume === 0 ? (
                          <FaVolumeXmark onClick={() => setVolume(volume > 0 ? 0 : 1)} className="w-6 h-6 text-white" />
                        ) : volume > 0.5 ? (
                          <FaVolumeHigh onClick={() => setVolume(volume > 0 ? 0 : 1)} className="w-6 h-6 text-white" />
                        ) : (
                          <FaVolumeLow onClick={() => setVolume(volume > 0 ? 0 : 1)} className="w-6 h-6 text-white" />
                        )}
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                      />
                    </div>

                    {/* Video Info */}
                    <div className="text-white text-sm bg-black/40 backdrop-blur-sm rounded-full px-3 py-2 border border-white/20">
                      {formatFileSize(video.size)}
                    </div>
                  </div>

                  {/* Right Side Controls */}
                  <div className="flex items-center space-x-3">
                    {/* Fullscreen Button */}
                    <FaExpandAlt onClick={toggleFullscreen} className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Details Panel - Reduced Width */}
          <div className="w-72 bg-white border-l border-gray-200 flex flex-col flex-shrink-0">
            {/* Upload Status */}
            {(uploadState.isUploading ||
              uploadState.progress ||
              uploadState.result ||
              uploadState.error) && (
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                {uploadState.isUploading && uploadState.progress && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-600 font-medium">
                        Uploading... {uploadState.progress.percentage}%
                      </span>
                      <span className="text-gray-500">
                        {uploadState.progress.speed &&
                          `${Math.round(
                            uploadState.progress.speed / 1024
                          )} KB/s`}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadState.progress.percentage}%` }}
                      ></div>
                    </div>
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
                    <span className="font-medium">Successfully uploaded</span>
                  </div>
                )}

                {uploadState.error && (
                  <div className="text-sm text-red-600">
                    <span>Upload failed: {uploadState.error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Details Form */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Details
                </h3>

                <div className="space-y-4">
                  {/* Name Field */}
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={caseForm.name}
                      onChange={(e) => handleFormChange("name", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Enter video name"
                    />
                  </div>

                  {/* Description Field */}
                  <div>
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Description
                    </label>
                    <textarea
                      id="description"
                      rows={3}
                      value={caseForm.description}
                      onChange={(e) =>
                        handleFormChange("description", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Enter video description"
                    />
                  </div>

                  {/* URL Field */}
                  <div>
                    <label
                      htmlFor="url"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      URL
                    </label>
                    <input
                      type="url"
                      id="url"
                      value={caseForm.url}
                      onChange={(e) => handleFormChange("url", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              {/* Video Info */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Video Information
                </h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Case:</span>
                    <span className="font-medium text-blue-600">
                      {video.caseId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="font-medium">
                      {formatDuration(video.duration)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Size:</span>
                    <span className="font-medium">
                      {formatFileSize(video.size)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recorded:</span>
                    <span className="font-medium">
                      {formatTimestamp(video.timestamp)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500">Filename:</span>
                    <span className="font-medium text-xs break-all">
                      {video.filename}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex w-full justify-between">
                <button
                  onClick={handleAddToCase}
                  disabled={uploadState.isUploading || !caseForm.name.trim()}
                  className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-md transition-colors font-medium"
                >
                  {uploadState.isUploading
                    ? "Adding to Case..."
                    : "Add to case"}
                </button>

                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
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
          </div>
        </div>
      )}
    </>
  );
}
