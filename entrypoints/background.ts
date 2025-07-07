// entrypoints/background.ts - Fixed Region Capture for Manifest V3
export default defineBackground(() => {
  console.log("🚀 Background script started:", { id: browser.runtime.id });

  // Store for video results that couldn't be delivered immediately
  const pendingVideoResults = new Map<string, any>();

  // Handle messages from different parts of the extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(
      "📨 Background received message:",
      message.type,
      "from:",
      sender.tab?.url || "extension"
    );

    try {
      switch (message.type) {
        case "START_REGION_CAPTURE":
          console.log("🎯 Handling START_REGION_CAPTURE");
          handleRegionCaptureStart(message, sender)
            .then((result) => {
              console.log("✅ START_REGION_CAPTURE completed:", result);
              sendResponse({ success: true, result });
            })
            .catch((error) => {
              console.error("❌ START_REGION_CAPTURE failed:", error);
              sendResponse({ success: false, error: error.message });
            });
          return true; // Keep message channel open for async response

        case "REGION_SELECTED":
          console.log("🎯 Handling REGION_SELECTED:", message);
          handleRegionSelected(message, sender)
            .then((result) => {
              console.log("✅ REGION_SELECTED completed:", result);
              sendResponse({ success: true, result });
            })
            .catch((error) => {
              console.error("❌ REGION_SELECTED failed:", error);
              sendResponse({ success: false, error: error.message });
            });
          return true;

        case "REGION_CANCELLED":
          console.log("🎯 Handling REGION_CANCELLED");
          handleRegionCancelled(message, sender);
          sendResponse({ success: true });
          break;
          
        case "VIDEO_RECORDED":
          handleVideoRecorded(message.data, sender)
            .then((result) => sendResponse({ success: true, result }))
            .catch((error) =>
              sendResponse({ success: false, error: error.message })
            );
          return true; // Keep message channel open for async response

        case "VIDEO_RECORDED_BACKGROUND":
          handleVideoRecordedBackground(message.data, sender)
            .then((result) => sendResponse({ success: true, result }))
            .catch((error) =>
              sendResponse({ success: false, error: error.message })
            );
          return true;

        case "GET_PENDING_VIDEO_RESULTS":
          handleGetPendingResults(sender)
            .then((results) => sendResponse({ success: true, results }))
            .catch((error) =>
              sendResponse({ success: false, error: error.message })
            );
          return true;

        case "RECORDING_WINDOW_CLOSED":
          handleRecordingWindowClosed(message, sender);
          sendResponse({ success: true });
          break;

        case "RECORDING_CANCELLED":
          handleRecordingCancelled(message, sender);
          sendResponse({ success: true });
          break;

        case "POPUP_OPENED":
          handlePopupOpened(sender)
            .then((result) => sendResponse({ success: true, result }))
            .catch((error) =>
              sendResponse({ success: false, error: error.message })
            );
          return true;

        default:
          console.log("🤷‍♂️ Unknown message type:", message.type);
          sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      console.error("❌ Error handling message:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  async function handleRegionCaptureStart(
    message: any,
    sender: chrome.runtime.MessageSender
  ) {
    const { sessionId, caseId } = message;

    try {
      console.log(
        "🎯 Background: Starting region capture for session:",
        sessionId
      );

      // Get current active tab
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!activeTab || !activeTab.id) {
        throw new Error("No active tab found for region capture");
      }

      // Check if tab URL is accessible
      if (
        activeTab.url?.startsWith("chrome://") ||
        activeTab.url?.startsWith("chrome-extension://")
      ) {
        throw new Error(
          "Cannot inject region selector into browser internal pages"
        );
      }

      console.log(
        "📋 Injecting region selector into tab:",
        activeTab.id,
        activeTab.url
      );

      // Inject region selector into the active tab
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: initializeRegionSelector,
        args: [sessionId],
      });

      console.log("✅ Region selector injected successfully");

      return {
        success: true,
        tabId: activeTab.id,
        sessionId: sessionId,
        tabUrl: activeTab.url,
      };
    } catch (error) {
      console.error("❌ Failed to start region capture:", error);

      // Cleanup session data on error
      try {
        await chrome.storage.local.remove([`region_session_${sessionId}`]);
      } catch (cleanupError) {
        console.warn("⚠️ Failed to cleanup session data:", cleanupError);
      }

      throw error;
    }
  }

  // Handle region selection completion
  async function handleRegionSelected(
    message: any,
    sender: chrome.runtime.MessageSender
  ) {
    const { sessionId, region } = message;

    try {
      console.log("🎯 Background: Processing region selection:", region);
      console.log("📋 Session ID:", sessionId);

      // Validate region data
      if (!region || region.width <= 0 || region.height <= 0) {
        throw new Error("Invalid region data received");
      }

      // Retrieve session data from storage
      console.log("📦 Retrieving session data for:", sessionId);
      const storage = await chrome.storage.local.get([
        `region_session_${sessionId}`,
      ]);
      const sessionData = storage[`region_session_${sessionId}`];

      if (!sessionData) {
        console.error("❌ Session data not found in storage for:", sessionId);

        // Debug: Check all storage keys
        const allStorage = await chrome.storage.local.get();
        console.log("📋 All storage keys:", Object.keys(allStorage));

        throw new Error(
          "Session data not found - may have expired or been cleaned up"
        );
      }

      console.log("✅ Found session data:", {
        hasDataUrl: !!sessionData.dataUrl,
        filename: sessionData.filename,
        caseId: sessionData.caseId,
        dataUrlLength: sessionData.dataUrl?.length,
      });

      // Crop the image to selected region
      console.log("📸 Starting image crop process...");
      const croppedResult = await cropImageInBackground(
        sessionData.dataUrl,
        region
      );

      if (!croppedResult.success) {
        console.error("❌ Crop failed:", croppedResult.error);
        throw new Error(
          croppedResult.error || "Failed to crop image to selected region"
        );
      }

      console.log("✅ Image cropped successfully");

      // Generate filename for cropped image
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const domain = extractDomainFromUrl(sessionData.sourceUrl || "unknown");
      const filename = `region_${region.width}x${region.height}_${domain}_${timestamp}.png`;

      console.log("🖼️ Generated filename:", filename);

      // Prepare data for the popup/dashboard
      const regionCaptureData = {
        dataUrl: croppedResult.dataUrl,
        filename: filename,
        timestamp: sessionData.timestamp,
        type: "screenshot-region",
        caseId: sessionData.caseId,
        blob: croppedResult.blob,
        sourceUrl: sessionData.sourceUrl,
        region: region
      };

      console.log("📤 Sending region capture result to popup...");

      // 🔥 FIXED: Send result directly to popup instead of opening window here
      try {
        // Try to send to popup/dashboard
        await chrome.runtime.sendMessage({
          type: "REGION_CAPTURE_COMPLETED",
          data: regionCaptureData,
        });
        console.log("✅ Successfully sent region capture result to popup");
      } catch (messageError) {
        console.warn("⚠️ Failed to send to popup, storing for later:", messageError);
        
        // Store for later pickup if popup is not available
        await chrome.storage.local.set({
          latest_region_capture: regionCaptureData,
          has_pending_region_capture: true,
        });
      }

      // Cleanup session data
      await chrome.storage.local.remove([`region_session_${sessionId}`]);
      console.log("🧹 Session data cleaned up");

      console.log("🎉 Region capture workflow completed successfully!");

      return {
        success: true,
        filename: filename,
        region: region,
        caseId: sessionData.caseId,
      };
    } catch (error) {
      console.error("❌ REGION CAPTURE FAILED:", error);

      // Enhanced error logging with full context
      console.error("❌ Full error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        sessionId: sessionId,
        region: region,
        timestamp: new Date().toISOString(),
      });

      // 🔥 FIXED: Send error directly to popup
      try {
        await chrome.runtime.sendMessage({
          type: "REGION_CAPTURE_FAILED",
          error: error instanceof Error ? error.message : "Region capture failed",
          sessionId: sessionId,
        });
      } catch (messageError) {
        console.warn("⚠️ Failed to send error to popup:", messageError);
      }

      // Cleanup session data on error
      try {
        await chrome.storage.local.remove([`region_session_${sessionId}`]);
        console.log("🧹 Cleaned up session data after error");
      } catch (cleanupError) {
        console.warn("⚠️ Failed to cleanup session data:", cleanupError);
      }

      throw error;
    }
  }

  // Handle region capture cancellation
  async function handleRegionCancelled(
    message: any,
    sender: chrome.runtime.MessageSender
  ) {
    const { sessionId } = message;
    console.log("❌ Region capture cancelled for session:", sessionId);

    // 🔥 FIXED: Send cancellation to popup
    try {
      await chrome.runtime.sendMessage({
        type: "REGION_CAPTURE_CANCELLED",
        sessionId: sessionId,
      });
    } catch (messageError) {
      console.warn("⚠️ Failed to send cancellation to popup:", messageError);
    }

    // Cleanup session data
    if (sessionId) {
      try {
        await chrome.storage.local.remove([`region_session_${sessionId}`]);
        console.log("🧹 Session data cleaned up after cancellation");
      } catch (error) {
        console.warn("⚠️ Failed to cleanup cancelled session:", error);
      }
    }
  }

  // 🖼️ UTILITY FUNCTIONS

  // Crop image function for background script
  async function cropImageInBackground(
    dataUrl: string,
    region: { x: number; y: number; width: number; height: number }
  ) {
    return new Promise<{
      success: boolean;
      dataUrl?: string;
      blob?: Blob;
      error?: string;
    }>((resolve) => {
      try {
        console.log("🖼️ Starting image crop:", {
          region,
          dataUrlLength: dataUrl ? dataUrl.length : 0,
          dataUrlType: dataUrl ? dataUrl.substring(0, 30) + "..." : "undefined",
        });

        if (!dataUrl || !dataUrl.startsWith("data:image/")) {
          resolve({
            success: false,
            error: "Invalid or missing image data URL",
          });
          return;
        }

        const img = new Image();

        img.onload = () => {
          try {
            console.log("✅ Base image loaded:", {
              width: img.width,
              height: img.height,
            });

            // Validate that region is within image bounds
            if (
              region.x < 0 ||
              region.y < 0 ||
              region.x >= img.width ||
              region.y >= img.height ||
              region.width <= 0 ||
              region.height <= 0
            ) {
              console.warn("⚠️ Region outside image bounds, adjusting...", {
                region: region,
                imageSize: { width: img.width, height: img.height },
              });

              // Adjust region to fit within image
              region = {
                x: Math.max(0, Math.min(region.x, img.width - 1)),
                y: Math.max(0, Math.min(region.y, img.height - 1)),
                width: Math.min(
                  region.width,
                  img.width - Math.max(0, region.x)
                ),
                height: Math.min(
                  region.height,
                  img.height - Math.max(0, region.y)
                ),
              };

              console.log("📐 Adjusted region:", region);
            }

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              resolve({
                success: false,
                error: "Canvas context not available in background",
              });
              return;
            }

            // Set canvas dimensions to region size
            canvas.width = region.width;
            canvas.height = region.height;

            console.log("📐 Canvas created:", {
              width: canvas.width,
              height: canvas.height,
            });

            // Fill with white background (in case of transparency)
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw the cropped portion
            ctx.drawImage(
              img,
              region.x,
              region.y,
              region.width,
              region.height, // Source rectangle
              0,
              0,
              region.width,
              region.height // Destination rectangle
            );

            console.log("✅ Image drawn to canvas");

            // Convert to blob and dataURL
            canvas.toBlob((blob) => {
              if (blob) {
                const croppedDataUrl = canvas.toDataURL("image/png", 1.0);
                console.log("✅ Crop completed:", {
                  blobSize: blob.size,
                  dataUrlLength: croppedDataUrl.length,
                });

                resolve({
                  success: true,
                  dataUrl: croppedDataUrl,
                  blob: blob,
                });
              } else {
                resolve({
                  success: false,
                  error: "Failed to create cropped image blob",
                });
              }
            }, "image/png");
          } catch (canvasError) {
            console.error("❌ Canvas drawing error:", canvasError);
            resolve({
              success: false,
              error:
                canvasError instanceof Error
                  ? canvasError.message
                  : "Canvas drawing failed",
            });
          }
        };

        img.onerror = (error) => {
          console.error("❌ Image load error:", error);
          resolve({
            success: false,
            error: "Failed to load base image for cropping",
          });
        };

        // Set cross-origin attribute for data URLs (though not needed for data URLs)
        img.crossOrigin = "anonymous";

        // Load the image
        img.src = dataUrl;
      } catch (initError) {
        console.error("❌ Crop initialization error:", initError);
        resolve({
          success: false,
          error:
            initError instanceof Error
              ? initError.message
              : "Image cropping initialization failed",
        });
      }
    });
  }

  // Extract domain from URL for filename (with better sanitization)
  function extractDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname
        .replace(/\./g, "_")
        .replace(/[^a-zA-Z0-9_]/g, "")
        .toLowerCase();
    } catch {
      return "unknown";
    }
  }

  // 🎯 Region Selector Injection Function
  function initializeRegionSelector(sessionId: string) {
    console.log(
      "🎯 Initializing region selector on page for session:",
      sessionId
    );

    // Remove any existing region selector (safety measure)
    const existing = document.getElementById("cellebrite-region-selector");
    if (existing) {
      existing.remove();
      console.log("🧹 Removed existing region selector");
    }

    // Create overlay container
    const overlay = document.createElement("div");
    overlay.id = "cellebrite-region-selector";
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(0, 0, 0, 0.3) !important;
      z-index: 2147483647 !important;
      cursor: crosshair !important;
      user-select: none !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    `;

    // Create instruction text
    const instruction = document.createElement("div");
    instruction.style.cssText = `
      position: absolute !important;
      top: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: rgba(0, 0, 0, 0.8) !important;
      color: white !important;
      padding: 12px 20px !important;
      border-radius: 6px !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      pointer-events: none !important;
      z-index: 2147483648 !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
    `;
    instruction.innerHTML =
      "🎯 Click and drag to select region • Press <strong>ESC</strong> to cancel";

    // Create selection box
    const selectionBox = document.createElement("div");
    selectionBox.style.cssText = `
      position: absolute !important;
      border: 2px dashed #007cff !important;
      background: rgba(0, 124, 255, 0.1) !important;
      display: none !important;
      pointer-events: none !important;
      z-index: 2147483648 !important;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5) !important;
    `;

    // Create dimension display
    const dimensionDisplay = document.createElement("div");
    dimensionDisplay.style.cssText = `
      position: absolute !important;
      background: rgba(0, 0, 0, 0.8) !important;
      color: white !important;
      padding: 4px 8px !important;
      border-radius: 3px !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      display: none !important;
      pointer-events: none !important;
      z-index: 2147483648 !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
    `;

    overlay.appendChild(instruction);
    overlay.appendChild(selectionBox);
    overlay.appendChild(dimensionDisplay);
    document.body.appendChild(overlay);

    console.log("🎨 Region selector UI created and attached");

    // Selection state
    let isSelecting = false;
    let startX = 0,
      startY = 0;

    // Mouse down - start selection
    overlay.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();

      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;

      selectionBox.style.left = startX + "px";
      selectionBox.style.top = startY + "px";
      selectionBox.style.width = "0px";
      selectionBox.style.height = "0px";
      selectionBox.style.display = "block";
      dimensionDisplay.style.display = "block";

      // Fade instruction
      instruction.style.opacity = "0.5";
      instruction.style.transform = "translateX(-50%) scale(0.95)";

      console.log("🖱️ Selection started at:", { x: startX, y: startY });
    });

    // Mouse move - update selection
    overlay.addEventListener("mousemove", (e) => {
      if (!isSelecting) return;

      const currentX = e.clientX;
      const currentY = e.clientY;

      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);

      selectionBox.style.left = left + "px";
      selectionBox.style.top = top + "px";
      selectionBox.style.width = width + "px";
      selectionBox.style.height = height + "px";

      // Update dimension display
      dimensionDisplay.textContent = `${width} × ${height}px`;
      dimensionDisplay.style.left = left + width + 10 + "px";
      dimensionDisplay.style.top = top + "px";

      // Ensure dimension display stays in viewport
      if (left + width + 120 > window.innerWidth) {
        dimensionDisplay.style.left = left - 80 + "px";
      }
      if (top < 30) {
        dimensionDisplay.style.top = top + height + 10 + "px";
      }
    });

    // Mouse up - complete selection
    overlay.addEventListener("mouseup", (e) => {
      if (!isSelecting) return;

      const currentX = e.clientX;
      const currentY = e.clientY;

      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);

      console.log("🖱️ Selection completed:", {
        x: left,
        y: top,
        width,
        height,
      });

      // Minimum size check (10x10 pixels)
      if (width >= 10 && height >= 10) {
        console.log("✅ Valid region selected, sending to background...");

        // Send region to background script
        chrome.runtime
          .sendMessage({
            type: "REGION_SELECTED",
            sessionId: sessionId,
            region: { x: left, y: top, width, height },
          })
          .then((response) => {
            console.log("📤 Message sent to background, response:", response);
            if (response && response.success) {
              console.log("✅ Background processed region successfully");
            } else {
              console.error(
                "❌ Background failed to process region:",
                response?.error
              );
            }
          })
          .catch((error) => {
            console.error("❌ Error sending region data to background:", error);
          });
      } else {
        console.log("❌ Region too small (minimum 10x10px), cancelling");
        chrome.runtime
          .sendMessage({
            type: "REGION_CANCELLED",
            sessionId: sessionId,
          })
          .catch((error) => {
            console.error("❌ Error sending cancellation:", error);
          });
      }

      // Cleanup overlay
      cleanup();
    });

    // ESC key - cancel selection
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        console.log("❌ Region selection cancelled by ESC key");
        chrome.runtime
          .sendMessage({
            type: "REGION_CANCELLED",
            sessionId: sessionId,
          })
          .catch((error) => {
            console.error("❌ Error sending ESC cancellation:", error);
          });
        cleanup();
      }
    };

    // Cleanup function
    const cleanup = () => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
      document.removeEventListener("keydown", handleKeyDown);
      isSelecting = false;
      console.log("🧹 Region selector cleaned up");
    };

    document.addEventListener("keydown", handleKeyDown);

    // Auto-cleanup after 2 minutes (safety measure)
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        console.log("⏰ Region selector auto-cleanup after 2 minutes timeout");
        chrome.runtime
          .sendMessage({
            type: "REGION_CANCELLED",
            sessionId: sessionId,
          })
          .catch((error) => {
            console.error("❌ Error sending timeout cancellation:", error);
          });
        cleanup();
      }
    }, 120000); // 2 minutes

    console.log("✅ Region selector initialization complete");
  }

  // Handle video recording completion
  async function handleVideoRecorded(
    videoData: any,
    sender: chrome.runtime.MessageSender
  ) {
    console.log("🎬 Handling video recording completion:", videoData);

    try {
      // Store video result with timestamp
      const resultId = `video_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      pendingVideoResults.set(resultId, {
        ...videoData,
        timestamp: Date.now(),
        senderTabId: sender.tab?.id,
      });

      // Try to deliver to popup immediately
      const delivered = await tryDeliverToPopup(videoData);

      if (!delivered) {
        console.log(
          "📦 Popup not available, storing result for later delivery"
        );

        // Store in chrome.storage as backup
        await chrome.storage.local.set({
          [`pending_video_${resultId}`]: {
            ...videoData,
            timestamp: Date.now(),
            delivered: false,
          },
        });

        // Notify about pending result
        await chrome.storage.local.set({
          has_pending_video_results: true,
          latest_video_result_id: resultId,
        });
      }

      return { delivered, resultId };
    } catch (error) {
      console.error("❌ Error handling video recorded:", error);
      throw error;
    }
  }

  // Handle video recording from background context
  async function handleVideoRecordedBackground(
    videoData: any,
    sender: chrome.runtime.MessageSender
  ) {
    console.log("🎬 Handling video recording from background context");

    // Similar to handleVideoRecorded but with additional background-specific logic
    return handleVideoRecorded(videoData, sender);
  }

  // FIXED: Try to deliver video result to popup (MV3 compatible)
  async function tryDeliverToPopup(videoData: any): Promise<boolean> {
    try {
      // Method 1: Try direct runtime message (works if popup is open)
      try {
        await chrome.runtime.sendMessage({
          type: "VIDEO_RESULT_DELIVERY",
          data: videoData,
          timestamp: Date.now(),
        });
        console.log(
          "📤 Successfully delivered video result via runtime message"
        );
        return true;
      } catch (error) {
        console.log(
          "⚠️ Direct runtime message failed, trying alternative methods"
        );
      }

      // Method 2: Try sending to extension tabs
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url?.includes("chrome-extension://")) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: "VIDEO_RESULT_DELIVERY",
              data: videoData,
              timestamp: Date.now(),
            });
            console.log("📤 Delivered video result to extension tab:", tab.id);
            return true;
          } catch (error) {
            // Tab might not be able to receive messages, continue
          }
        }
      }

      // Method 3: Store for later pickup
      console.log("📦 No active popup/tabs found, storing for later pickup");
      return false;
    } catch (error) {
      console.error("❌ Error delivering to popup:", error);
      return false;
    }
  }

  // FIXED: Handle popup opened - deliver any pending results (MV3 compatible)
  async function handlePopupOpened(sender: chrome.runtime.MessageSender) {
    console.log("🎯 Popup opened, checking for pending results");

    try {
      // Check for pending video results
      const storage = await chrome.storage.local.get([
        "has_pending_video_results",
        "latest_video_result_id",
        "has_pending_region_capture",
        "latest_region_capture",
      ]);

      const result: any = { hasPendingResults: false };

      // Handle pending video results
      if (storage.has_pending_video_results && storage.latest_video_result_id) {
        const resultKey = `pending_video_${storage.latest_video_result_id}`;
        const videoResult = await chrome.storage.local.get([resultKey]);

        if (videoResult[resultKey] && !videoResult[resultKey].delivered) {
          console.log("📦 Found pending video result, delivering to popup");

          // Send to popup with delay to ensure it's ready
          setTimeout(async () => {
            try {
              await chrome.runtime.sendMessage({
                type: "VIDEO_RESULT_DELIVERY",
                data: videoResult[resultKey],
                timestamp: Date.now(),
              });

              // Mark as delivered
              await chrome.storage.local.set({
                [resultKey]: { ...videoResult[resultKey], delivered: true },
                has_pending_video_results: false,
              });

              console.log("✅ Successfully delivered pending video result");
            } catch (error) {
              console.error("❌ Error delivering pending video result:", error);
            }
          }, 1000);

          result.hasPendingVideoResults = true;
          result.videoResultId = storage.latest_video_result_id;
        }
      }

      // Handle pending region capture results
      if (storage.has_pending_region_capture && storage.latest_region_capture) {
        console.log("📦 Found pending region capture, delivering to popup");

        // Send to popup with delay to ensure it's ready
        setTimeout(async () => {
          try {
            await chrome.runtime.sendMessage({
              type: "REGION_CAPTURE_COMPLETED",
              data: storage.latest_region_capture,
            });

            // Mark as delivered
            await chrome.storage.local.set({
              has_pending_region_capture: false,
            });

            console.log("✅ Successfully delivered pending region capture");
          } catch (error) {
            console.error("❌ Error delivering pending region capture:", error);
          }
        }, 500);

        result.hasPendingRegionCapture = true;
        result.regionCaptureData = storage.latest_region_capture;
      }

      return result;
    } catch (error) {
      console.error("❌ Error handling popup opened:", error);
      throw error;
    }
  }

  // Handle recording window closed
  function handleRecordingWindowClosed(
    message: any,
    sender: chrome.runtime.MessageSender
  ) {
    console.log("📄 Recording window closed");

    // Clean up any pending operations related to this recording session
    // Could implement cleanup logic here if needed
  }

  // Handle recording cancelled
  function handleRecordingCancelled(
    message: any,
    sender: chrome.runtime.MessageSender
  ) {
    console.log("❌ Recording cancelled");

    // Clean up any pending operations
    // Could notify popup about cancellation if needed
  }

  // Get pending video results
  async function handleGetPendingResults(sender: chrome.runtime.MessageSender) {
    console.log("📋 Getting pending video results");

    try {
      const storage = await chrome.storage.local.get();
      const pendingResults = [];

      for (const [key, value] of Object.entries(storage)) {
        if (
          key.startsWith("pending_video_") &&
          typeof value === "object" &&
          value !== null
        ) {
          const result = value as any;
          if (!result.delivered) {
            pendingResults.push({
              id: key,
              ...result,
            });
          }
        }
      }

      return pendingResults;
    } catch (error) {
      console.error("❌ Error getting pending results:", error);
      throw error;
    }
  }

  // Cleanup old pending results (run periodically)
  function cleanupOldResults() {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    chrome.storage.local
      .get()
      .then((storage) => {
        const keysToRemove = [];

        for (const [key, value] of Object.entries(storage)) {
          if (
            (key.startsWith("pending_video_") || key.startsWith("region_session_")) &&
            typeof value === "object" &&
            value !== null
          ) {
            const result = value as any;
            if (result.timestamp && result.timestamp < cutoffTime) {
              keysToRemove.push(key);
            }
          }
        }

        if (keysToRemove.length > 0) {
          chrome.storage.local.remove(keysToRemove);
          console.log(
            "🧹 Cleaned up old pending results:",
            keysToRemove.length
          );
        }
      })
      .catch((error) => {
        console.error("❌ Error cleaning up old results:", error);
      });
  }

  // Run cleanup every hour
  setInterval(cleanupOldResults, 60 * 60 * 1000);

  // Initial cleanup on startup
  setTimeout(cleanupOldResults, 5000);

  console.log("✅ Background script initialized successfully");
});