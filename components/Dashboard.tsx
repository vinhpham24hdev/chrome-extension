// components/Dashboard.tsx
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  screenshotService,
  ScreenshotResult,
} from "../services/screenshotService";
import { videoService, VideoResult } from "../services/videoService";
import RegionSelector, { RegionSelection } from "./RegionSelector";
import ScreenshotPreview, { ScreenshotData } from "./ScreenshotPreview";
import VideoRecorder from "./VideoRecorder";
import VideoPreview, { VideoData } from "./VideoPreview";

interface CaseItem {
  id: string;
  title: string;
  status: "active" | "pending" | "closed";
  createdAt: string;
}

// Mock case data
const mockCases: CaseItem[] = [
  {
    id: "CASE-001",
    title: "Website Bug Investigation",
    status: "active",
    createdAt: "2024-06-10",
  },
  {
    id: "CASE-002",
    title: "Performance Issue Analysis",
    status: "pending",
    createdAt: "2024-06-09",
  },
  {
    id: "CASE-003",
    title: "User Experience Review",
    status: "active",
    createdAt: "2024-06-08",
  },
  {
    id: "CASE-004",
    title: "Security Audit Report",
    status: "closed",
    createdAt: "2024-06-07",
  },
];

export default function Dashboard() {
  const { state, logout } = useAuth();
  const [selectedCase, setSelectedCase] = useState<string>("");
  const [captureMode, setCaptureMode] = useState<"screenshot" | "video" | null>(
    null
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [showRegionSelector, setShowRegionSelector] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string>("");
  const [screenshotPreview, setScreenshotPreview] =
    useState<ScreenshotData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [videoPreview, setVideoPreview] = useState<VideoData | null>(null);

  const handleLogout = async () => {
    await logout();
  };

  const handleCaseSelect = (caseId: string) => {
    setSelectedCase(caseId);
  };

  const handleScreenshot = async (
    type: "full" | "visible" | "region" = "visible"
  ) => {
    if (!selectedCase) {
      alert("Please select a case first");
      return;
    }

    setIsCapturing(true);
    setCaptureMode("screenshot");

    try {
      let result: ScreenshotResult;

      if (type === "region") {
        // First capture full screen for region selection
        result = await screenshotService.captureFullScreen({
          type: "full",
          format: "png",
        });

        if (result.success && result.dataUrl) {
          setFullScreenImage(result.dataUrl);
          setShowRegionSelector(true);
          setIsCapturing(false);
          return;
        }
      } else {
        // Capture full screen or visible area
        result = await screenshotService.captureFullScreen({
          type: type,
          format: "png",
        });
      }

      if (result.success && result.dataUrl && result.filename) {
        const screenshotData: ScreenshotData = {
          dataUrl: result.dataUrl,
          filename: result.filename,
          timestamp: new Date().toISOString(),
          type: `screenshot-${type}`,
          caseId: selectedCase,
          blob: result.blob,
        };

        setScreenshotPreview(screenshotData);
      } else {
        alert(result.error || "Screenshot capture failed");
      }
    } catch (error) {
      console.error("Screenshot error:", error);
      alert("Screenshot capture failed");
    }

    setIsCapturing(false);
  };

  const handleRegionSelect = async (region: RegionSelection) => {
    setShowRegionSelector(false);
    setIsCapturing(true);

    try {
      const result = await screenshotService.captureRegion(region, {
        format: "png",
      });

      if (result.success && result.dataUrl && result.filename) {
        const screenshotData: ScreenshotData = {
          dataUrl: result.dataUrl,
          filename: result.filename,
          timestamp: new Date().toISOString(),
          type: "screenshot-region",
          caseId: selectedCase,
          blob: result.blob,
        };

        setScreenshotPreview(screenshotData);
      } else {
        alert(result.error || "Region capture failed");
      }
    } catch (error) {
      console.error("Region capture error:", error);
      alert("Region capture failed");
    }

    setIsCapturing(false);
    setFullScreenImage("");
  };

  const handleSaveScreenshot = async () => {
    if (!screenshotPreview) return;

    setIsUploading(true);

    try {
      // Save to Chrome storage
      const result: ScreenshotResult = {
        success: true,
        dataUrl: screenshotPreview.dataUrl,
        filename: screenshotPreview.filename,
        blob: screenshotPreview.blob,
      };

      const saved = await screenshotService.saveToStorage(result, selectedCase);

      if (saved) {
        alert("Screenshot saved successfully!");
        setScreenshotPreview(null);
        setCaptureMode(null);
      } else {
        alert("Failed to save screenshot");
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save screenshot");
    }

    setIsUploading(false);
  };

  const handleDownloadScreenshot = () => {
    if (!screenshotPreview) return;

    screenshotService.downloadScreenshot(
      screenshotPreview.dataUrl,
      screenshotPreview.filename
    );
  };

  const handleRetakeScreenshot = () => {
    setScreenshotPreview(null);
    setCaptureMode(null);
  };

  const handleCancelRegionSelection = () => {
    setShowRegionSelector(false);
    setFullScreenImage("");
    setIsCapturing(false);
    setCaptureMode(null);
  };

  const handleVideoCapture = () => {
    if (!selectedCase) {
      alert("Please select a case first");
      return;
    }

    setCaptureMode("video");
    setShowVideoRecorder(true);
  };

  const handleVideoRecorded = (result: VideoResult) => {
    if (result.success && result.blob && result.dataUrl && result.filename) {
      const videoData: VideoData = {
        blob: result.blob,
        dataUrl: result.dataUrl,
        filename: result.filename,
        duration: result.duration || 0,
        size: result.size || result.blob.size,
        timestamp: new Date().toISOString(),
        caseId: selectedCase,
      };

      setVideoPreview(videoData);
      setShowVideoRecorder(false);
    } else {
      alert(result.error || "Video recording failed");
      setShowVideoRecorder(false);
      setCaptureMode(null);
    }
  };

  const handleSaveVideo = async () => {
    if (!videoPreview) return;

    setIsUploading(true);

    try {
      // Save to Chrome storage or download
      videoService.downloadVideo(videoPreview.blob, videoPreview.filename);

      alert("Video saved successfully!");
      setVideoPreview(null);
      setCaptureMode(null);
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save video");
    }

    setIsUploading(false);
  };

  const handleDownloadVideo = () => {
    if (!videoPreview) return;
    videoService.downloadVideo(videoPreview.blob, videoPreview.filename);
  };

  const handleRetakeVideo = () => {
    setVideoPreview(null);
    setShowVideoRecorder(true);
  };

  const handleCloseVideoRecorder = () => {
    setShowVideoRecorder(false);
    setCaptureMode(null);
  };

  const handleCloseVideoPreview = () => {
    setVideoPreview(null);
    setCaptureMode(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">📸</div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Screen Capture Tool
                </h1>
                <p className="text-sm text-gray-500">
                  Welcome back, {state.user?.username}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Case Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Select Case
              </h2>

              {/* Case Dropdown */}
              <div className="mb-4">
                <label
                  htmlFor="case-select"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Choose a case to work on:
                </label>
                <select
                  id="case-select"
                  value={selectedCase}
                  onChange={(e) => handleCaseSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a case...</option>
                  {mockCases.map((case_) => (
                    <option key={case_.id} value={case_.id}>
                      {case_.id} - {case_.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Case List */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">
                  Available Cases:
                </h3>
                {mockCases.map((case_) => (
                  <div
                    key={case_.id}
                    onClick={() => handleCaseSelect(case_.id)}
                    className={`p-3 border rounded-md cursor-pointer transition-colors duration-200 ${
                      selectedCase === case_.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{case_.id}</span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          case_.status
                        )}`}
                      >
                        {case_.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{case_.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Created: {case_.createdAt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Capture Tools */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Capture Tools
              </h2>

              {!selectedCase ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎯</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select a Case First
                  </h3>
                  <p className="text-gray-500">
                    Choose a case from the left panel to enable capture tools.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Selected Case Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <h3 className="font-medium text-blue-900">
                      Working on: {selectedCase}
                    </h3>
                    <p className="text-sm text-blue-700 mt-1">
                      {mockCases.find((c) => c.id === selectedCase)?.title}
                    </p>
                  </div>

                  {/* Capture Options */}
                  <div className="grid grid-cols-1 gap-4">
                    {/* Screenshot Section */}
                    <div className="border border-gray-200 rounded-lg p-6">
                      <div className="text-center mb-4">
                        <div className="text-4xl mb-2">📷</div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Screenshot Capture
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Capture screenshots with different options
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                          onClick={() => handleScreenshot("visible")}
                          disabled={isCapturing}
                          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {isCapturing && captureMode === "screenshot"
                            ? "Capturing..."
                            : "Visible Area"}
                        </button>

                        <button
                          onClick={() => handleScreenshot("full")}
                          disabled={isCapturing}
                          className="bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Full Screen
                        </button>

                        <button
                          onClick={() => handleScreenshot("region")}
                          disabled={isCapturing}
                          className="bg-purple-500 hover:bg-purple-600 text-white py-2 px-3 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Select Region
                        </button>
                      </div>
                    </div>

                    {/* Video Recording */}
                    <div className="border border-gray-200 rounded-lg p-6">
                      <div className="text-center mb-4">
                        <div className="text-4xl mb-2">🎥</div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Video Recording
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Record browser tab or screen activity
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          onClick={handleVideoCapture}
                          disabled={isCapturing || showVideoRecorder}
                          className="bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {showVideoRecorder
                            ? "Recording..."
                            : "Start Recording"}
                        </button>

                        <button
                          onClick={() => alert("Screen recording coming soon!")}
                          disabled={isCapturing || showVideoRecorder}
                          className="bg-purple-500 hover:bg-purple-600 text-white py-2 px-3 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Screen Recording
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Capture Status */}
                  {(isCapturing || captureMode) &&
                    !screenshotPreview &&
                    !videoPreview && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                        <div className="flex items-center">
                          <div className="text-yellow-600 mr-3">
                            {isCapturing ? (
                              <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : captureMode === "screenshot" ? (
                              "📷"
                            ) : (
                              "🎥"
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium text-yellow-900">
                              {isCapturing
                                ? `${
                                    captureMode === "screenshot"
                                      ? "Screenshot"
                                      : "Video"
                                  } capture in progress...`
                                : `${
                                    captureMode === "screenshot"
                                      ? "Screenshot"
                                      : "Video"
                                  } capture initiated`}
                            </h4>
                            <p className="text-sm text-yellow-700">
                              This will be saved to case: {selectedCase}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Future Features Preview */}
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                      Coming Soon:
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm text-gray-500">
                      <div className="flex items-center">
                        <span className="mr-2">☁️</span>
                        Auto-upload to S3
                      </div>
                      <div className="flex items-center">
                        <span className="mr-2">🔍</span>
                        Search captured files
                      </div>
                      <div className="flex items-center">
                        <span className="mr-2">📊</span>
                        Generate reports
                      </div>
                      <div className="flex items-center">
                        <span className="mr-2">🏷️</span>
                        Tag and organize
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Region Selector Modal */}
      {showRegionSelector && fullScreenImage && (
        <RegionSelector
          imageUrl={fullScreenImage}
          onRegionSelect={handleRegionSelect}
          onCancel={handleCancelRegionSelection}
        />
      )}

      {/* Screenshot Preview Modal */}
      {screenshotPreview && (
        <ScreenshotPreview
          screenshot={screenshotPreview}
          onSave={handleSaveScreenshot}
          onDownload={handleDownloadScreenshot}
          onRetake={handleRetakeScreenshot}
          onClose={() => setScreenshotPreview(null)}
          isUploading={isUploading}
        />
      )}

      {/* Video Recorder Modal */}
      {showVideoRecorder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full mx-4 overflow-y-auto">
            <div className="p-6">
              <VideoRecorder
                caseId={selectedCase}
                onVideoCapture={handleVideoRecorded}
                onClose={handleCloseVideoRecorder}
              />
            </div>
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      {videoPreview && (
        <VideoPreview
          video={videoPreview}
          onSave={handleSaveVideo}
          onDownload={handleDownloadVideo}
          onRetake={handleRetakeVideo}
          onClose={handleCloseVideoPreview}
          isUploading={isUploading}
        />
      )}
    </div>
  );
}
