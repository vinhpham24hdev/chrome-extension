// entrypoints/background.ts - Fixed coordinates and popup behavior
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
          return true;

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
      console.log("🎯 Background: Starting region capture for session:", sessionId);

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

      console.log("📋 Injecting region selector into tab:", activeTab.id, activeTab.url);

      // Inject region selector into the active tab
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: initializeFixedRegionSelector,
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

  // 🔥 FIXED: Handle region selection with correct coordinates and immediate preview
  async function handleRegionSelected(
    message: any,
    sender: chrome.runtime.MessageSender
  ) {
    const { sessionId, region } = message;

    try {
      console.log("🎯 Background: Processing region selection:", region);

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
        throw new Error("Session data not found - may have expired or been cleaned up");
      }

      console.log("✅ Found session data:", {
        hasDataUrl: !!sessionData.dataUrl,
        filename: sessionData.filename,
        caseId: sessionData.caseId,
      });

      // 🔥 FIXED: Use content script for proper coordinate-based cropping
      if (!sender.tab?.id) {
        throw new Error("No sender tab ID available for image processing");
      }

      // Execute cropping in content script with exact pixel coordinates
      const cropResults = await chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        func: cropImageWithExactCoordinates,
        args: [sessionData.dataUrl, region],
      });

      if (!cropResults || !cropResults[0] || !cropResults[0].result) {
        throw new Error("Failed to execute image cropping in content script");
      }

      const croppedResult = cropResults[0].result;

      if (!croppedResult.success) {
        console.error("❌ Crop failed:", croppedResult.error);
        throw new Error(croppedResult.error || "Failed to crop image to selected region");
      }

      console.log("✅ Image cropped successfully with exact coordinates");

      // Generate filename for cropped image
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const domain = extractDomainFromUrl(sessionData.sourceUrl || "unknown");
      const filename = `region_${region.width}x${region.height}_${domain}_${timestamp}.png`;

      console.log("🖼️ Generated filename:", filename);

      // Prepare data for immediate preview window
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

      console.log("🪟 Opening preview window immediately...");

      // 🔥 FIXED: Open preview window immediately, not wait for popup reopen
      try {
        const previewHtmlUrl = chrome.runtime.getURL("screenshot-preview.html");
        const previewId = `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const previewUrl = `${previewHtmlUrl}?id=${previewId}&type=region&timestamp=${Date.now()}`;

        // Store preview data
        await chrome.storage.local.set({
          [`screenshot_preview_${previewId}`]: regionCaptureData,
          latest_region_capture: regionCaptureData,
        });

        // Create preview window immediately
        const window = await chrome.windows.create({
          url: previewUrl,
          type: "popup",
          width: 1400,
          height: 900,
          focused: true,
          state: "normal",
        });

        if (window && window.id) {
          console.log("✅ Preview window opened immediately:", window.id);
          
          // Send data to preview window
          setTimeout(() => {
            chrome.runtime.sendMessage({
              type: "SCREENSHOT_DATA",
              data: regionCaptureData,
            }).catch(() => {
              // Preview window might not be ready yet, data is stored anyway
            });
          }, 1000);
        }

      } catch (windowError) {
        console.error("❌ Failed to open preview window:", windowError);
        // Store for later pickup as fallback
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
        previewOpened: true,
      };
    } catch (error) {
      console.error("❌ REGION CAPTURE FAILED:", error);

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

  // Extract domain from URL for filename
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

  // 🔥 FIXED: Crop image function with exact pixel coordinates
  function cropImageWithExactCoordinates(
    dataUrl: string,
    region: { x: number; y: number; width: number; height: number }
  ): Promise<{
    success: boolean;
    dataUrl?: string;
    error?: string;
  }> {
    return new Promise((resolve) => {
      try {
        console.log("🖼️ Cropping with exact coordinates:", {
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
              imageWidth: img.width,
              imageHeight: img.height,
              requestedRegion: region,
            });

            // 🔥 FIXED: Use exact coordinates without adjustment unless absolutely necessary
            let cropRegion = { ...region };
            
            // Only adjust if region is completely outside bounds
            if (region.x + region.width > img.width) {
              cropRegion.width = Math.max(1, img.width - region.x);
              console.warn("⚠️ Adjusted width to fit image bounds");
            }
            if (region.y + region.height > img.height) {
              cropRegion.height = Math.max(1, img.height - region.y);
              console.warn("⚠️ Adjusted height to fit image bounds");
            }
            if (region.x < 0) {
              cropRegion.x = 0;
              cropRegion.width = region.width + region.x;
              console.warn("⚠️ Adjusted x coordinate to 0");
            }
            if (region.y < 0) {
              cropRegion.y = 0;
              cropRegion.height = region.height + region.y;
              console.warn("⚠️ Adjusted y coordinate to 0");
            }

            console.log("📐 Final crop region:", cropRegion);

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              resolve({
                success: false,
                error: "Canvas context not available in content script",
              });
              return;
            }

            // Set canvas dimensions to exact region size
            canvas.width = cropRegion.width;
            canvas.height = cropRegion.height;

            console.log("📐 Canvas created with exact dimensions:", {
              canvasWidth: canvas.width,
              canvasHeight: canvas.height,
            });

            // Fill with white background first
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 🔥 FIXED: Draw the exact region with precise coordinates
            ctx.drawImage(
              img,
              cropRegion.x,          // Source X (exact pixel)
              cropRegion.y,          // Source Y (exact pixel)  
              cropRegion.width,      // Source Width (exact pixels)
              cropRegion.height,     // Source Height (exact pixels)
              0,                     // Destination X (canvas origin)
              0,                     // Destination Y (canvas origin)
              cropRegion.width,      // Destination Width (same as source)
              cropRegion.height      // Destination Height (same as source)
            );

            console.log("✅ Image drawn to canvas with exact coordinates");

            // Convert to dataURL with high quality
            const croppedDataUrl = canvas.toDataURL("image/png", 1.0);
            
            console.log("✅ Exact coordinate crop completed:", {
              originalRegion: region,
              finalRegion: cropRegion,
              resultDataUrlLength: croppedDataUrl.length,
            });

            resolve({
              success: true,
              dataUrl: croppedDataUrl,
            });

          } catch (canvasError) {
            console.error("❌ Canvas drawing error:", canvasError);
            resolve({
              success: false,
              error: canvasError instanceof Error ? canvasError.message : "Canvas drawing failed",
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

        img.crossOrigin = "anonymous";
        img.src = dataUrl;
      } catch (initError) {
        console.error("❌ Crop initialization error:", initError);
        resolve({
          success: false,
          error: initError instanceof Error ? initError.message : "Image cropping initialization failed",
        });
      }
    });
  }

  // 🔥 FIXED: Region Selector with accurate coordinate tracking
  function initializeFixedRegionSelector(sessionId: string) {
    console.log("🎯 Initializing FIXED region selector for session:", sessionId);

    // Remove any existing region selector
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
      background: rgba(0, 0, 0, 0.4) !important;
      z-index: 2147483647 !important;
      cursor: crosshair !important;
      user-select: none !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      backdrop-filter: blur(2px) !important;
    `;

    // Create instruction panel
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
    `;
    instruction.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <span style="font-size: 18px;">🎯</span>
        <span>Click and drag to select region</span>
      </div>
      <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
        Preview will open automatically • Press <strong>ESC</strong> to cancel
      </div>
    `;

    // Create selection box
    const selectionBox = document.createElement("div");
    selectionBox.style.cssText = `
      position: absolute !important;
      border: 3px solid #4285f4 !important;
      background: rgba(66, 133, 244, 0.1) !important;
      display: none !important;
      pointer-events: none !important;
      z-index: 2147483648 !important;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8) !important;
      border-radius: 4px !important;
    `;

    // Create dimension display
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

    overlay.appendChild(instruction);
    overlay.appendChild(selectionBox);
    overlay.appendChild(dimensionDisplay);
    document.body.appendChild(overlay);

    console.log("🎨 Fixed region selector UI created");

    // 🔥 FIXED: Precise coordinate tracking
    let isSelecting = false;
    let startX = 0, startY = 0;

    // Get page scroll offset for accurate coordinates
    const getScrollOffset = () => ({
      x: window.pageXOffset || document.documentElement.scrollLeft || 0,
      y: window.pageYOffset || document.documentElement.scrollTop || 0,
    });

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

      instruction.style.opacity = "0.7";
      instruction.style.transform = "translateX(-50%) scale(0.95)";

      console.log("🖱️ Selection started at viewport coordinates:", { x: startX, y: startY });
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

      dimensionDisplay.textContent = `${width} × ${height}px`;
      
      // Position dimension display
      let dimLeft = left + width + 12;
      let dimTop = top;
      
      if (dimLeft + 80 > window.innerWidth) {
        dimLeft = left - 90;
      }
      if (dimTop < 10) {
        dimTop = top + height + 12;
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

      // 🔥 FIXED: Calculate exact coordinates including scroll offset
      const scrollOffset = getScrollOffset();
      const exactRegion = {
        x: left + scrollOffset.x,
        y: top + scrollOffset.y,
        width: width,
        height: height,
      };

      console.log("🖱️ Selection completed:", {
        viewportCoords: { x: left, y: top, width, height },
        scrollOffset: scrollOffset,
        exactPageCoords: exactRegion,
      });

      // Minimum size check
      if (width >= 10 && height >= 10) {
        console.log("✅ Valid region selected, sending exact coordinates to background...");

        // Show completion animation
        selectionBox.style.background = "rgba(76, 175, 80, 0.2)";
        selectionBox.style.borderColor = "#4caf50";
        
        instruction.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span style="font-size: 18px;">✅</span>
            <span>Region captured!</span>
          </div>
          <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
            Opening preview window...
          </div>
        `;
        instruction.style.background = "linear-gradient(135deg, #4caf50 0%, #45a049 100%)";

        // Send exact coordinates to background script
        chrome.runtime
          .sendMessage({
            type: "REGION_SELECTED",
            sessionId: sessionId,
            region: exactRegion, // Send exact page coordinates
          })
          .then((response) => {
            console.log("📤 Exact coordinates sent to background:", response);
            if (response && response.success) {
              console.log("✅ Background processed region successfully");
            } else {
              console.error("❌ Background failed to process region:", response?.error);
            }
            
            // Clean up after success/error
            setTimeout(() => {
              cleanup();
            }, 1000);
          })
          .catch((error) => {
            console.error("❌ Error sending region data to background:", error);
            setTimeout(() => {
              cleanup();
            }, 1000);
          });
      } else {
        console.log("❌ Region too small, showing error");
        
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
        instruction.style.background = "linear-gradient(135deg, #ff5722 0%, #f44336 100%)";
        
        // Reset after error
        setTimeout(() => {
          selectionBox.style.display = "none";
          dimensionDisplay.style.display = "none";
          instruction.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 18px;">🎯</span>
              <span>Click and drag to select region</span>
            </div>
            <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
              Preview will open automatically • Press <strong>ESC</strong> to cancel
            </div>
          `;
          instruction.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
          instruction.style.opacity = "1";
          instruction.style.transform = "translateX(-50%) scale(1)";
          isSelecting = false;
        }, 1500);
      }
    });

    // ESC key - cancel selection
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        console.log("❌ Region selection cancelled by ESC");
        
        instruction.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span style="font-size: 18px;">❌</span>
            <span>Cancelled</span>
          </div>
        `;
        instruction.style.background = "linear-gradient(135deg, #757575 0%, #616161 100%)";
        
        chrome.runtime
          .sendMessage({
            type: "REGION_CANCELLED",
            sessionId: sessionId,
          })
          .catch((error) => {
            console.error("❌ Error sending cancellation:", error);
          });
        
        setTimeout(() => {
          cleanup();
        }, 1000);
      }
    };

    // Cleanup function
    const cleanup = () => {
      if (document.body.contains(overlay)) {
        overlay.style.transition = "opacity 0.3s ease-out";
        overlay.style.opacity = "0";
        
        setTimeout(() => {
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
          }
        }, 300);
      }
      
      document.removeEventListener("keydown", handleKeyDown);
      isSelecting = false;
      console.log("🧹 Fixed region selector cleaned up");
    };

    document.addEventListener("keydown", handleKeyDown);

    // Auto-cleanup after 3 minutes
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        console.log("⏰ Region selector auto-cleanup");
        chrome.runtime
          .sendMessage({
            type: "REGION_CANCELLED",
            sessionId: sessionId,
          })
          .catch(() => {});
        cleanup();
      }
    }, 180000);

    console.log("✅ Fixed region selector initialization complete");
  }

  console.log("✅ Fixed background script initialized successfully");
});