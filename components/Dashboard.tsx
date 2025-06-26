// components/Dashboard.tsx - Updated to fix modal container issues
import React, { useState } from "react";
import Box from "@mui/material/Box";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select, { SelectChangeEvent } from "@mui/material/Select";

import { useAuth } from "../contexts/AuthContext";
import { screenshotService, ScreenshotResult } from "../services/screenshotService";
import { videoService, VideoResult } from "../services/videoService";
import RegionSelector, { RegionSelection } from "./RegionSelector";
import ScreenshotPreview, { ScreenshotData } from "./ScreenshotPreview";
import VideoRecorder from "./VideoRecorder";
import VideoPreview, { VideoData } from "./VideoPreview";

import logo from "@/assets/logo.png";

interface CaseItem {
  id: string;
  title: string;
  status: "active" | "pending" | "closed";
  createdAt: string;
}

// Updated mock cases to match Figma format
const mockCases: CaseItem[] = [
  {
    id: "Case-120320240830",
    title: "Website Bug Investigation",
    status: "active",
    createdAt: "2024-06-10",
  },
  {
    id: "Case-120320240829", 
    title: "Performance Issue Analysis",
    status: "pending",
    createdAt: "2024-06-09",
  },
  {
    id: "Case-120320240828",
    title: "User Experience Review", 
    status: "active",
    createdAt: "2024-06-08",
  },
];

export default function Dashboard() {
  const { state, logout } = useAuth();
  const [selectedCase, setSelectedCase] = useState<string>(mockCases[0].id);
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

  const handleScreenshot = async (type: "screen" | "full" | "region" = "screen") => {
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
        // Capture screen or full page
        const captureType = type === "screen" ? "visible" : "full";
        result = await screenshotService.captureFullScreen({
          type: captureType,
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

  const handleVideoCapture = (type: "video" | "r-video" = "video") => {
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

  return (
    <>
      {/* Main Dashboard Container */}
      <div className="w-[402px] h-[380px] bg-white flex flex-col">
        {/* Header with Cellebrite Logo */}
        <div className="bg-white p-4 flex items-center justify-between">
          <div className="flex justify-center items-start flex-1">
            {/* Cellebrite Logo */}
            <div className="flex flex-col items-center">
              {logo && <img src={logo} alt="Cellebrite Logo" className="w-2/3" />}
              <p className="text-xl text-gray-500">My insights</p>
            </div>
          </div>
          {/* User Avatar */}
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
            {state.user?.username?.substring(0, 2).toUpperCase() || "JD"}
          </div>
        </div>

        {/* Instruction Text */}
        <div className="px-6 text-center">
          <p className="text-sm text-gray-700">
            Select your case. Captured data will wait for you there
          </p>
        </div>

        {/* Case Selector */}
        <div className="p-6">
          <Box>
            <FormControl fullWidth>
              <InputLabel id="case-select-label">Case ID</InputLabel>
              <Select
                labelId="case-select-label"
                id="case-select"
                value={selectedCase}
                label="Select Case"
                onChange={(e: SelectChangeEvent<string>) =>
                  handleCaseSelect(e.target.value)
                }
              >
                {mockCases.map((caseItem) => (
                  <MenuItem key={caseItem.id} value={caseItem.id}>
                    <div className="flex justify-between items-center w-full">
                      <span>{caseItem.title}</span>
                    </div>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </div>
        
        {/* Capture Tools Grid */}
        <div className="px-6 py-2">
          <div className="flex items-start justify-between">
            {/* Screen Capture */}
            <button
              onClick={() => handleScreenshot("screen")}
              disabled={isCapturing || !selectedCase}
              className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <div className="w-8 h-6 border-2 border-gray-600 rounded-sm flex items-center justify-center">
                <div className="w-4 h-3 bg-gray-600 rounded-xs"></div>
              </div>
              <span className="text-xs text-gray-700">Screen</span>
            </button>

            {/* Full Page Capture */}
            <button
              onClick={() => handleScreenshot("full")}
              disabled={isCapturing || !selectedCase}
              className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <div className="w-8 h-6 border-2 border-gray-600 rounded-sm relative">
                <div className="w-6 h-4 bg-gray-600 rounded-xs absolute top-0.5 left-0.5"></div>
              </div>
              <span className="text-xs text-gray-700">Full</span>
            </button>

            {/* Region Capture */}
            <button
              onClick={() => handleScreenshot("region")}
              disabled={isCapturing || !selectedCase}
              className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <div className="w-8 h-6 border-2 border-gray-600 border-dashed rounded-sm"></div>
              <span className="text-xs text-gray-700">Region</span>
            </button>

            {/* Divider */}
            <div className="w-px h-8 bg-gray-300"></div>

            {/* Video Recording */}
            <button
              onClick={() => handleVideoCapture("video")}
              disabled={isCapturing || !selectedCase}
              className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative"
            >
              <div className="w-8 h-6 border-2 border-gray-600 rounded-sm flex items-center justify-center">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              </div>
              <span className="text-xs text-gray-700">Video</span>
            </button>

            {/* Region Video */}
            <button
              onClick={() => handleVideoCapture("r-video")}
              disabled={isCapturing || !selectedCase}
              className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative"
            >
              <div className="w-8 h-6 border-2 border-gray-600 border-dashed rounded-sm flex items-center justify-center">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              </div>
              <span className="text-xs text-gray-700">R.Video</span>
            </button>

            {/* More Options */}
            <button className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 transition-colors">
              <div className="w-4 h-6 flex flex-col justify-center items-center space-y-0.5">
                <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
              </div>
            </button>
          </div>
        </div>

        {/* View Report Button */}
        <div className="flex justify-center">
          <button className="w-[176px] bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed">
            View Report
          </button>
        </div>

        {/* Status indicator when capturing */}
        {isCapturing && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex flex-col items-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-700">Capturing...</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals - Rendered Outside Main Container */}
      {showRegionSelector && (
        <RegionSelector
          imageUrl={fullScreenImage}
          onRegionSelect={handleRegionSelect}
          onCancel={handleCancelRegionSelection}
        />
      )}

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

      {showVideoRecorder && (
        <VideoRecorder
          caseId={selectedCase}
          onVideoCapture={handleVideoRecorded}
          onClose={() => setShowVideoRecorder(false)}
        />
      )}

      {videoPreview && (
        <VideoPreview
          video={videoPreview}
          onSave={() => {}}
          onDownload={() => {}}
          onRetake={() => setVideoPreview(null)}
          onClose={() => setVideoPreview(null)}
        />
      )}
    </>
  );
}