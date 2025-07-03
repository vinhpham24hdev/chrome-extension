// services/regionSelectorService.ts - Fixed communication and timeout issues
export interface RegionSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RegionSelectorResult {
  success: boolean;
  region?: RegionSelection;
  error?: string;
}

export class RegionSelectorService {
  private static instance: RegionSelectorService;
  private selectorTab: chrome.tabs.Tab | null = null;
  private selectorTabId: number | null = null;
  private screenshotData: string | null = null;
  private currentCaseId: string | null = null;
  private onRegionSelectedCallback: ((region: RegionSelection) => void) | null =
    null;
  private onCancelledCallback: (() => void) | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private messageListener:
    | ((
        message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
      ) => void)
    | null = null;

  private constructor() {
    this.setupGlobalMessageListener();
    this.setupTabCloseListener();
  }

  public static getInstance(): RegionSelectorService {
    if (!RegionSelectorService.instance) {
      RegionSelectorService.instance = new RegionSelectorService();
    }
    return RegionSelectorService.instance;
  }

  /**
   * Start region selection in new tab (Loom-style)
   */
  /** * Start region selection using new overlay */
  async startRegionSelection(caseId: string): Promise<RegionSelectorResult> {
    try {
      this.currentCaseId = caseId;

      // Gửi lệnh tới background – overlay mới sẽ bật ngay trong tab hiện tại
      await chrome.runtime.sendMessage({ type: "REGION_START" });

      // Trả về thành công để UI biết đang chờ
      return { success: true };
    } catch (err) {
      console.error("Region start failed:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Clear timeout
   */
  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Capture screenshot of current active tab
   */
  private async captureCurrentTab(): Promise<{
    success: boolean;
    dataUrl?: string;
    error?: string;
  }> {
    try {
      console.log("📸 Capturing current tab for region selection...");

      if (typeof chrome === "undefined" || !chrome.tabs) {
        return {
          success: false,
          error: "Chrome tabs API not available",
        };
      }

      // Get current tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab || !tab.windowId) {
        return {
          success: false,
          error: "No active tab found",
        };
      }

      console.log("📋 Current tab for region selection:", {
        id: tab.id,
        url: tab.url?.substring(0, 50) + "...",
      });

      // Check for restricted URLs
      if (
        tab.url &&
        (tab.url.startsWith("chrome://") ||
          tab.url.startsWith("chrome-extension://") ||
          tab.url.startsWith("moz-extension://") ||
          tab.url.startsWith("about:"))
      ) {
        return {
          success: false,
          error: `Cannot capture restricted pages.\n\nCurrent page: ${this.getPageTypeDescription(
            tab.url
          )}\n\nPlease navigate to a regular website (like google.com, youtube.com, etc.) and try again.`,
        };
      }

      // Capture the tab
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: "png",
          quality: 100,
        });

        if (!dataUrl) {
          return {
            success: false,
            error: "Failed to capture tab - no data returned",
          };
        }

        console.log("✅ Tab captured successfully for region selection");
        return {
          success: true,
          dataUrl,
        };
      } catch (captureError) {
        console.error("❌ Capture error details:", captureError);

        const errorMessage =
          captureError instanceof Error
            ? captureError.message
            : String(captureError);

        if (errorMessage.includes("activeTab")) {
          return {
            success: false,
            error:
              "Permission denied. Please click the extension icon first, then try Region capture.",
          };
        }

        return {
          success: false,
          error: `Capture failed: ${errorMessage}`,
        };
      }
    } catch (error) {
      console.error("❌ Tab capture error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Tab capture failed",
      };
    }
  }

  /**
   * Get user-friendly description of page type
   */
  private getPageTypeDescription(url: string): string {
    if (url.startsWith("chrome://")) return "Chrome internal page";
    if (url.startsWith("chrome-extension://")) return "Extension page";
    if (url.startsWith("moz-extension://")) return "Firefox extension page";
    if (url.startsWith("about:")) return "Browser about page";
    return "Restricted page";
  }

  /**
   * Open region selector in new tab (Loom-style)
   */
  private async openRegionSelectorTab(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log("🆕 Opening region selector in new tab...");

      // Close existing tab if any
      await this.closeSelectorTab();

      // Create new tab for region selection
      const selectorTab = await chrome.tabs.create({
        url: chrome.runtime.getURL("region-selector.html"),
        active: true, // Focus the new tab immediately
      });

      if (!selectorTab || !selectorTab.id) {
        return {
          success: false,
          error: "Failed to create region selector tab",
        };
      }

      this.selectorTab = selectorTab;
      this.selectorTabId = selectorTab.id;

      console.log("✅ Region selector tab created:", selectorTab.id);

      return { success: true };
    } catch (error) {
      console.error("❌ Failed to create region selector tab:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create tab",
      };
    }
  }

  /**
   * Send screenshot data to selector tab with multiple retry attempts
   */
  private async sendDataToSelectorTab(): Promise<void> {
    if (!this.screenshotData || !this.selectorTabId) {
      console.warn("⚠️ Cannot send data: missing screenshot or tab ID");
      return;
    }

    const data = {
      type: "REGION_SELECTOR_DATA",
      data: {
        screenshot: this.screenshotData,
        caseId: this.currentCaseId,
        timestamp: Date.now(),
      },
    };

    console.log("📤 Sending screenshot data to selector tab...");

    // Try method 1: Direct tab message
    try {
      await chrome.tabs.sendMessage(this.selectorTabId, data);
      console.log("✅ Screenshot data sent via tabs.sendMessage");
      return;
    } catch (error) {
      console.warn("⚠️ tabs.sendMessage failed:", error);
    }

    // Try method 2: Runtime message with target
    try {
      await chrome.runtime.sendMessage({
        ...data,
        target: "region-selector-tab",
        tabId: this.selectorTabId,
      });
      console.log("✅ Screenshot data sent via runtime.sendMessage");
      return;
    } catch (error) {
      console.warn("⚠️ runtime.sendMessage failed:", error);
    }

    // Try method 3: Storage-based communication as fallback
    try {
      await chrome.storage.local.set({
        region_selector_data: {
          screenshot: this.screenshotData,
          caseId: this.currentCaseId,
          timestamp: Date.now(),
          tabId: this.selectorTabId,
        },
      });

      // Notify tab about storage update
      chrome.tabs
        .sendMessage(this.selectorTabId, {
          type: "REGION_DATA_IN_STORAGE",
          key: "region_selector_data",
        })
        .catch(() => {
          console.warn("⚠️ Failed to notify tab about storage data");
        });

      console.log("✅ Screenshot data stored and tab notified");
    } catch (error) {
      console.error("❌ All communication methods failed:", error);
    }
  }

  /**
   * Setup global message listener for communication with selector tab
   */
  private setupGlobalMessageListener(): void {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      // Remove existing listener if any
      if (this.messageListener) {
        chrome.runtime.onMessage.removeListener(this.messageListener);
      }

      this.messageListener = (message, sender, sendResponse) => {
        console.log(
          "📨 Global message received:",
          message.type,
          "from tab:",
          sender.tab?.id
        );

        // Handle messages from our selector tab
        if (sender.tab?.id === this.selectorTabId) {
          switch (message.type) {
            case "REGION_SELECTED":
              this.clearTimeout();
              this.handleRegionSelected(message.data);
              sendResponse({ success: true });
              return true;

            case "REGION_CANCELLED":
              this.clearTimeout();
              this.handleRegionCancelled();
              sendResponse({ success: true });
              return true;

            case "REGION_TAB_READY":
              console.log("🆕 Region selector tab ready, sending data...");
              // Small delay to ensure tab is fully ready
              setTimeout(() => {
                this.sendDataToSelectorTab();
              }, 500);
              sendResponse({ success: true });
              return true;

            default:
              sendResponse({ success: false, error: "Unknown message type" });
              return true;
          }
        }

        // Handle messages without tab context (from extension pages)
        if (!sender.tab && message.target === "region-selector-service") {
          switch (message.type) {
            case "REGION_TAB_READY":
              console.log(
                "🆕 Region selector ready (no tab context), sending data..."
              );
              setTimeout(() => {
                this.sendDataToSelectorTab();
              }, 500);
              sendResponse({ success: true });
              return true;
          }
        }

        return false; // Don't keep message channel open for other messages
      };

      chrome.runtime.onMessage.addListener(this.messageListener);
      console.log("✅ Global message listener setup for region selector");
    }
  }

  /**
   * Setup tab close listener
   */
  private setupTabCloseListener(): void {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
        if (tabId === this.selectorTabId) {
          console.log("🆕 Region selector tab closed");
          this.clearTimeout();
          this.cleanup();
          // Don't call cancelled callback if tab was closed normally
        }
      });
    }
  }

  /**
   * Handle region selection from selector tab
   */
  private handleRegionSelected(region: RegionSelection): void {
    console.log("✅ Region selected in tab:", region);
    if (this.onRegionSelectedCallback) {
      this.onRegionSelectedCallback(region);
    }
    this.closeSelectorTab();
  }

  /**
   * Handle region selection cancellation
   */
  private handleRegionCancelled(): void {
    console.log("❌ Region selection cancelled or timeout");
    if (this.onCancelledCallback) {
      this.onCancelledCallback();
    }
    this.closeSelectorTab();
  }

  /**
   * Close selector tab
   */
  private async closeSelectorTab(): Promise<void> {
    if (this.selectorTabId) {
      try {
        await chrome.tabs.remove(this.selectorTabId);
        console.log("🆕 Selector tab closed");
      } catch (error) {
        console.warn("⚠️ Failed to close selector tab:", error);
      }
    }
    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.clearTimeout();
    this.selectorTab = null;
    this.selectorTabId = null;
    this.screenshotData = null;
    this.currentCaseId = null;
    this.onRegionSelectedCallback = null;
    this.onCancelledCallback = null;

    // Clean up storage
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.remove(["region_selector_data"]).catch(() => {
        // Ignore cleanup errors
      });
    }
  }

  /**
   * Set callback for region selection
   */
  onRegionSelected(callback: (region: RegionSelection) => void): void {
    this.onRegionSelectedCallback = callback;
  }

  /**
   * Set callback for cancellation
   */
  onCancelled(callback: () => void): void {
    this.onCancelledCallback = callback;
  }

  /**
   * Check if selector is currently active
   */
  isActive(): boolean {
    return this.selectorTabId !== null;
  }

  /**
   * Force close selector
   */
  async forceClose(): Promise<void> {
    await this.closeSelectorTab();
  }

  /**
   * Focus selector tab if open
   */
  async focusSelectorTab(): Promise<boolean> {
    if (this.selectorTabId) {
      try {
        await chrome.tabs.update(this.selectorTabId, { active: true });
        return true;
      } catch (error) {
        console.warn("⚠️ Failed to focus selector tab:", error);
      }
    }
    return false;
  }
}

// Export singleton instance
export const regionSelectorService = RegionSelectorService.getInstance();
