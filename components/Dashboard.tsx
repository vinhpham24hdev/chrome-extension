// components/Dashboard.tsx - Enhanced with region selector integration
import React, { useState, useEffect, useRef } from "react";
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
import {
  videoService,
  VideoResult,
  VideoOptions,
} from "../services/videoService";
import { regionService, RegionCaptureResult } from "../services/regionService";
import { screenshotWindowService } from "../services/screenshotWindowService";
import { videoWindowService } from "../services/videoWindowService";
import { videoRecorderWindowService } from "../services/videoRecorderWindowService";

import ScreenshotPreview, { ScreenshotData } from "./ScreenshotPreview";

import logo from "@/assets/logo.png";

// Error Modal Component for better UX
const ErrorModal = ({
  isOpen,
  onClose,
  title,
  message,
  suggestions = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  suggestions?: string[];
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 text-lg">⚠️</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
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

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-4 whitespace-pre-line">{message}</p>

          {suggestions.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                💡 What you can do:
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 border-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

interface CaseItem {
  id: string;
  title: string;
  status: "active" | "pending" | "closed";
  createdAt: string;
}

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
  const [captureMode, setCaptureMode] = useState<
    "screenshot" | "video" | "region" | null
  >(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [screenshotPreview, setScreenshotPreview] =
    useState<ScreenshotData | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    suggestions: string[];
  }>({
    isOpen: false,
    title: "",
    message: "",
    suggestions: [],
  });

  // User dropdown state
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Show enhanced error modal
  const showError = (
    title: string,
    message: string,
    suggestions: string[] = []
  ) => {
    setErrorModal({
      isOpen: true,
      title,
      message,
      suggestions,
    });
    setIsCapturing(false);
    setCaptureMode(null);
  };

  // Close error modal
  const closeError = () => {
    setErrorModal((prev) => ({ ...prev, isOpen: false }));
  };

  // Setup screenshot window service listeners
  useEffect(() => {
    screenshotWindowService.addListener("window_closed", () => {
      setScreenshotPreview(null);
      setCaptureMode(null);
      console.log("Screenshot preview window closed");
    });

    screenshotWindowService.addListener(
      "save_screenshot",
      async (screenshotData: ScreenshotData) => {
        if (screenshotData) {
          console.log("Save screenshot request from preview window");
          await handleSaveScreenshotFromWindow(screenshotData);
        }
      }
    );

    screenshotWindowService.addListener("retake_screenshot", () => {
      console.log("Retake screenshot request from preview window");
      setScreenshotPreview(null);
      setCaptureMode(null);
    });

    return () => {
      screenshotWindowService.removeListener("window_closed");
      screenshotWindowService.removeListener("save_screenshot");
      screenshotWindowService.removeListener("retake_screenshot");
    };
  }, [selectedCase]);

  // Setup video window service listeners
  useEffect(() => {
    videoWindowService.addListener("preview_window_closed", () => {
      console.log("Video preview window closed");
      setCaptureMode(null);
    });

    videoWindowService.addListener("save_video", async (videoData: any) => {
      if (videoData) {
        console.log("Save video request from preview window");
        // Handle video save logic here
      }
    });

    videoWindowService.addListener("retake_video", () => {
      console.log("Retake video request from preview window");
      setCaptureMode(null);
    });

    return () => {
      videoWindowService.removeListener("preview_window_closed");
      videoWindowService.removeListener("save_video");
      videoWindowService.removeListener("retake_video");
    };
  }, [selectedCase]);

  // Setup video recorder window service listeners
  useEffect(() => {
    videoRecorderWindowService.addListener("recording_window_closed", () => {
      console.log("Video recorder window closed");
      setCaptureMode(null);
    });

    videoRecorderWindowService.addListener(
      "video_recorded",
      async (videoResult: VideoResult) => {
        if (
          videoResult.success &&
          videoResult.blob &&
          videoResult.dataUrl &&
          videoResult.filename
        ) {
          console.log("Video recorded successfully, opening preview...");

          const videoData = {
            blob: videoResult.blob,
            dataUrl: videoResult.dataUrl,
            filename: videoResult.filename,
            duration: videoResult.duration || 0,
            size: videoResult.size || videoResult.blob.size,
            timestamp: new Date().toISOString(),
            caseId: selectedCase,
          };

          const windowResult = await videoWindowService.openVideoPreview(
            videoData,
            {
              centered: true,
            }
          );

          if (windowResult.success) {
            console.log(
              "Video preview window opened successfully:",
              windowResult.windowId
            );
          } else {
            console.error(
              "Failed to open video preview window:",
              windowResult.error
            );
            showError(
              "Video Preview Error",
              "Failed to open video preview window.",
              [
                "Please try recording again",
                "Check if popup blockers are disabled",
              ]
            );
          }
        } else {
          console.error("Video recording failed:", videoResult.error);
          showError(
            "Video Recording Failed",
            videoResult.error || "Video recording failed",
            [
              "Try recording again",
              "Check microphone/camera permissions",
              "Ensure you have enough disk space",
            ]
          );
        }

        setCaptureMode(null);
      }
    );

    videoRecorderWindowService.addListener("recording_cancelled", () => {
      console.log("Video recording cancelled");
      setCaptureMode(null);
    });

    return () => {
      videoRecorderWindowService.removeListener("recording_window_closed");
      videoRecorderWindowService.removeListener("video_recorded");
      videoRecorderWindowService.removeListener("recording_cancelled");
    };
  }, [selectedCase]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSaveScreenshotFromWindow = async (
    screenshotData: ScreenshotData
  ) => {
    setIsUploading(true);

    try {
      console.log("Saving screenshot from preview window...");

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
        // Could show success message here
      } else {
        console.error("Failed to save screenshot from preview window");
        showError("Save Failed", "Failed to save screenshot to storage.", [
          "Check your internet connection",
          "Try saving again",
          "Download the screenshot as backup",
        ]);
      }
    } catch (error) {
      console.error("Save error from preview window:", error);
      showError(
        "Save Error",
        "An error occurred while saving the screenshot.",
        [
          "Try saving again",
          "Check your storage permissions",
          "Download as local file instead",
        ]
      );
    }

    setIsUploading(false);
  };

  const handleLogout = async () => {
    setShowUserDropdown(false);
    try {
      await logout();
      console.log("✅ User logged out successfully");
    } catch (error) {
      console.error("❌ Logout failed:", error);
    }
  };

  const handleUserAvatarClick = () => {
    setShowUserDropdown(!showUserDropdown);
  };

  const handleCaseSelect = (caseId: string) => {
    setSelectedCase(caseId);
  };

  // components/Dashboard.tsx - Updated handleScreenshot function for region capture

  const handleScreenshot = async (
    type: "screen" | "full" | "region" = "screen"
  ) => {
    if (!selectedCase) {
      showError(
        "No Case Selected",
        "Please select a case before taking a screenshot.",
        ["Select a case from the dropdown above"]
      );
      return;
    }

    // 🎯 NEW: Region Capture Workflow
    if (type === "region") {
      console.log("🎯 Starting region capture workflow...");

      setIsCapturing(true);
      setCaptureMode("region");

      try {
        // Step 1: Capture visible area as base image
        console.log("📸 Capturing base image for region selection...");
        const visibleCapture = await screenshotService.captureVisibleArea({
          type: "visible",
          format: "png",
        });

        if (!visibleCapture.success) {
          throw new Error(
            visibleCapture.error || "Failed to capture base image"
          );
        }

        // Step 2: Create unique session ID
        const sessionId = `region_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        console.log("💾 Created session ID:", sessionId);

        // Step 3: Save session data to Chrome storage
        await chrome.storage.local.set({
          [`region_session_${sessionId}`]: {
            dataUrl: visibleCapture.dataUrl,
            filename: visibleCapture.filename,
            sourceUrl: visibleCapture.sourceUrl,
            caseId: selectedCase,
            timestamp: new Date().toISOString(),
            type: "region-base",
            blob: visibleCapture.blob,
          },
        });
        console.log("💾 Session data saved to storage");

        // Step 4: Send message to background script
        const bgResponse = await chrome.runtime.sendMessage({
          type: "START_REGION_CAPTURE",
          sessionId: sessionId,
          caseId: selectedCase,
        });

        if (!bgResponse || !bgResponse.success) {
          throw new Error(
            bgResponse?.error || "Failed to start region capture"
          );
        }

        console.log("✅ Background script notified, session started");

        // Step 5: Close popup to allow region selection
        console.log("🚪 Closing popup for region selection...");
        setTimeout(() => {
          window.close();
        }, 150); // Small delay to ensure message is processed
      } catch (error) {
        console.error("❌ Region capture initialization failed:", error);

        let errorMsg = "Unknown error occurred";
        let suggestions = [
          "Try refreshing the page and capturing again",
          "Check if you're on a regular website",
          "Make sure popup blockers are disabled",
        ];

        if (error instanceof Error) {
          errorMsg = error.message;

          if (
            errorMsg.includes("permission") ||
            errorMsg.includes("activeTab")
          ) {
            suggestions = [
              "Click the extension icon first to grant permissions",
              "Refresh the page and try again",
              "Make sure you're on an active tab",
            ];
          } else if (
            errorMsg.includes("restricted") ||
            errorMsg.includes("chrome://")
          ) {
            suggestions = [
              "Navigate to a regular website (google.com, youtube.com)",
              "Browser internal pages cannot be captured",
              "Try opening a new tab with any website",
            ];
          }
        }

        showError("Region Capture Failed", errorMsg, suggestions);
        setIsCapturing(false);
        setCaptureMode(null);
      }

      return; // Exit early for region capture
    }

    // Existing logic for screen and full capture (unchanged)
    setIsCapturing(true);
    setCaptureMode("screenshot");

    try {
      let result: ScreenshotResult;

      // 🖥️ SCREEN: Capture only visible area
      if (type === "screen") {
        console.log("📸 Capturing VISIBLE AREA (Screen)...");
        result = await screenshotService.captureVisibleArea({
          type: "visible",
          format: "png",
        });
      }
      // 📄 FULL: Capture entire page with scrolling
      else if (type === "full") {
        console.log("📄 Capturing FULL PAGE with scrolling...");
        result = await screenshotService.captureFullPage({
          type: "full",
          format: "png",
        });
      }
      // This else should never be reached now since region is handled above
      else {
        console.log("🎯 Fallback - using visible capture for unknown type");
        result = await screenshotService.captureVisibleArea({
          type: "visible",
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
          sourceUrl: result.sourceUrl,
        };

        console.log("Opening screenshot preview in new window...");

        const windowResult =
          await screenshotWindowService.openScreenshotPreview(screenshotData, {
            width: 1400,
            height: 900,
            centered: true,
          });

        if (!windowResult.success) {
          console.error("Failed to open preview window:", windowResult.error);
          setScreenshotPreview(screenshotData);
        } else {
          console.log(
            "Preview window opened successfully:",
            windowResult.windowId
          );
        }
      } else {
        // Enhanced error handling with suggestions
        const errorMsg = result.error || "Screenshot capture failed";
        let suggestions = [
          "Try refreshing the page and capture again",
          "Check if you're on a regular website",
          "Try using a different capture mode",
        ];

        if (
          errorMsg.includes("restricted") ||
          errorMsg.includes("chrome://") ||
          errorMsg.includes("extension")
        ) {
          suggestions = [
            "Navigate to a regular website (google.com, youtube.com, github.com)",
            "Open a new tab with any website",
            "Browser internal pages cannot be captured for security reasons",
          ];
        } else if (
          errorMsg.includes("permission") ||
          errorMsg.includes("activeTab")
        ) {
          suggestions = [
            "Click the extension icon first to grant permissions",
            "Refresh the page and try again",
            "Make sure you're on an active tab",
          ];
        }

        showError("Screenshot Failed", errorMsg, suggestions);
      }
    } catch (error) {
      console.error("Screenshot error:", error);
      showError(
        "Screenshot Error",
        "An unexpected error occurred while taking the screenshot.",
        [
          "Refresh the page and try again",
          "Check browser permissions",
          "Try a different capture mode",
        ]
      );
    }

    setIsCapturing(false);
  };

  // NEW: Handle region capture
  const handleRegionCapture = async () => {
    if (!selectedCase) {
      showError(
        "No Case Selected",
        "Please select a case before capturing a region.",
        ["Select a case from the dropdown above"]
      );
      return;
    }

    setIsCapturing(true);
    setCaptureMode("region");

    try {
      console.log("🎯 Starting region selection...");

      const result: RegionCaptureResult =
        await regionService.startRegionSelection({
          showGuides: true,
          showDimensions: true,
          overlayColor: "rgba(0, 0, 0, 0.3)",
          borderColor: "#4285f4",
        });

      if (
        result.success &&
        result.dataUrl &&
        result.filename &&
        result.selection
      ) {
        console.log("✅ Region captured successfully:", result.selection);

        // Get selection stats for better UX
        const stats = regionService.getSelectionStats(result.selection);

        const screenshotData: ScreenshotData = {
          dataUrl: result.dataUrl,
          filename: result.filename,
          timestamp: new Date().toISOString(),
          type: `region-${Math.round(stats.area)}px`,
          caseId: selectedCase,
          blob: result.blob,
          sourceUrl: window.location.href,
        };

        console.log("Opening region preview in new window...");

        const windowResult =
          await screenshotWindowService.openScreenshotPreview(screenshotData, {
            width: 1400,
            height: 900,
            centered: true,
          });

        if (!windowResult.success) {
          console.error("Failed to open preview window:", windowResult.error);
          setScreenshotPreview(screenshotData);
        } else {
          console.log(
            "Preview window opened successfully:",
            windowResult.windowId
          );
        }
      } else {
        // Enhanced error handling for region selection
        const errorMsg = result.error || "Region selection was cancelled";
        let suggestions = [
          "Try the region capture again",
          "Make sure to drag to select an area",
          "Press ESC to cancel if needed",
        ];

        if (errorMsg.includes("cancelled")) {
          console.log("👍 Region selection cancelled by user");
          // Don't show error for user cancellation
        } else if (errorMsg.includes("restricted")) {
          suggestions = [
            "Navigate to a regular website",
            "Region capture doesn't work on browser internal pages",
            "Try on google.com, youtube.com, or github.com",
          ];
          showError("Region Capture Failed", errorMsg, suggestions);
        } else {
          showError("Region Capture Failed", errorMsg, suggestions);
        }
      }
    } catch (error) {
      console.error("Region capture error:", error);
      showError(
        "Region Capture Error",
        "An unexpected error occurred during region selection.",
        [
          "Refresh the page and try again",
          "Check browser permissions",
          "Try a different capture mode",
        ]
      );
    }

    setIsCapturing(false);
    setCaptureMode(null);
  };

  // Updated video capture handler - opens in new tab with auto-start like Loom
  const handleVideoCapture = async (type: "video" | "r-video" = "video") => {
    if (!selectedCase) {
      showError(
        "No Case Selected",
        "Please select a case before starting video recording.",
        ["Select a case from the dropdown above"]
      );
      return;
    }

    // Check if recorder is already open
    if (videoRecorderWindowService.isRecorderOpen()) {
      // Focus existing recorder window/tab
      const focused = await videoRecorderWindowService.focusRecorderWindow();
      if (focused) {
        console.log("🎯 Focused existing recorder window");
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
      autoStart: true, // Auto-start recording immediately
    };

    console.log("🎬 Opening video recorder with auto-start...");

    try {
      // Open recorder in new tab (Loom-style) with immediate screen selection
      const result = await videoRecorderWindowService.openVideoRecorder(
        recorderData,
        {
          centered: true,
        }
      );

      if (result.success) {
        console.log(
          "✅ Video recorder opened with auto-start:",
          result.tabId || result.windowId
        );
        // Keep capture mode set - will be cleared when recorder closes or completes
      } else {
        console.error("❌ Failed to open video recorder:", result.error);
        showError(
          "Video Recorder Failed",
          result.error || "Failed to open video recorder",
          [
            "Check popup blocker settings",
            "Try again in a few seconds",
            "Refresh the page and retry",
          ]
        );
        setCaptureMode(null);
      }
    } catch (error) {
      console.error("❌ Video recorder error:", error);
      showError(
        "Video Recorder Error",
        "An error occurred while opening the video recorder.",
        [
          "Check browser permissions",
          "Disable popup blockers",
          "Try refreshing and recording again",
        ]
      );
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
        console.log("Screenshot saved successfully!");
        setScreenshotPreview(null);
        setCaptureMode(null);
        // Could show success notification here
      } else {
        showError("Save Failed", "Failed to save screenshot to storage.", [
          "Check your internet connection",
          "Try saving again",
          "Download the screenshot as backup",
        ]);
      }
    } catch (error) {
      console.error("Save error:", error);
      showError(
        "Save Error",
        "An error occurred while saving the screenshot.",
        [
          "Try saving again",
          "Check storage permissions",
          "Download as local file instead",
        ]
      );
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
      {/* Enhanced Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={closeError}
        title={errorModal.title}
        message={errorModal.message}
        suggestions={errorModal.suggestions}
      />

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
            className="w-8 h-8 bg-blue-600 border-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
                  {state.user?.role || "User"}
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

      {/* Enhanced Capture Tools Grid with Region Selector */}
      <div className="px-6 py-2">
        <div className="flex items-start justify-between">
          {/* Screen Capture */}
          <button
            onClick={() => handleScreenshot("screen")}
            disabled={isCapturing || !selectedCase}
            className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Capture only visible area (what you see now)"
          >
            <div className="w-8 h-6 border-2 border-gray-600 rounded-sm flex items-center justify-center relative">
              <div className="w-4 h-3 bg-gray-600 rounded-xs"></div>
              {/* Add viewport indicator */}
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
            </div>
            <span className="text-xs text-gray-700">Screen</span>
          </button>

          {/* Full Page Capture - ENTIRE PAGE WITH SCROLLING */}
          <button
            onClick={() => handleScreenshot("full")}
            disabled={isCapturing || !selectedCase}
            className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Capture entire page including content below the fold"
          >
            <div className="w-8 h-6 border-2 border-gray-600 rounded-sm relative">
              <div className="w-6 h-4 bg-gray-600 rounded-xs absolute top-0.5 left-0.5"></div>
              {/* Add scroll indicator */}
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="absolute top-1 right-0.5 w-0.5 h-3 bg-white opacity-75"></div>
            </div>
            <span className="text-xs text-gray-700">Full</span>
          </button>

          {/* Region Capture - ENHANCED with proper handler */}
          <button
            onClick={handleRegionCapture}
            disabled={isCapturing || !selectedCase}
            className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative group"
            title="Select custom area to capture - drag to select region"
          >
            <div className="w-8 h-6 border-2 border-gray-600 border-dashed rounded-sm relative">
              {/* Add selection crosshair icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 relative">
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gray-600 transform -translate-y-0.25"></div>
                  <div className="absolute inset-y-0 left-1/2 w-0.5 bg-gray-600 transform -translate-x-0.25"></div>
                </div>
              </div>
              {/* Add region indicator */}
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full"></div>
            </div>
            <span className="text-xs text-gray-700">Region</span>

            {/* Enhanced tooltip for region */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              🎯 Drag to select area
            </div>
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
            title="Record screen region - choose what to share"
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
        <button className="w-[176px] bg-blue-600 border-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed">
          View Report
        </button>
      </div>

      {/* Enhanced Status indicator when capturing */}
      {isCapturing && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-700">
              {captureMode === "video"
                ? "Opening recorder & choosing screen..."
                : captureMode === "region"
                ? "🎯 Select region on page..."
                : "Capturing screenshot..."}
            </p>
            {captureMode === "region" && (
              <div className="text-sm text-gray-500 mt-2 text-center">
                <p>• Drag to select the area you want to capture</p>
                <p>
                  • Press <span className="font-medium">ESC</span> to cancel
                </p>
                <p>• Click and drag on the webpage</p>
              </div>
            )}
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
