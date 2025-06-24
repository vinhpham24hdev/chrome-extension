// components/Dashboard.tsx - Cellebrite Style UI
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
  const [captureMode, setCaptureMode] = useState<"screenshot" | "video" | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showRegionSelector, setShowRegionSelector] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string>("");
  const [screenshotPreview, setScreenshotPreview] = useState<ScreenshotData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [videoPreview, setVideoPreview] = useState<VideoData | null>(null);

  const handleLogout = async () => {
    await logout();
  };

  const handleCaseSelect = (caseId: string) => {
    setSelectedCase(caseId);
  };

  const handleScreenshot = async (type: "full" | "visible" | "region" = "visible") => {
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
    <div className="w-[400px] h-[600px] bg-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {/* Cellebrite Logo */}
            <div className="flex items-center space-x-1 mr-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Cellebrite</h1>
              <p className="text-xs text-gray-500">My insights</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            Logout
          </button>
        </div>
      </div>

      {/* User Info */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <p className="text-sm text-gray-600">
          Welcome back, <span className="font-medium">{state.user?.username}</span>
        </p>
      </div>

      {/* Case Selection */}
      <div className="px-4 py-3 border-b border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Active Case:
        </label>
        <select
          value={selectedCase}
          onChange={(e) => handleCaseSelect(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select a case...</option>
          {mockCases.map((case_) => (
            <option key={case_.id} value={case_.id}>
              {case_.id} - {case_.title}
            </option>
          ))}
        </select>

        {selectedCase && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
            <span className="font-medium text-blue-900">
              {mockCases.find(c => c.id === selectedCase)?.title}
            </span>
          </div>
        )}
      </div>

      {/* Capture Tools */}
      <div className="flex-1 p-4">
        {!selectedCase ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              Select a Case First
            </h3>
            <p className="text-xs text-gray-500">
              Choose a case to enable capture tools.
            </p>
          </div>
        ) : (
          <div>
            {/* Capture Status */}
            {(isCapturing || captureMode) && !screenshotPreview && !videoPreview && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <div className="flex items-center">
                  <div className="text-yellow-600 mr-3">
                    {isCapturing ? (
                      <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : captureMode === "screenshot" ? (
                      "📷"
                    ) : (
                      "🎥"
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-yellow-900">
                      {isCapturing
                        ? `${captureMode === "screenshot" ? "Screenshot" : "Video"} capture in progress...`
                        : `${captureMode === "screenshot" ? "Screenshot" : "Video"} capture initiated`}
                    </h4>
                  </div>
                </div>
              </div>
            )}

            {/* Main Capture Grid */}
            <div className="grid grid-cols-3 gap-3">
              {/* Screen Capture */}
              <button
                onClick={() => handleScreenshot("visible")}
                disabled={isCapturing}
                className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-lg">
                  📱
                </div>
                <span className="text-xs text-gray-600 font-medium">Screen</span>
              </button>

              {/* Full Screen */}
              <button
                onClick={() => handleScreenshot("full")}
                disabled={isCapturing}
                className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-lg">
                  🖥️
                </div>
                <span className="text-xs text-gray-600 font-medium">Full</span>
              </button>

              {/* Region */}
              <button
                onClick={() => handleScreenshot("region")}
                disabled={isCapturing}
                className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-lg">
                  ✂️
                </div>
                <span className="text-xs text-gray-600 font-medium">Region</span>
              </button>

              {/* Video */}
              <button
                onClick={handleVideoCapture}
                disabled={isCapturing || showVideoRecorder}
                className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-lg">
                  🎥
                </div>
                <span className="text-xs text-gray-600 font-medium">Video</span>
              </button>

              {/* R. Video */}
              <button
                onClick={() => alert("Real-time video capture coming soon!")}
                disabled={isCapturing || showVideoRecorder}
                className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-lg">
                  📹
                </div>
                <span className="text-xs text-gray-600 font-medium">R. Video</span>
              </button>

              {/* More Options */}
              <button
                disabled
                className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-lg opacity-50 cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-lg">
                  ➕
                </div>
                <span className="text-xs text-gray-400 font-medium">More</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h4>
              <div className="space-y-2">
                <button className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-md transition-colors">
                  📊 View Case Files
                </button>
                <button className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-md transition-colors">
                  📈 Generate Report
                </button>
                <button className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-md transition-colors">
                  ⚙️ Settings
                </button>
              </div>
            </div>
          </div>
        )}
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
                onClose={() => setShowVideoRecorder(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      {videoPreview && (
        <VideoPreview
          video={videoPreview}
          onSave={async () => {}}
          onDownload={() => {}}
          onRetake={() => setShowVideoRecorder(true)}
          onClose={() => setVideoPreview(null)}
          isUploading={isUploading}
        />
      )}
    </div>
  );
}