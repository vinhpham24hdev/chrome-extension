// components/Dashboard.tsx - Updated to use tab-based region selector
import React, { useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select, { SelectChangeEvent } from "@mui/material/Select";

import { useAuth } from "../contexts/AuthContext";
import { screenshotService, ScreenshotResult } from "../services/screenshotService";
import { videoService, VideoResult, VideoOptions } from "../services/videoService";
import { screenshotWindowService } from "../services/screenshotWindowService";
import { videoWindowService } from "../services/videoWindowService";
import { videoRecorderWindowService } from "../services/videoRecorderWindowService";
import { regionSelectorService, RegionSelection } from "../services/regionSelectorService";
import ScreenshotPreview, { ScreenshotData } from "./ScreenshotPreview";

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
  const [screenshotPreview, setScreenshotPreview] = useState<ScreenshotData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // User dropdown state
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Setup region selector service listeners (NEW - Tab based)
  useEffect(() => {
    regionSelectorService.onRegionSelected((region) => {
      handleRegionSelectFromService(region);
    });

    regionSelectorService.onCancelled(() => {
      setIsCapturing(false);
      setCaptureMode(null);
      console.log('Region selection cancelled in tab');
    });

    return () => {
      // Cleanup handled by service
    };
  }, [selectedCase]);

  // Setup screenshot window service listeners
  useEffect(() => {
    screenshotWindowService.addListener('window_closed', () => {
      setScreenshotPreview(null);
      setCaptureMode(null);
      console.log('Screenshot preview window closed');
    });

    screenshotWindowService.addListener('save_screenshot', async (screenshotData: ScreenshotData) => {
      if (screenshotData) {
        console.log('Save screenshot request from preview window');
        await handleSaveScreenshotFromWindow(screenshotData);
      }
    });

    screenshotWindowService.addListener('retake_screenshot', () => {
      console.log('Retake screenshot request from preview window');
      setScreenshotPreview(null);
      setCaptureMode(null);
    });

    return () => {
      screenshotWindowService.removeListener('window_closed');
      screenshotWindowService.removeListener('save_screenshot');
      screenshotWindowService.removeListener('retake_screenshot');
    };
  }, [selectedCase]);

  // Setup video window service listeners
  useEffect(() => {
    videoWindowService.addListener('preview_window_closed', () => {
      console.log('Video preview window closed');
      setCaptureMode(null);
    });

    videoWindowService.addListener('save_video', async (videoData: any) => {
      if (videoData) {
        console.log('Save video request from preview window');
        // Handle video save logic here
      }
    });

    videoWindowService.addListener('retake_video', () => {
      console.log('Retake video request from preview window');
      setCaptureMode(null);
    });

    return () => {
      videoWindowService.removeListener('preview_window_closed');
      videoWindowService.removeListener('save_video');
      videoWindowService.removeListener('retake_video');
    };
  }, [selectedCase]);

  // Setup video recorder window service listeners
  useEffect(() => {
    videoRecorderWindowService.addListener('recording_window_closed', () => {
      console.log('Video recorder window closed');
      setCaptureMode(null);
    });

    videoRecorderWindowService.addListener('video_recorded', async (videoResult: VideoResult) => {
      if (videoResult.success && videoResult.blob && videoResult.dataUrl && videoResult.filename) {
        console.log('Video recorded successfully, opening preview...');
        
        const videoData = {
          blob: videoResult.blob,
          dataUrl: videoResult.dataUrl,
          filename: videoResult.filename,
          duration: videoResult.duration || 0,
          size: videoResult.size || videoResult.blob.size,
          timestamp: new Date().toISOString(),
          caseId: selectedCase,
        };

        // Open video preview window
        const windowResult = await videoWindowService.openVideoPreview(videoData, {
          centered: true
        });

        if (windowResult.success) {
          console.log('Video preview window opened successfully:', windowResult.windowId);
        } else {
          console.error('Failed to open video preview window:', windowResult.error);
          alert("Failed to open video preview");
        }
      } else {
        console.error('Video recording failed:', videoResult.error);
        alert(videoResult.error || "Video recording failed");
      }
      
      setCaptureMode(null);
    });

    videoRecorderWindowService.addListener('recording_cancelled', () => {
      console.log('Video recording cancelled');
      setCaptureMode(null);
    });

    return () => {
      videoRecorderWindowService.removeListener('recording_window_closed');
      videoRecorderWindowService.removeListener('video_recorded');
      videoRecorderWindowService.removeListener('recording_cancelled');
    };
  }, [selectedCase]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSaveScreenshotFromWindow = async (screenshotData: ScreenshotData) => {
    setIsUploading(true);

    try {
      console.log('Saving screenshot from preview window...');
      
      const result: ScreenshotResult = {
        success: true,
        dataUrl: screenshotData.dataUrl,
        filename: screenshotData.filename,
        blob: screenshotData.blob,
      };

      const saved = await screenshotService.saveToStorage(result, selectedCase);

      if (saved) {
        console.log("Screenshot saved successfully from preview window!");
        setScreenshotPreview(null);
        setCaptureMode(null);
        alert("Screenshot saved successfully!");
      } else {
        console.error("Failed to save screenshot from preview window");
        alert("Failed to save screenshot");
      }
    } catch (error) {
      console.error("Save error from preview window:", error);
      alert("Failed to save screenshot");
    }

    setIsUploading(false);
  };

  const handleLogout = async () => {
    setShowUserDropdown(false);
    try {
      await logout();
      console.log('✅ User logged out successfully');
    } catch (error) {
      console.error('❌ Logout failed:', error);
    }
  };

  const handleUserAvatarClick = () => {
    setShowUserDropdown(!showUserDropdown);
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
      if (type === "region") {
        // Use NEW tab-based region selector service (Loom-style)
        console.log('🎯 Starting tab-based region selection...');
        
        // Check if region selector is already open
        if (regionSelectorService.isActive()) {
          // Focus existing selector tab
          const focused = await regionSelectorService.focusSelectorTab();
          if (focused) {
            console.log('🎯 Focused existing region selector tab');
            setIsCapturing(false);
            return;
          }
        }

        const result = await regionSelectorService.startRegionSelection(selectedCase);
        
        if (!result.success) {
          alert(result.error || "Failed to start region selection");
          setIsCapturing(false);
          setCaptureMode(null);
          return;
        }
        
        console.log('✅ Region selector tab opened successfully');
        // Keep capturing state - will be cleared when region is selected or cancelled
        return;
      }

      // Handle regular screenshot capture
      const captureType = type === "screen" ? "visible" : "full";
      const result = await screenshotService.captureFullScreen({
        type: captureType,
        format: "png",
      });

      if (result.success && result.dataUrl && result.filename) {
        const screenshotData: ScreenshotData = {
          dataUrl: result.dataUrl,
          filename: result.filename,
          timestamp: new Date().toISOString(),
          type: `screenshot-${type}`,
          caseId: selectedCase,
          blob: result.blob,
        };

        console.log('Opening screenshot preview in new window...');
        
        const windowResult = await screenshotWindowService.openScreenshotPreview(screenshotData, {
          width: 1400,
          height: 900,
          centered: true
        });

        if (!windowResult.success) {
          console.error('Failed to open preview window:', windowResult.error);
          setScreenshotPreview(screenshotData);
        } else {
          console.log('Preview window opened successfully:', windowResult.windowId);
        }
      } else {
        alert(result.error || "Screenshot capture failed");
      }
    } catch (error) {
      console.error("Screenshot error:", error);
      alert("Screenshot capture failed");
    }

    setIsCapturing(false);
  };

  const handleRegionSelectFromService = async (region: RegionSelection) => {
    setIsCapturing(true);

    try {
      console.log('🎯 Processing region selection from tab:', region);
      
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

        console.log('Opening region screenshot preview in new window...');
        
        const windowResult = await screenshotWindowService.openScreenshotPreview(screenshotData, {
          width: 1400,
          height: 900,
          centered: true
        });

        if (!windowResult.success) {
          console.error('Failed to open preview window:', windowResult.error);
          setScreenshotPreview(screenshotData);
        } else {
          console.log('Region preview window opened successfully:', windowResult.windowId);
        }
      } else {
        alert(result.error || "Region capture failed");
      }
    } catch (error) {
      console.error("Region capture error:", error);
      alert("Region capture failed");
    }

    setIsCapturing(false);
    setCaptureMode(null);
  };

  // Updated video capture handler - opens in new tab with auto-start like Loom
  const handleVideoCapture = async (type: "video" | "r-video" = "video") => {
    if (!selectedCase) {
      alert("Please select a case first");
      return;
    }

    // Check if recorder is already open
    if (videoRecorderWindowService.isRecorderOpen()) {
      // Focus existing recorder window/tab
      const focused = await videoRecorderWindowService.focusRecorderWindow();
      if (focused) {
        console.log('🎯 Focused existing recorder window');
        return;
      }
    }

    setCaptureMode("video");
    
    // Prepare recorder options based on type - with auto-start enabled
    const defaultOptions: Partial<VideoOptions> = {
      type: type === "video" ? "desktop" : "tab",
      format: "webm",
      quality: "medium",
      maxDuration: 300,
      includeAudio: false,
    };
    
    const recorderData = {
      caseId: selectedCase,
      options: defaultOptions,
      autoStart: true // Auto-start recording immediately
    };

    console.log('🎬 Opening video recorder with auto-start...');
    
    try {
      // Open recorder in new tab (Loom-style) with immediate screen selection
      const result = await videoRecorderWindowService.openVideoRecorder(recorderData, {
        centered: true
      });
      
      if (result.success) {
        console.log('✅ Video recorder opened with auto-start:', result.tabId || result.windowId);
        // Keep capture mode set - will be cleared when recorder closes or completes
      } else {
        console.error('❌ Failed to open video recorder:', result.error);
        alert(result.error || "Failed to open video recorder");
        setCaptureMode(null);
      }
    } catch (error) {
      console.error('❌ Video recorder error:', error);
      alert("Failed to open video recorder");
      setCaptureMode(null);
    }
  };

  const handleSaveScreenshot = async () => {
    if (!screenshotPreview) return;

    setIsUploading(true);

    try {
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

  return (
    <div className="w-[402px] h-[380px] bg-white flex flex-col relative">
      {/* Header with Cellebrite Logo */}
      <div className="bg-white p-4 flex items-start justify-between">
        <div className="flex justify-center items-center flex-1">
          <div className="flex flex-col items-center">
            {logo && <img src={logo} alt="Cellebrite Logo" className="w-2/3" />}
            <p className="text-xl text-gray-500">My insights</p>
          </div>
        </div>
        
        {/* User Avatar with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleUserAvatarClick}
            className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {state.user?.username?.substring(0, 2).toUpperCase() || "JD"}
          </button>
          
          {/* Dropdown Menu */}
          {showUserDropdown && (
            <div className="absolute right-0 top-10 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">
                  {state.user?.firstName} {state.user?.lastName}
                </p>
                <p className="text-xs text-gray-500">{state.user?.email}</p>
              </div>
              
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {state.user?.role || 'User'}
                </p>
              </div>
              
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-800 transition-colors duration-200"
              >
                Sign Out
              </button>
            </div>
          )}
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

          {/* Region Capture - Now opens in NEW TAB like Loom */}
          <button
            onClick={() => handleScreenshot("region")}
            disabled={isCapturing || !selectedCase}
            className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative group"
            title="Select region to capture - opens in new tab"
          >
            <div className="w-8 h-6 border-2 border-gray-600 border-dashed rounded-sm"></div>
            <span className="text-xs text-gray-700">Region</span>
            {/* Loom-style indicator for tab mode */}
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>

          {/* Divider */}
          <div className="w-px h-8 bg-gray-300"></div>

          {/* Video Recording - Opens in New Tab with Auto Screen Selection */}
          <button
            onClick={() => handleVideoCapture("video")}
            disabled={isCapturing || !selectedCase}
            className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative group"
            title="Record screen - choose what to share"
          >
            <div className="w-8 h-6 border-2 border-gray-600 rounded-sm flex items-center justify-center">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            </div>
            <span className="text-xs text-gray-700">Video</span>
            {/* Loom-style indicator */}
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>

          {/* Region Video - Opens in New Tab with Auto Screen Selection */}
          <button
            onClick={() => handleVideoCapture("r-video")}
            disabled={isCapturing || !selectedCase}
            className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative group"
            title="Record screen - choose what to share"
          >
            <div className="w-8 h-6 border-2 border-gray-600 border-dashed rounded-sm flex items-center justify-center">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            </div>
            <span className="text-xs text-gray-700">R.Video</span>
            {/* Loom-style indicator */}
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
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
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-700">
              {captureMode === "video" 
                ? "Opening recorder & choosing screen..." 
                : captureMode === "screenshot" && regionSelectorService.isActive()
                ? "Opening region selector..."
                : "Capturing..."}
            </p>
          </div>
        </div>
      )}

      {/* Fallback screenshot preview modal */}
      {screenshotPreview && !screenshotWindowService.isPreviewWindowOpen() && (
        <ScreenshotPreview
          screenshot={screenshotPreview}
          onSave={handleSaveScreenshot}
          onDownload={handleDownloadScreenshot}
          onRetake={handleRetakeScreenshot}
          onClose={() => setScreenshotPreview(null)}
          isUploading={isUploading}
        />
      )}
    </div>
  );
}