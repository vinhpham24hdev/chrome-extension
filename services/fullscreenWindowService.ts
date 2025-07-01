// services/fullscreenWindowService.ts - macOS style fullscreen window overlay
export interface RegionSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class FullscreenWindowService {
  private static instance: FullscreenWindowService;
  private regionWindow: chrome.windows.Window | null = null;
  private regionWindowId: number | null = null;
  private screenshotData: string | null = null;
  private onRegionSelectedCallback: ((region: RegionSelection) => void) | null = null;
  private onCancelledCallback: (() => void) | null = null;

  private constructor() {
    this.setupMessageListener();
  }

  public static getInstance(): FullscreenWindowService {
    if (!FullscreenWindowService.instance) {
      FullscreenWindowService.instance = new FullscreenWindowService();
    }
    return FullscreenWindowService.instance;
  }

  /**
   * Start region selection with fullscreen window overlay
   */
  async startRegionSelection(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Step 1: Capture current tab screenshot
      const screenshot = await this.captureCurrentTab();
      
      if (!screenshot.success) {
        return {
          success: false,
          error: screenshot.error || 'Failed to capture screenshot'
        };
      }

      this.screenshotData = screenshot.dataUrl!;

      // Step 2: Open fullscreen overlay window
      const windowResult = await this.openFullscreenOverlay();
      
      if (!windowResult.success) {
        return {
          success: false,
          error: windowResult.error || 'Failed to open overlay window'
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Region selection failed'
      };
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
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        return {
          success: false,
          error: 'Chrome tabs API not available'
        };
      }

      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.windowId) {
        return {
          success: false,
          error: 'No active tab found'
        };
      }

      // Capture visible tab
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 100
      });

      if (!dataUrl) {
        return {
          success: false,
          error: 'Failed to capture tab'
        };
      }

      return {
        success: true,
        dataUrl
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tab capture failed'
      };
    }
  }

  /**
   * Open fullscreen overlay window
   */
  private async openFullscreenOverlay(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Close existing window if any
      await this.closeOverlayWindow();

      // Get display info with fallback
      let displayInfo = {
        left: 0,
        top: 0,
        width: screen.width || 1920,
        height: screen.height || 1080
      };

      // Try to get display info from chrome API (with error handling)
      try {
        if (typeof chrome !== 'undefined' && chrome.system && chrome.system.display) {
          const displays = await chrome.system.display.getInfo();
          const primaryDisplay = displays.find(d => d.isPrimary) || displays[0];
          
          if (primaryDisplay && primaryDisplay.bounds) {
            displayInfo = {
              left: primaryDisplay.bounds.left,
              top: primaryDisplay.bounds.top,
              width: primaryDisplay.bounds.width,
              height: primaryDisplay.bounds.height
            };
          }
        }
      } catch (displayError) {
        console.warn('⚠️ Could not get display info, using fallback:', displayError);
        // Use screen API fallback - use globalThis to avoid naming conflict
        displayInfo = {
          left: 0,
          top: 0,
          width: globalThis.screen?.width || 1920,
          height: globalThis.screen?.height || 1080
        };
      }

      console.log('📐 Using display info:', displayInfo);

      // Create fullscreen window with WXT-generated URL
      // Note: Can't use explicit dimensions with state: 'fullscreen' 
      const overlayWindow = await chrome.windows.create({
        url: chrome.runtime.getURL('region-selector.html'),
        type: 'popup',
        focused: true,
        state: 'maximized'  // Use maximized instead of fullscreen to avoid conflicts
      });

      if (!overlayWindow || !overlayWindow.id) {
        return {
          success: false,
          error: 'Failed to create overlay window'
        };
      }

      this.regionWindow = overlayWindow;
      this.regionWindowId = overlayWindow.id;

      // Setup window close listener
      this.setupWindowCloseListener();

      // Send screenshot data to window after it loads
      setTimeout(() => {
        this.sendDataToOverlayWindow();
      }, 500);

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create overlay'
      };
    }
  }

  /**
   * Send screenshot data to overlay window
   */
  private sendDataToOverlayWindow(): void {
    if (!this.screenshotData || !this.regionWindowId) return;

    chrome.runtime.sendMessage({
      type: 'REGION_SELECTOR_DATA',
      data: {
        screenshot: this.screenshotData,
        timestamp: Date.now()
      },
      target: 'region-selector-window'
    }).catch(error => {
      console.warn('Failed to send data to overlay window:', error);
    });
  }

  /**
   * Setup message listener for communication with overlay window
   */
  private setupMessageListener(): void {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'REGION_SELECTED' && sender.tab === undefined) {
          // Message from extension window (not content script)
          this.handleRegionSelected(message.data);
          sendResponse({ success: true });
        }

        if (message.type === 'REGION_CANCELLED' && sender.tab === undefined) {
          this.handleRegionCancelled();
          sendResponse({ success: true });
        }

        if (message.type === 'REGION_WINDOW_READY' && sender.tab === undefined) {
          // Window is ready, send screenshot data
          this.sendDataToOverlayWindow();
          sendResponse({ success: true });
        }

        return true;
      });
    }
  }

  /**
   * Setup window close listener
   */
  private setupWindowCloseListener(): void {
    if (!this.regionWindowId) return;

    const handleWindowRemoved = (windowId: number) => {
      if (windowId === this.regionWindowId) {
        this.cleanup();
        chrome.windows.onRemoved.removeListener(handleWindowRemoved);
      }
    };

    chrome.windows.onRemoved.addListener(handleWindowRemoved);
  }

  /**
   * Handle region selection from overlay window
   */
  private handleRegionSelected(region: RegionSelection): void {
    if (this.onRegionSelectedCallback) {
      this.onRegionSelectedCallback(region);
    }
    this.closeOverlayWindow();
  }

  /**
   * Handle region selection cancellation
   */
  private handleRegionCancelled(): void {
    if (this.onCancelledCallback) {
      this.onCancelledCallback();
    }
    this.closeOverlayWindow();
  }

  /**
   * Close overlay window
   */
  private async closeOverlayWindow(): Promise<void> {
    if (this.regionWindowId) {
      try {
        await chrome.windows.remove(this.regionWindowId);
      } catch (error) {
        console.warn('Failed to close overlay window:', error);
      }
    }
    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.regionWindow = null;
    this.regionWindowId = null;
    this.screenshotData = null;
    this.onRegionSelectedCallback = null;
    this.onCancelledCallback = null;
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
   * Check if overlay is currently active
   */
  isActive(): boolean {
    return this.regionWindowId !== null;
  }

  /**
   * Force close overlay
   */
  async forceClose(): Promise<void> {
    await this.closeOverlayWindow();
  }
}

// Export singleton instance
export const fullscreenWindowService = FullscreenWindowService.getInstance();