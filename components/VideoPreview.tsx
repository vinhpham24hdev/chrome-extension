// components/VideoPreview.tsx - Enhanced with case form interface like screenshot preview
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

  // Case form state
  const [caseForm, setCaseForm] = useState({
    name: `Video Recording - ${new Date().toLocaleDateString()}`,
    description: "",
    url: window.location.href || "",
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null);

  // Auto-play video when loaded
  useEffect(() => {
    const video = videoRef.current;
    if (video && video.src) {
      // Try to autoplay
      video.play().catch(error => {
        console.log('Autoplay prevented:', error);
        // Autoplay was prevented, user will need to click play
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

  const handleFormChange = (field: keyof typeof caseForm, value: string) => {
    setCaseForm(prev => ({
      ...prev,
      [field]: value
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
      {/* Main Preview Window - Full Screen Layout */}
      <div className="fixed inset-0 bg-gray-900 flex flex-col z-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">Video Preview</h1>
            <span className="ml-4 text-sm text-gray-500">
              Snapshot {snapshotId}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex">
          {/* Video Preview Area */}
          <div className="flex-1 bg-black flex items-center justify-center p-8">
            <div className="relative w-full h-full max-w-4xl">
              <video
                ref={videoRef}
                src={video.dataUrl}
                className="w-full h-full object-contain"
                controls={false}
                preload="metadata"
                onClick={togglePlayPause}
              />

              {/* Modern Control Bar */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent p-6">
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max={video.duration}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1 bg-gray-600 rounded-full appearance-none cursor-pointer 
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 
                        [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg
                        [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full 
                        [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer"
                    />
                    <div className="absolute -top-8 left-0 text-xs text-gray-300">
                      {formatDuration(currentTime)} / {formatDuration(video.duration)}
                    </div>
                  </div>

                  {/* Control Buttons Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {/* Play/Pause Button */}
                      <button
                        onClick={togglePlayPause}
                        className="group flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white 
                          px-4 py-2 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl"
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          {isPlaying ? (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium">
                          {isPlaying ? "Pause" : "Play"}
                        </span>
                      </button>

                      {/* Volume Control */}
                      <div className="flex items-center space-x-2 bg-black/40 rounded-full px-3 py-2">
                        <button onClick={() => setVolume(volume > 0 ? 0 : 1)}>
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                            {volume > 0.5 ? (
                              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                            ) : volume > 0 ? (
                              <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
                            ) : (
                              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                            )}
                          </svg>
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={handleVolumeChange}
                          className="w-16 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {/* Speed Control */}
                      <div className="bg-black/40 rounded-full px-3 py-2">
                        <select
                          value={playbackRate}
                          onChange={(e) =>
                            handlePlaybackRateChange(parseFloat(e.target.value))
                          }
                          className="bg-transparent text-white text-sm border-none outline-none cursor-pointer"
                        >
                          <option value={0.5} className="bg-gray-800">0.5x</option>
                          <option value={1} className="bg-gray-800">1x</option>
                          <option value={1.25} className="bg-gray-800">1.25x</option>
                          <option value={1.5} className="bg-gray-800">1.5x</option>
                          <option value={2} className="bg-gray-800">2x</option>
                        </select>
                      </div>

                      {/* Fullscreen Button */}
                      <button
                        onClick={toggleFullscreen}
                        className="bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-all duration-200"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Details Panel */}
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col">{/* Increased from w-96 to w-80 for better proportion */}
            {/* Upload Status */}
            {(uploadState.isUploading || uploadState.progress || uploadState.result || uploadState.error) && (
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                {uploadState.isUploading && uploadState.progress && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-600 font-medium">
                        Uploading... {uploadState.progress.percentage}%
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
                  </div>
                )}

                {uploadState.result && (
                  <div className="flex items-center text-sm text-green-600">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
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
            <div className="flex-1 p-6 space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Details</h3>
                
                <div className="space-y-4">
                  {/* Name Field */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={caseForm.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter video name"
                    />
                  </div>

                  {/* Description Field */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      id="description"
                      rows={3}
                      value={caseForm.description}
                      onChange={(e) => handleFormChange('description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter video description"
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
                      value={caseForm.url}
                      onChange={(e) => handleFormChange('url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              {/* Video Info */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Video Information</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Case:</span>
                    <span className="font-medium">{video.caseId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="font-medium">{formatDuration(video.duration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Size:</span>
                    <span className="font-medium">{formatFileSize(video.size)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recorded:</span>
                    <span className="font-medium">{formatTimestamp(video.timestamp)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Filename:</span>
                    <span className="font-medium truncate">{video.filename}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="space-y-3">
                <button
                  onClick={handleAddToCase}
                  disabled={uploadState.isUploading || !caseForm.name.trim()}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {uploadState.isUploading ? 'Adding to Case...' : 'Add to case'}
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleDownload}
                    disabled={uploadState.isUploading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Download
                  </button>

                  <button
                    onClick={onRetake}
                    disabled={uploadState.isUploading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Retake
                  </button>
                </div>

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
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Fullscreen info overlay */}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded">
              <p className="text-sm">{video.filename}</p>
              <p className="text-xs opacity-75">
                {formatDuration(video.duration)} • {formatFileSize(video.size)} • {formatTimestamp(video.timestamp)}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}