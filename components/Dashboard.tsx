// components/Dashboard.tsx - Cellebrite Style UI
import React, { useState } from "react";
import Box from "@mui/material/Box";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select, { SelectChangeEvent } from "@mui/material/Select";

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
import ToolsGrid from "./ToolsGrid";

import logo from "@/assets/logo.png";

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
  const [selectedCase, setSelectedCase] = useState<string>(mockCases[0].id);
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
  const [logoUrl, setLogoUrl] = useState(logo);

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
    <div className="w-[402px] h-[380px] bg-white flex flex-col p-4">
      {/* Header */}
      <div className="bg-white p-4 flex items-start">
        <div className="flex justify-center items-center flex-1">
          {/* Cellebrite Logo */}
          <div className="flex flex-col items-center">
            {logoUrl && (
              <img src={logoUrl} alt="Cellebrite Logo" className="w-2/3" />
            )}
            <p className="text-xl text-gray-500">My insights</p>
          </div>
        </div>
        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
          JD
        </div>
      </div>
      <div className="flex justify-center">
        <p className="text-sm text-gray-800">
          Select your case. Captured data will wait for you there
        </p>
      </div>
      {/* Case Selector */}
      <Box sx={{ marginTop: 2, padding: 2 }}>
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
      {/* Capture Mode Selector */}
      <ToolsGrid />
      {/* Screenshot Preview */}
      <div className="flex justify-center mt-4">
        <button className="w-[176px] bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed">
          View Report
        </button>
      </div>
    </div>
  );
}
