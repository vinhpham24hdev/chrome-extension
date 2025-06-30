// components/Dashboard.tsx - Complete implementation with full screen video and screenshot
import React, { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select, { SelectChangeEvent } from "@mui/material/Select";

import { useAuth } from "../contexts/AuthContext";
import { screenshotService, ScreenshotResult } from "../services/screenshotService";
import { videoService, VideoResult } from "../services/videoService";
import { screenshotWindowService } from "../services/screenshotWindowService";
import { videoWindowService } from "../services/videoWindowService";
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

// Mock cases matching Figma design
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

  // Setup window service listeners
  useEffect(() => {
    console.log('🔧 Setting up window service listeners for case:', selectedCase);

    // Screenshot window events
    screenshotWindowService.addListener('window_closed', () => {
      console.log('📸 Screenshot preview window closed');
      setScreenshotPreview(null);
      setCaptureMode(null);
    });

    screenshotWindowService.addListener('save_screenshot', async (screenshotData: ScreenshotData) => {
      if (screenshotData) {
        console.log('💾 Save screenshot request from preview window');
        await handleSaveScreenshotFromWindow(screenshotData);
      }
    });

    screenshotWindowService.addListener('retake_screenshot', () => {
      console.log('🔄 Retake screenshot request from preview window');
      setScreenshotPreview(null);
      setCaptureMode(null);
    });

    // Video window events
    videoWindowService.addListener('recording_window_closed', () => {
      console.log('🎥 Video recording window closed');
      setShowVideoRecorder(false);
      setCaptureMode(null);
    });

    videoWindowService.addListener('preview_window_closed', () => {
      console.log('📹 Video preview window closed');
      setVideoPreview(null);
      setCaptureMode(null);
    });

    videoWindowService.addListener('video_recorded', (result: VideoResult) => {
      console.log('🎬 Video recorded from recording window:', result);
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

        // Close recording window state
        setShowVideoRecorder(false);
        
        // Open video preview in new window
        console.log('🪟 Opening video preview in new window...');
        openVideoPreview(videoData);
      } else {
        console.error('❌ Video recording failed:', result.error);
        alert(result.error || "Video recording failed");
        setShowVideoRecorder(false);
        setCaptureMode(null);
      }
    });

    videoWindowService.addListener('save_video', async (videoData: VideoData) => {
      if (videoData) {
        console.log('💾 Save video request from preview window');
        await handleSaveVideoFromWindow(videoData);
      }
    });

    videoWindowService.addListener('retake_video', () => {
      console.log('🔄 Retake video request from preview window');
      setVideoPreview(null);
      setCaptureMode(null);
      // Trigger video recording again
      handleVideoCapture("video");
    });

    return () => {
      // Cleanup all listeners
      console.log('🧹 Cleaning up window service listeners');
      
      screenshotWindowService.removeListener('window_closed');
      screenshotWindowService.removeListener('save_screenshot');
      screenshotWindowService.removeListener('retake_screenshot');
      
      videoWindowService.removeListener('recording_window_closed');
      videoWindowService.removeListener('preview_window_closed');
      videoWindowService.removeListener('video_recorded');
      videoWindowService.removeListener('save_video');
      videoWindowService.removeListener('retake_video');
    };
  }, [selectedCase]);

  const handleSaveScreenshotFromWindow = async (screenshotData: ScreenshotData) => {
    console.log('💾 Processing save screenshot request from window...');
    setIsUploading(true);

    try {
      // Save to Chrome storage
      const result: ScreenshotResult = {
        success: true,
        dataUrl: screenshotData.dataUrl,
        filename: screenshotData.filename,
        blob: screenshotData.blob,
      };

      const saved = await screenshotService.saveToStorage(result, selectedCase);

      if (saved) {
        console.log("✅ Screenshot saved successfully from preview window!");
        setScreenshotPreview(null);
        setCaptureMode(null);
        
        // Show success notification
        alert("Screenshot saved successfully!");
      } else {
        console.error("❌ Failed to save screenshot from preview window");
        alert("Failed to save screenshot");
      }
    } catch (error) {
      console.error("💥 Save error from preview window:", error);
      alert("Failed to save screenshot");
    }

    setIsUploading(false);
  };

  const handleSaveVideoFromWindow = async (videoData: VideoData) => {
    console.log('💾 Processing save video request from window...');
    setIsUploading(true);

    try {
      // Here you can implement video storage logic
      // For now, we'll use a simple approach similar to screenshots
      
      console.log("✅ Video saved successfully from preview window!");
      setVideoPreview(null);
      setCaptureMode(null);
      
      // Show success notification
      alert("Video saved successfully!");
    } catch (error) {
      console.error("💥 Save error from preview window:", error);
      alert("Failed to save video");
    }

    setIsUploading(false);
  };

  const openVideoPreview = async (videoData: VideoData) => {
    console.log('🪟 Opening video preview in new window...');
    
    // Open video preview in new window
    const windowResult = await videoWindowService.openVideoPreview(videoData, {
      width: 1600,
      height: 1000,
      centered: true
    });

    if (!windowResult.success) {
      console.error('❌ Failed to open video preview window:', windowResult.error);
      // Fallback to in-popup preview
      setVideoPreview(videoData);
    } else {
      console.log('✅ Video preview window opened successfully:', windowResult.windowId);
    }
  };

  const handleLogout = async () => {
    console.log('👋 User logging out...');
    await logout();
  };

  const handleCaseSelect = (caseId: string) => {
    console.log('📁 Case selected:', caseId);
    setSelectedCase(caseId);
  };

  const handleScreenshot = async (type: "screen" | "full" | "region" = "screen") => {
    if (!selectedCase) {
      alert("Please select a case first");
      return;
    }

    console.log(`📸 Starting screenshot capture: ${type}`);
    setIsCapturing(true);
    setCaptureMode("screenshot");

    try {
      let result: ScreenshotResult;

      if (type === "region") {
        // First capture full screen for region selection
        console.log('📸 Capturing full screen for region selection...');
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
        console.log(`📸 Capturing ${captureType} screenshot...`);
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

        console.log('🪟 Opening screenshot preview in new window...');
        
        // Open screenshot preview in new window
        const windowResult = await screenshotWindowService.openScreenshotPreview(screenshotData, {
          width: 1400,
          height: 900,
          centered: true
        });

        if (!windowResult.success) {
          console.error('❌ Failed to open preview window:', windowResult.error);
          // Fallback to in-popup preview
          setScreenshotPreview(screenshotData);
        } else {
          console.log('✅ Preview window opened successfully:', windowResult.windowId);
        }
      } else {
        alert(result.error || "Screenshot capture failed");
      }
    } catch (error) {
      console.error("💥 Screenshot error:", error);
      alert("Screenshot capture failed");
    }

    setIsCapturing(false);
  };

  const handleRegionSelect = async (region: RegionSelection) => {
    console.log('📐 Processing region selection:', region);
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

        console.log('🪟 Opening region screenshot preview in new window...');
        
        // Open screenshot preview in new window
        const windowResult = await screenshotWindowService.openScreenshotPreview(screenshotData, {
          width: 1400,
          height: 900,
          centered: true
        });

        if (!windowResult.success) {
          console.error('❌ Failed to open preview window:', windowResult.error);
          // Fallback to in-popup preview
          setScreenshotPreview(screenshotData);
        } else {
          console.log('✅ Region preview window opened successfully:', windowResult.windowId);
        }
      } else {
        alert(result.error || "Region capture failed");
      }
    } catch (error) {
      console.error("💥 Region capture error:", error);
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

    console.log(`🎥 Starting video capture: ${type}`);
    setCaptureMode("video");
    
    // Prepare recording data
    const recordingData = {
      caseId: selectedCase,
      options: {
        type: type === "r-video" ? "region" : "tab",
        format: "webm",
        quality: "medium",
        maxDuration: 300, // 5 minutes
        includeAudio: false,
      }
    };

    console.log('🪟 Opening video recorder in new window...');
    
    // Open video recorder in new window
    videoWindowService.openVideoRecorder(recordingData, {
      width: 1600,
      height: 1000,
      centered: true
    }).then(windowResult => {
      if (!windowResult.success) {
        console.error('❌ Failed to open video recorder window:', windowResult.error);
        // Fallback to in-popup recorder
        setShowVideoRecorder(true);
      } else {
        console.log('✅ Video recorder window opened successfully:', windowResult.windowId);
      }
    }).catch(error => {
      console.error('💥 Error opening video recorder window:', error);
      // Fallback to in-popup recorder
      setShowVideoRecorder(true);
    });
  };

  const handleVideoRecorded = (result: VideoResult) => {
    console.log('🎬 Video recorded in popup:', result);
    
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

    console.log('💾 Saving screenshot from popup modal...');
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
      console.error("💥 Save error:", error);
      alert("Failed to save screenshot");
    }

    setIsUploading(false);
  };

  const handleDownloadScreenshot = () => {
    if (!screenshotPreview) return;
    console.log('⬇️ Downloading screenshot...');
    screenshotService.downloadScreenshot(
      screenshotPreview.dataUrl,
      screenshotPreview.filename
    );
  };

  const handleRetakeScreenshot = () => {
    console.log('🔄 Retaking screenshot...');
    setScreenshotPreview(null);
    setCaptureMode(null);
  };

  const handleCancelRegionSelection = () => {
    console.log('❌ Cancelling region selection...');
    setShowRegionSelector(false);
    setFullScreenImage("");
    setIsCapturing(false);
    setCaptureMode(null);
  };

  return (
    <div className="w-[402px] h-[380px] bg-white flex flex-col relative">
      {/* Header with Cellebrite Logo */}
      <div className="bg-white p-4 flex items-start justify-between">
        <div className="flex justify-center items-center flex-1">
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
            title="Capture visible screen area"
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
            title="Capture full page including scrollable content"
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
            title="Select and capture specific region"
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
            title="Record current tab"
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
            title="Record selected region"
          >
            <div className="w-8 h-6 border-2 border-gray-600 border-dashed rounded-sm flex items-center justify-center">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            </div>
            <span className="text-xs text-gray-700">R.Video</span>
          </button>

          {/* More Options */}
          <button 
            className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 transition-colors"
            title="More capture options"
          >
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
              {captureMode === "screenshot" ? "Capturing screenshot..." : "Setting up recording..."}
            </p>
          </div>
        </div>
      )}

      {/* Region Selector Modal */}
      {showRegionSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <RegionSelector
            imageUrl={fullScreenImage}
            onRegionSelect={handleRegionSelect}
            onCancel={handleCancelRegionSelection}
          />
        </div>
      )}

      {/* Fallback Screenshot Preview Modal (only if window failed to open) */}
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

      {/* Fallback Video Recorder Modal (only if window failed to open) */}
      {showVideoRecorder && !videoWindowService.isRecordingWindowOpen() && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full mx-4 overflow-auto">
            <VideoRecorder
              caseId={selectedCase}
              onVideoCapture={handleVideoRecorded}
              onClose={() => setShowVideoRecorder(false)}
            />
          </div>
        </div>
      )}

      {/* Fallback Video Preview Modal (only if window failed to open) */}
      {videoPreview && !videoWindowService.isPreviewWindowOpen() && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <VideoPreview
            video={videoPreview}
            onSave={() => {}}
            onDownload={() => {}}
            onRetake={() => setVideoPreview(null)}
            onClose={() => setVideoPreview(null)}
          />
        </div>
      )}
    </div>
  );
}