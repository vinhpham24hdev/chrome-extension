// components/Dashboard.tsx - Complete with all features and recording indicator
import { useState, useEffect, useRef } from "react";

import { useAuth } from "../contexts/AuthContext";
import { screenshotService, ScreenshotResult } from "../services/screenshotService";
import { VideoResult, VideoOptions } from "../services/videoService";
import { screenshotWindowService } from "../services/screenshotWindowService";
import { videoWindowService } from "../services/videoWindowService";
import { videoRecorderWindowService } from "../services/videoRecorderWindowService";
import { caseService, CaseItem } from "../services/caseService";
import { badgeService } from "../services/badgeService";

import ScreenshotPreview, { ScreenshotData } from "./ScreenshotPreview";

import logo from "@/assets/logo.png";
import CaseSelector from "./CaseSelector";

// Error Modal Component with custom actions support
const ErrorModal = ({
  isOpen,
  onClose,
  title,
  message,
  suggestions = [],
  customActions = null,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  suggestions?: string[];
  customActions?: React.ReactNode;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[100vh] overflow-y-auto">
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
          {customActions || (
            <button
              onClick={onClose}
              className="w-full bg-blue-600 border-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { state, logout, handleLogoutOkta } = useAuth();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [selectedCase, setSelectedCase] = useState<string>('');
  const [loadingCases, setLoadingCases] = useState(true);
  const [captureMode, setCaptureMode] = useState<
    "screenshot" | "video" | "region" | null
  >(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [screenshotPreview, setScreenshotPreview] =
    useState<ScreenshotData | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Enhanced pending capture state with accurate tracking
  const [pendingCapture, setPendingCapture] = useState<{
    type: "region" | "screenshot" | "video" | null;
    sessionId?: string;
    startTime?: number;
    captureInfo?: any;
  }>({ type: null });

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

  // Connection status
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);

  // Recording state tracking
  const [recordingState, setRecordingState] = useState<{
    isRecording: boolean;
    recordingType: 'video' | 'screen' | null;
    duration?: number;
    startTime?: number;
  }>({
    isRecording: false,
    recordingType: null
  });

  // Load cases on component mount
  useEffect(() => {
    loadCases();
    checkBackendConnection();
  }, []);

  // 🔥 NEW: Check and handle recording state when popup opens
  useEffect(() => {
    const handleRecordingOnPopupOpen = async () => {
      try {
        // Check if recording is active when popup opens
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          const response = await chrome.runtime.sendMessage({
            type: 'GET_RECORDING_STATE'
          });

          if (response && response.success && response.state && response.state.isRecording) {
            console.log('🛑 Popup opened during recording - offering to stop');
            
            // Show immediate stop dialog
            setErrorModal({
              isOpen: true,
              title: "Recording in Progress",
              message: "A video recording is currently active. Would you like to stop it?",
              suggestions: [
                "Click 'Stop Recording' below to end the current recording",
                "Or close this popup to continue recording"
              ]
            });

            // Set custom close handler for this modal
            setShowStopRecordingModal(true);
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not check recording state on popup open:', error);
      }
    };

    handleRecordingOnPopupOpen();
  }, []);

  // State for stop recording modal
  const [showStopRecordingModal, setShowStopRecordingModal] = useState(false);

  // Handle stop recording from popup
  const handleStopRecordingFromPopup = async () => {
    try {
      console.log('🛑 Stopping recording from popup...');
      
      // Send stop message to background
      await chrome.runtime.sendMessage({
        type: 'STOP_RECORDING_REQUEST',
        source: 'popup',
        timestamp: Date.now()
      });

      // Close the modal
      setShowStopRecordingModal(false);
      setErrorModal(prev => ({ ...prev, isOpen: false }));

      // Show success message
      setTimeout(() => {
        setErrorModal({
          isOpen: true,
          title: "Recording Stopped",
          message: "The video recording has been stopped successfully.",
          suggestions: ["You can now start a new recording if needed"]
        });
        setShowStopRecordingModal(false);
      }, 500);

    } catch (error) {
      console.error('❌ Error stopping recording from popup:', error);
      setErrorModal({
        isOpen: true,
        title: "Error Stopping Recording",
        message: "Failed to stop the recording. Please try again.",
        suggestions: ["Close this popup and try clicking the extension icon again"]
      });
      setShowStopRecordingModal(false);
    }
  };

  // Listen for recording state changes
  useEffect(() => {
    const handleRecordingStateMessage = (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if (message.type === 'RECORDING_STARTED') {
        console.log('📹 Dashboard: Recording started notification');
        setRecordingState({
          isRecording: true,
          recordingType: message.recordingType || 'video',
          startTime: Date.now()
        });
        sendResponse({ received: true });
      }

      if (message.type === 'RECORDING_STOPPED') {
        console.log('⏹️ Dashboard: Recording stopped notification');
        setRecordingState({
          isRecording: false,
          recordingType: null
        });
        
        // Show success notification if recording was successful
        if (message.success !== false) {
          badgeService.showSuccessIndicator(2000);
        }
        sendResponse({ received: true });
      }

      if (message.type === 'RECORDING_ERROR') {
        console.log('❌ Dashboard: Recording error notification');
        setRecordingState({
          isRecording: false,
          recordingType: null
        });
        sendResponse({ received: true });
      }
    };

    // Add message listener
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener(handleRecordingStateMessage);
    }

    return () => {
      // Remove message listener
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(handleRecordingStateMessage);
      }
    };
  }, []);

  // Update recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (recordingState.isRecording && recordingState.startTime) {
      interval = setInterval(() => {
        setRecordingState(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - (prev.startTime || 0)) / 1000)
        }));
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [recordingState.isRecording, recordingState.startTime]);

  // Load cases from real backend
  const loadCases = async () => {
    try {
      setLoadingCases(true);
      console.log('📁 Loading cases from backend...');
      
      const fetchedCases = await caseService.getCases({
        limit: 50,
        page: 1
      }, state.authToken);
      
      setCases(fetchedCases);
      
      const selectedCaseFromStorage = await chrome.storage.local.get(['selectedCase'])      
      if(selectedCaseFromStorage?.selectedCase?.id) {        
        setSelectedCase(selectedCaseFromStorage.selectedCase.id)
      }
      else {
        // Auto-select first case if none selected        
        if (fetchedCases.length > 0 && !selectedCase) {
          setSelectedCase(fetchedCases[0].id);
          chrome.storage.local.set({selectedCase: fetchedCases[0]})
        }
      }
     
      
      console.log('✅ Cases loaded:', fetchedCases.length);
    } catch (error) {
      console.error('❌ Failed to load cases:', error);
      showError(
        'Failed to Load Cases',
        'Could not connect to backend to load cases.',
        [
          'Check if the backend server is running',
          'Verify your internet connection',
          'Try refreshing the extension',
        ]
      );
    } finally {
      setLoadingCases(false);
    }
  };

  const checkBackendConnection = async () => {
    try {
      const connected = await caseService.checkConnection();
      setBackendConnected(connected);
      
      if (!connected) {
        showError(
          'Backend Connection Failed',
          'Cannot connect to the backend server. The extension will not work properly without backend connection.',
          [
            'Make sure the backend server is running on the correct port',
            'Check your VITE_API_BASE_URL environment variable',
            'Verify firewall and network settings',
          ]
        );
      } else {
        console.log('✅ Backend connection established');
      }
    } catch (error) {
      console.error('❌ Backend connection check failed:', error);
      setBackendConnected(false);
    }
  };

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
    setPendingCapture({ type: null });
  };

  // Close error modal
  const closeError = () => {
    setErrorModal((prev) => ({ ...prev, isOpen: false }));
  };

  // Check for pending captures with better error handling
  useEffect(() => {
    const checkPendingCaptures = async () => {
      try {
        console.log("🔍 Checking for pending captures...");

        // Check for pending region captures
        const storage = await chrome.storage.local.get([
          "has_pending_region_capture",
          "latest_region_capture",
          "region_capture_session_id",
        ]);

        if (
          storage.has_pending_region_capture &&
          storage.latest_region_capture
        ) {
          console.log("📦 Found pending region capture, showing result");
          await handlePendingRegionCapture(storage.latest_region_capture);
        }
      } catch (error) {
        console.warn("⚠️ Failed to check pending captures:", error);
      }
    };

    checkPendingCaptures();
  }, []);

  // Handle pending region capture with validation
  const handlePendingRegionCapture = async (regionCaptureData: any) => {
    try {
      console.log("🎯 Processing pending region capture:", regionCaptureData);

      // Validate region capture data
      if (!regionCaptureData.dataUrl || !regionCaptureData.filename) {
        console.error("❌ Invalid region capture data");
        await chrome.storage.local.set({ has_pending_region_capture: false });
        return;
      }

      // Convert to ScreenshotData format
      const screenshotData: ScreenshotData = {
        dataUrl: regionCaptureData.dataUrl,
        filename: regionCaptureData.filename,
        timestamp: regionCaptureData.timestamp || new Date().toISOString(),
        type: "screenshot-region",
        caseId: regionCaptureData.caseId || selectedCase,
        blob: regionCaptureData.blob,
        sourceUrl: regionCaptureData.sourceUrl,
        region: regionCaptureData.region,
        captureInfo: regionCaptureData.captureInfo,
      };

      console.log("🪟 Opening region capture preview window...");

      const windowResult = await screenshotWindowService.openScreenshotPreview(
        screenshotData,
        {
          width: 1400,
          height: 900,
          centered: true,
        }
      );

      if (windowResult.success) {
        console.log("✅ Region preview window opened:", windowResult.windowId);

        // Clear pending capture flag
        await chrome.storage.local.set({
          has_pending_region_capture: false,
        });
      } else {
        console.error("❌ Failed to open preview window:", windowResult.error);
        // Fallback to inline preview
        setScreenshotPreview(screenshotData);
      }
    } catch (error) {
      console.error("❌ Error handling pending region capture:", error);
      showError("Region Capture Error", "Failed to process captured region.", [
        "Try capturing the region again",
        "Check browser permissions",
        "Refresh the page and retry",
      ]);
    }
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
      setRecordingState({
        isRecording: false,
        recordingType: null
      });
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
        setRecordingState({
          isRecording: false,
          recordingType: null
        });
      }
    );

    videoRecorderWindowService.addListener("recording_cancelled", () => {
      console.log("Video recording cancelled");
      setCaptureMode(null);
      setRecordingState({
        isRecording: false,
        recordingType: null
      });
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

    if(state.user?.isOktaAuth) {      
      handleLogoutOkta()
      return
    }

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

  // Enhanced screenshot function with better region handling
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

    // Check backend connection
    if (backendConnected === false) {
      showError(
        "Backend Not Connected",
        "Cannot save screenshots without backend connection.",
        [
          "Check if backend server is running",
          "Verify API configuration",
          "Try refreshing the extension",
        ]
      );
      return;
    }

    // Check if recording is active
    if (recordingState.isRecording) {
      showError(
        "Recording in Progress",
        "Cannot take screenshots while video recording is active.",
        [
          "Stop the current recording first",
          "Click the red dot (🔴) on the extension icon to stop recording"
        ]
      );
      return;
    }

    // Enhanced region capture workflow with proper error handling
    if (type === "region") {
      console.log("🎯 Starting enhanced region capture workflow...");

      try {
        setIsCapturing(true);
        setCaptureMode("region");

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

        // Step 3: Get current page info for accurate capture
        const [currentTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (!currentTab) {
          throw new Error("No active tab found");
        }

        // Step 4: Save session data to Chrome storage
        await chrome.storage.local.set({
          [`region_session_${sessionId}`]: {
            dataUrl: visibleCapture.dataUrl,
            filename: visibleCapture.filename,
            sourceUrl: visibleCapture.sourceUrl || currentTab.url,
            caseId: selectedCase,
            timestamp: new Date().toISOString(),
            type: "region-base",
            blob: visibleCapture.blob,
          },
          region_capture_session_id: sessionId,
          region_capture_case_id: selectedCase,
        });
        console.log("💾 Session data saved to storage");

        // Step 5: Send message to background script
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

        // Step 6: Set pending capture state
        setPendingCapture({
          type: "region",
          sessionId: sessionId,
          startTime: Date.now(),
        });

        // Show instruction for 1.5 seconds then close popup (Loom-style)
        setTimeout(() => {
          console.log("🚪 Closing popup for region selection (Loom-style)");
          window.close();
        }, 1500);
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
        setPendingCapture({ type: null });
      }

      return; // Exit early for region capture
    }

    // Existing logic for screen and full capture
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

  // Updated video capture handler - opens in new tab with auto-start like Loom
  const handleVideoCapture = async (type: "video" | "r-video" | "video") => {
    if (!selectedCase) {
      showError(
        "No Case Selected",
        "Please select a case before starting video recording.",
        ["Select a case from the dropdown above"]
      );
      return;
    }

    // Check backend connection
    if (backendConnected === false) {
      showError(
        "Backend Not Connected",
        "Cannot save videos without backend connection.",
        [
          "Check if backend server is running",
          "Verify API configuration",
          "Try refreshing the extension",
        ]
      );
      return;
    }

    // Check if already recording
    if (recordingState.isRecording) {
      showError(
        "Recording Already in Progress",
        "A video recording is already active. Please stop the current recording before starting a new one.",
        [
          "Click the red dot (🔴) on the extension icon to stop current recording",
          "Or go to the recording tab and stop it manually"
        ]
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
      quality: "high",
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
        
        // Update local recording state (will be confirmed by background script)
        setRecordingState({
          isRecording: true,
          recordingType: 'video',
          startTime: Date.now()
        });
        
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

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className={`w-[402px] bg-white flex flex-col relative ${errorModal.isOpen ? 'min-h-[470px]' : 'min-h-[380px]'}`}>
      {/* Enhanced Error Modal with custom actions */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => {
          setShowStopRecordingModal(false);
          closeError();
        }}
        title={errorModal.title}
        message={errorModal.message}
        suggestions={errorModal.suggestions}
        customActions={showStopRecordingModal ? (
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setShowStopRecordingModal(false);
                setErrorModal(prev => ({ ...prev, isOpen: false }));
              }}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors font-medium"
            >
              Continue Recording
            </button>
            <button
              onClick={handleStopRecordingFromPopup}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors font-medium"
            >
              Stop Recording
            </button>
          </div>
        ) : null}
      />

      {/* Recording status overlay */}
      {recordingState.isRecording && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-center py-1 z-20">
          <p className="text-xs font-medium">
            🔴 Recording {recordingState.duration ? formatDuration(recordingState.duration) : ''} - Click extension icon to stop
          </p>
        </div>
      )}

      {/* Header with Cellebrite Logo */}
      <div className={`bg-white p-4 flex items-start justify-between ${recordingState.isRecording ? 'pt-8' : ''}`}>
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
            className="w-8 h-8 bg-blue-600 border-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 relative"
          >
            {state.user?.username?.substring(0, 2).toUpperCase() || "JD"}
            {/* Recording indicator on avatar */}
            {recordingState.isRecording && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border border-white"></div>
            )}
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

              {/* Backend Connection Status */}
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    backendConnected === true ? 'bg-green-500' : 
                    backendConnected === false ? 'bg-red-500' : 'bg-yellow-500'
                  }`}></div>
                  <span className="text-xs text-gray-600">
                    {backendConnected === true ? 'Connected' : 
                     backendConnected === false ? 'Disconnected' : 'Checking...'}
                  </span>
                </div>
              </div>

              {/* Recording Status */}
              {recordingState.isRecording && (
                <div className="px-4 py-2 border-b border-gray-100 bg-red-50">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-xs text-red-700 font-medium">
                      Recording Active
                    </span>
                  </div>
                  <p className="text-xs text-red-600 mt-1">
                    {recordingState.duration ? formatDuration(recordingState.duration) : '00:00'}
                  </p>
                  <p className="text-xs text-red-600">
                    Click extension icon to stop
                  </p>
                </div>
              )}

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
        {backendConnected === false && (
          <p className="text-xs text-red-600 mt-1">
            ⚠️ Backend disconnected
          </p>
        )}
        {/* Recording status indicator */}
        {recordingState.isRecording && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2">
            <p className="text-xs text-red-700 font-medium">
              🔴 Recording in progress: {recordingState.duration ? formatDuration(recordingState.duration) : '00:00'}
            </p>
            <p className="text-xs text-red-600">
              Click the extension icon to stop recording
            </p>
          </div>
        )}
      </div>

      {/* Case Selector */}
      <div className="p-6">
        <CaseSelector 
          selectedCase={selectedCase} 
          cases={cases}  
          onCaseSelected={setSelectedCase}
          disabled={loadingCases || recordingState.isRecording}
        />
      </div>

      {/* Enhanced Capture Tools Grid */}
      <div className="px-6 py-2">
        <div className="flex items-start justify-between">
          {/* Screen Capture */}
          <button
            onClick={() => handleScreenshot("screen")}
            disabled={isCapturing || !selectedCase || backendConnected === false || recordingState.isRecording}
            className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={recordingState.isRecording ? "Cannot capture while recording" : "Capture only visible area (what you see now)"}
          >
            <div className="w-8 h-6 border-2 border-gray-600 rounded-sm flex items-center justify-center relative">
              <div className="w-4 h-3 bg-gray-600 rounded-xs"></div>
              {/* Add viewport indicator */}
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
            </div>
            <span className="text-xs text-gray-700">Screen</span>
          </button>

          {/* Full Page Capture */}
          <button
            onClick={() => handleScreenshot("full")}
            disabled={isCapturing || !selectedCase || backendConnected === false || recordingState.isRecording}
            className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={recordingState.isRecording ? "Cannot capture while recording" : "Capture entire page including content below the fold"}
          >
            <div className="w-8 h-6 border-2 border-gray-600 rounded-sm relative">
              <div className="w-6 h-4 bg-gray-600 rounded-xs absolute top-0.5 left-0.5"></div>
              {/* Add scroll indicator */}
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="absolute top-1 right-0.5 w-0.5 h-3 bg-white opacity-75"></div>
            </div>
            <span className="text-xs text-gray-700">Full</span>
          </button>

          {/* Accurate Region Capture */}
          <button
            onClick={() => handleScreenshot("region")}
            disabled={isCapturing || !selectedCase || backendConnected === false || recordingState.isRecording}
            className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative group"
            title={recordingState.isRecording ? "Cannot capture while recording" : "Select custom area to capture - pixel-perfect with DPR support"}
          >
            <div className="w-8 h-6 border-2 border-gray-600 border-dashed rounded-sm relative">
              {/* Add selection crosshair icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 relative">
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gray-600 transform -translate-y-0.25"></div>
                  <div className="absolute inset-y-0 left-1/2 w-0.5 bg-gray-600 transform -translate-x-0.25"></div>
                </div>
              </div>
              {/* Add accuracy indicator */}
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full"></div>
            </div>
            <span className="text-xs text-gray-700">Region</span>

            {/* Enhanced tooltip for region */}
            {!recordingState.isRecording && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                🎯 Pixel-perfect region capture
                <br />
                <span className="text-gray-300">✓ High DPI ✓ Zoom support</span>
              </div>
            )}
          </button>

          {/* Divider */}
          <div className="w-px h-8 bg-gray-300"></div>

          {/* Video Recording */}
          <button
            onClick={() => handleVideoCapture("video")}
            disabled={isCapturing || !selectedCase || backendConnected === false}
            className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative group"
            title={recordingState.isRecording ? "Recording already in progress - click extension icon to stop" : "Record screen - choose what to share"}
          >
            <div className="w-8 h-6 border-2 border-gray-600 rounded-sm flex items-center justify-center">
              <div className={`w-3 h-3 rounded-full ${recordingState.isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></div>
            </div>
            <span className="text-xs text-gray-700">Video</span>
            {/* Recording indicator */}
            {recordingState.isRecording && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            )}
          </button>

          {/* Region Video - Disabled */}
          <button
            onClick={() => handleVideoCapture("r-video")}
            disabled={true}
            className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative group"
            title="Region video recording - coming soon"
          >
            <div className="w-8 h-6 border-2 border-gray-600 border-dashed rounded-sm flex items-center justify-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            </div>
            <span className="text-xs text-gray-700">R.Video</span>
          </button>

          {/* More Options */}
          <button 
            className="flex flex-col items-center space-y-1 p-2 rounded hover:bg-gray-100 transition-colors"
            onClick={checkBackendConnection}
            title="Refresh connection status"
            disabled={recordingState.isRecording}
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
        <button 
          className="w-[176px] bg-blue-600 border-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
          disabled={!selectedCase || backendConnected === false}
          onClick={() => {
            chrome.runtime.sendMessage({ type: 'OPEN_CASE_REPORT', data: cases.find((caseItem) => caseItem.id === selectedCase) });
          }}
        >
          View Report
        </button>
      </div>

      {/* Enhanced status indicator with recording-specific messages */}
      {isCapturing && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-700 text-center">
              {captureMode === "video"
                ? "Opening recorder & choosing screen..."
                : captureMode === "region"
                ? "🎯 Preparing accurate region selector..."
                : "Capturing screenshot..."}
            </p>
            {captureMode === "region" && (
              <div className="text-sm text-gray-500 mt-3 text-center max-w-xs">
                <p className="font-medium text-gray-700 mb-2">
                  📐 Pixel-Perfect Capture
                </p>
                <p>• Drag to select area on the page</p>
                <p>• Supports high DPI & zoom levels</p>
                <p>
                  • Press <span className="font-medium">ESC</span> to cancel
                </p>
                <p className="text-xs mt-2 text-purple-600">
                  ✨ Enhanced accuracy for all displays
                </p>
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