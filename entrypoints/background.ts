// entrypoints/background.ts - Loom-style Region Capture for Manifest V3
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
          return true;

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
        "🎯 Background: Starting Loom-style region capture for session:",
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
        func: initializeLoomStyleRegionSelector,
        args: [sessionId],
      });

      console.log("✅ Loom-style region selector injected successfully");

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
  async function handleRegionSelected(
    message: any,
    sender: chrome.runtime.MessageSender
  ) {
    const { sessionId, region } = message;

    try {
      console.log(
        "🎯 Background: Processing Loom-style region selection:",
        region
      );
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

      // 🔥 FIXED: Use content script for image processing instead of background
      console.log("📸 Starting image crop process in content script...");

      // Get the tab that sent the message (where the region was selected)
      if (!sender.tab?.id) {
        throw new Error("No sender tab ID available for image processing");
      }

      // Execute cropping in content script where DOM/Image APIs are available
      const cropResults = await chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        func: cropImageInContentScript,
        args: [sessionData.dataUrl, region],
      });

      if (!cropResults || !cropResults[0] || !cropResults[0].result) {
        throw new Error("Failed to execute image cropping in content script");
      }

      const croppedResult = cropResults[0].result;

      if (!croppedResult.success) {
        console.error("❌ Crop failed:", croppedResult.error);
        throw new Error(
          croppedResult.error || "Failed to crop image to selected region"
        );
      }

      console.log("✅ Image cropped successfully in content script");

      // Generate filename for cropped image
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const domain = extractDomainFromUrl(sessionData.sourceUrl || "unknown");
      const filename = `region_${region.width}x${region.height}_${domain}_${timestamp}.png`;

      console.log("🖼️ Generated filename:", filename);

      // 🔥 LOOM-STYLE: Store the result for when popup reopens
      const regionCaptureData = {
        dataUrl: croppedResult.dataUrl,
        filename: filename,
        timestamp: sessionData.timestamp,
        type: "screenshot-region",
        caseId: sessionData.caseId,
        sourceUrl: sessionData.sourceUrl,
        region: region,
        completedAt: new Date().toISOString(),
      };

      console.log("💾 Storing region capture result for popup pickup...");

      // Store result for when popup reopens
      await chrome.storage.local.set({
        latest_region_capture: regionCaptureData,
        has_pending_region_capture: true,
        region_capture_completed_time: Date.now(),
      });

      console.log("✅ Region capture result stored successfully");

      // Try to notify popup if it's still open (unlikely but possible)
      try {
        await chrome.runtime.sendMessage({
          type: "REGION_CAPTURE_COMPLETED",
          data: regionCaptureData,
        });
        console.log("📤 Notified popup of region capture completion");
      } catch (messageError) {
        console.log("📦 Popup closed - result stored for later pickup");
      }

      // Cleanup session data
      await chrome.storage.local.remove([`region_session_${sessionId}`]);
      console.log("🧹 Session data cleaned up");

      console.log(
        "🎉 Loom-style region capture workflow completed successfully!"
      );

      return {
        success: true,
        filename: filename,
        region: region,
        caseId: sessionData.caseId,
        storedForPickup: true,
      };
    } catch (error) {
      console.error("❌ LOOM-STYLE REGION CAPTURE FAILED:", error);

      // Enhanced error logging with full context
      console.error("❌ Full error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        sessionId: sessionId,
        region: region,
        timestamp: new Date().toISOString(),
      });

      // Store error for popup pickup
      try {
        await chrome.storage.local.set({
          region_capture_error: {
            error:
              error instanceof Error ? error.message : "Region capture failed",
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
          },
          has_region_capture_error: true,
        });
      } catch (storageError) {
        console.warn("⚠️ Failed to store error for pickup:", storageError);
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

  function cropImageInContentScript(
    dataUrl: string,
    region: { x: number; y: number; width: number; height: number }
  ): Promise<{
    success: boolean;
    dataUrl?: string;
    error?: string;
  }> {
    return new Promise((resolve) => {
      try {
        console.log("🖼️ Starting image crop in content script:", {
          region,
          dataUrlLength: dataUrl ? dataUrl.length : 0,
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

            // Validate and adjust region to fit within image bounds
            let adjustedRegion = { ...region };

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

              adjustedRegion = {
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

              console.log("📐 Adjusted region:", adjustedRegion);
            }

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              resolve({
                success: false,
                error: "Canvas context not available in content script",
              });
              return;
            }

            // Set canvas dimensions to region size
            canvas.width = adjustedRegion.width;
            canvas.height = adjustedRegion.height;

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
              adjustedRegion.x,
              adjustedRegion.y,
              adjustedRegion.width,
              adjustedRegion.height, // Source rectangle
              0,
              0,
              adjustedRegion.width,
              adjustedRegion.height // Destination rectangle
            );

            console.log("✅ Image drawn to canvas in content script");

            // Convert to dataURL
            const croppedDataUrl = canvas.toDataURL("image/png", 1.0);

            console.log("✅ Crop completed in content script:", {
              dataUrlLength: croppedDataUrl.length,
            });

            resolve({
              success: true,
              dataUrl: croppedDataUrl,
            });
          } catch (canvasError) {
            console.error(
              "❌ Canvas drawing error in content script:",
              canvasError
            );
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
          console.error("❌ Image load error in content script:", error);
          resolve({
            success: false,
            error: "Failed to load base image for cropping",
          });
        };

        // Set cross-origin attribute for data URLs
        img.crossOrigin = "anonymous";

        // Load the image
        img.src = dataUrl;
      } catch (initError) {
        console.error(
          "❌ Crop initialization error in content script:",
          initError
        );
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

  // Handle region capture cancellation
  async function handleRegionCancelled(
    message: any,
    sender: chrome.runtime.MessageSender
  ) {
    const { sessionId } = message;
    console.log(
      "❌ Loom-style region capture cancelled for session:",
      sessionId
    );

    // Store cancellation for popup pickup
    try {
      await chrome.storage.local.set({
        region_capture_cancelled: true,
        region_capture_cancelled_time: Date.now(),
      });
    } catch (storageError) {
      console.warn("⚠️ Failed to store cancellation:", storageError);
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

  // 🎯 LOOM-STYLE: Region Selector Injection Function
  function initializeLoomStyleRegionSelector(sessionId: string) {
    console.log(
      "🎯 Initializing Loom-style region selector on page for session:",
      sessionId
    );

    // Remove any existing region selector (safety measure)
    const existing = document.getElementById("cellebrite-region-selector");
    if (existing) {
      existing.remove();
      console.log("🧹 Removed existing region selector");
    }

    // Create overlay container with Loom-style design
    const overlay = document.createElement("div");
    overlay.id = "cellebrite-region-selector";
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(0, 0, 0, 0.4) !important;
      z-index: 2147483647 !important;
      cursor: crosshair !important;
      user-select: none !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      backdrop-filter: blur(2px) !important;
    `;

    // Create Loom-style instruction panel
    const instruction = document.createElement("div");
    instruction.style.cssText = `
      position: absolute !important;
      top: 30px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
      padding: 16px 24px !important;
      border-radius: 12px !important;
      font-size: 15px !important;
      font-weight: 600 !important;
      pointer-events: none !important;
      z-index: 2147483648 !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
      text-align: center !important;
      animation: slideInDown 0.3s ease-out !important;
    `;
    instruction.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <span style="font-size: 18px;">🎯</span>
        <span>Click and drag to select region</span>
      </div>
      <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
        Press <strong>ESC</strong> to cancel
      </div>
    `;

    // Create selection box with Loom-style design
    const selectionBox = document.createElement("div");
    selectionBox.style.cssText = `
      position: absolute !important;
      border: 3px solid #4285f4 !important;
      background: rgba(66, 133, 244, 0.1) !important;
      display: none !important;
      pointer-events: none !important;
      z-index: 2147483648 !important;
      box-shadow: 
        0 0 0 1px rgba(255, 255, 255, 0.8),
        0 4px 16px rgba(66, 133, 244, 0.4) !important;
      border-radius: 4px !important;
    `;

    // Create dimension display with Loom-style design
    const dimensionDisplay = document.createElement("div");
    dimensionDisplay.style.cssText = `
      position: absolute !important;
      background: linear-gradient(135deg, #4285f4 0%, #1a73e8 100%) !important;
      color: white !important;
      padding: 6px 12px !important;
      border-radius: 8px !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      display: none !important;
      pointer-events: none !important;
      z-index: 2147483649 !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
      white-space: nowrap !important;
    `;

    // Add CSS animations
    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideInDown {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
      @keyframes pulseSelection {
        0%, 100% { 
          box-shadow: 
            0 0 0 1px rgba(255, 255, 255, 0.8),
            0 4px 16px rgba(66, 133, 244, 0.4);
        }
        50% { 
          box-shadow: 
            0 0 0 1px rgba(255, 255, 255, 1),
            0 4px 20px rgba(66, 133, 244, 0.6);
        }
      }
    `;
    document.head.appendChild(style);

    overlay.appendChild(instruction);
    overlay.appendChild(selectionBox);
    overlay.appendChild(dimensionDisplay);
    document.body.appendChild(overlay);

    console.log("🎨 Loom-style region selector UI created and attached");

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
      selectionBox.style.animation = "pulseSelection 1.5s infinite";
      dimensionDisplay.style.display = "block";

      // Fade and scale instruction
      instruction.style.opacity = "0.7";
      instruction.style.transform = "translateX(-50%) scale(0.95)";
      instruction.style.transition = "all 0.2s ease";

      console.log("🖱️ Loom-style selection started at:", {
        x: startX,
        y: startY,
      });
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

      // Update dimension display with better positioning
      dimensionDisplay.textContent = `${width} × ${height}px`;

      // Smart positioning for dimension display
      let dimLeft = left + width + 12;
      let dimTop = top;

      // Keep dimension display in viewport
      if (dimLeft + 80 > window.innerWidth) {
        dimLeft = left - 90;
      }
      if (dimTop < 10) {
        dimTop = top + height + 12;
      }
      if (dimTop + 30 > window.innerHeight) {
        dimTop = top - 35;
      }

      dimensionDisplay.style.left = dimLeft + "px";
      dimensionDisplay.style.top = dimTop + "px";
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

      console.log("🖱️ Loom-style selection completed:", {
        x: left,
        y: top,
        width,
        height,
      });

      // Minimum size check (10x10 pixels)
      if (width >= 10 && height >= 10) {
        console.log("✅ Valid region selected, sending to background...");

        // Show completion animation
        selectionBox.style.animation = "none";
        selectionBox.style.background = "rgba(76, 175, 80, 0.2)";
        selectionBox.style.borderColor = "#4caf50";

        // Update instruction to show success
        instruction.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span style="font-size: 18px;">✅</span>
            <span>Region captured!</span>
          </div>
          <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
            Processing... Reopen popup to see result
          </div>
        `;
        instruction.style.background =
          "linear-gradient(135deg, #4caf50 0%, #45a049 100%)";

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

              // Clean up after brief success animation
              setTimeout(() => {
                cleanup();
              }, 1000);
            } else {
              console.error(
                "❌ Background failed to process region:",
                response?.error
              );
              // Still cleanup on error
              setTimeout(() => {
                cleanup();
              }, 2000);
            }
          })
          .catch((error) => {
            console.error("❌ Error sending region data to background:", error);
            // Cleanup on error
            setTimeout(() => {
              cleanup();
            }, 2000);
          });
      } else {
        console.log("❌ Region too small (minimum 10x10px), cancelling");

        // Show error animation
        selectionBox.style.background = "rgba(244, 67, 54, 0.2)";
        selectionBox.style.borderColor = "#f44336";

        instruction.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span style="font-size: 18px;">⚠️</span>
            <span>Selection too small</span>
          </div>
          <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
            Drag to select a larger area
          </div>
        `;
        instruction.style.background =
          "linear-gradient(135deg, #ff5722 0%, #f44336 100%)";

        // Reset after showing error
        setTimeout(() => {
          selectionBox.style.display = "none";
          dimensionDisplay.style.display = "none";
          instruction.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 18px;">🎯</span>
              <span>Click and drag to select region</span>
            </div>
            <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
              Press <strong>ESC</strong> to cancel
            </div>
          `;
          instruction.style.background =
            "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
          instruction.style.opacity = "1";
          instruction.style.transform = "translateX(-50%) scale(1)";
          isSelecting = false;
        }, 1500);

        return;
      }
    });

    // ESC key - cancel selection
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        console.log("❌ Loom-style region selection cancelled by ESC key");

        // Show cancellation animation
        instruction.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span style="font-size: 18px;">❌</span>
            <span>Cancelled</span>
          </div>
          <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
            No region was captured
          </div>
        `;
        instruction.style.background =
          "linear-gradient(135deg, #757575 0%, #616161 100%)";

        chrome.runtime
          .sendMessage({
            type: "REGION_CANCELLED",
            sessionId: sessionId,
          })
          .catch((error) => {
            console.error("❌ Error sending ESC cancellation:", error);
          });

        setTimeout(() => {
          cleanup();
        }, 1000);
      }
    };

    // Cleanup function
    const cleanup = () => {
      if (document.body.contains(overlay)) {
        // Fade out animation
        overlay.style.transition = "opacity 0.3s ease-out";
        overlay.style.opacity = "0";

        setTimeout(() => {
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
          }
        }, 300);
      }

      document.removeEventListener("keydown", handleKeyDown);

      // Remove injected styles
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }

      isSelecting = false;
      console.log("🧹 Loom-style region selector cleaned up");
    };

    document.addEventListener("keydown", handleKeyDown);

    // Auto-cleanup after 3 minutes (safety measure)
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        console.log(
          "⏰ Loom-style region selector auto-cleanup after 3 minutes timeout"
        );
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
    }, 180000); // 3 minutes

    console.log("✅ Loom-style region selector initialization complete");
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

  // 🔥 LOOM-STYLE: Handle popup opened - deliver any pending results
  async function handlePopupOpened(sender: chrome.runtime.MessageSender) {
    console.log("🎯 Popup opened, checking for pending results (Loom-style)");

    try {
      // Check for pending region capture results
      const storage = await chrome.storage.local.get([
        "has_pending_video_results",
        "latest_video_result_id",
        "has_pending_region_capture",
        "latest_region_capture",
        "has_region_capture_error",
        "region_capture_error",
        "region_capture_cancelled",
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

      // 🔥 LOOM-STYLE: Handle pending region capture results
      if (storage.has_pending_region_capture && storage.latest_region_capture) {
        console.log("📦 Found pending region capture result, notifying popup");

        result.hasPendingRegionCapture = true;
        result.regionCaptureData = storage.latest_region_capture;

        // Clear the pending flag since popup will handle it
        setTimeout(async () => {
          try {
            await chrome.storage.local.set({
              has_pending_region_capture: false,
            });
            console.log("✅ Cleared pending region capture flag");
          } catch (error) {
            console.error("❌ Error clearing pending flag:", error);
          }
        }, 500);
      }

      // Handle region capture errors
      if (storage.has_region_capture_error && storage.region_capture_error) {
        console.log("📦 Found region capture error, notifying popup");

        result.hasRegionCaptureError = true;
        result.regionCaptureError = storage.region_capture_error;

        // Clear the error flag
        setTimeout(async () => {
          try {
            await chrome.storage.local.set({
              has_region_capture_error: false,
            });
          } catch (error) {
            console.error("❌ Error clearing error flag:", error);
          }
        }, 500);
      }

      // Handle region capture cancellation
      if (storage.region_capture_cancelled) {
        console.log("📦 Found region capture cancellation, notifying popup");

        result.regionCaptureCancelled = true;

        // Clear the cancellation flag
        setTimeout(async () => {
          try {
            await chrome.storage.local.set({
              region_capture_cancelled: false,
            });
          } catch (error) {
            console.error("❌ Error clearing cancellation flag:", error);
          }
        }, 500);
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
            (key.startsWith("pending_video_") ||
              key.startsWith("region_session_") ||
              key === "latest_region_capture" ||
              key === "region_capture_error") &&
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

  console.log("✅ Loom-style background script initialized successfully");
});
