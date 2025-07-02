// services/fullscreenWindowService.ts - Fixed with better error handling
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
  private timeoutId: NodeJS.Timeout | null = null;

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
      console.log('🎯 Starting region selection...');

      // Set timeout to prevent infinite loading
      this.timeoutId = setTimeout(() => {
        console.error('⏰ Region selection timeout');
        this.handleRegionCancelled();
      }, 10000); // 10 seconds timeout

      // Step 1: Capture current tab screenshot
      const screenshot = await this.captureCurrentTab();
      
      if (!screenshot.success) {
        this.clearTimeout();
        return {
          success: false,
          error: screenshot.error || 'Failed to capture screenshot'
        };
      }

      this.screenshotData = screenshot.dataUrl!;

      // Step 2: Open fullscreen overlay window
      const windowResult = await this.openFullscreenOverlay();
      
      if (!windowResult.success) {
        this.clearTimeout();
        return {
          success: false,
          error: windowResult.error || 'Failed to open overlay window'
        };
      }

      return { success: true };

    } catch (error) {
      this.clearTimeout();
      console.error('❌ Region selection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Region selection failed'
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
      console.log('📸 Attempting to capture current tab...');

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

      console.log('📋 Current tab:', { id: tab.id, url: tab.url, windowId: tab.windowId });

      // Check for restricted URLs
      if (tab.url && (
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('moz-extension://') ||
        tab.url.startsWith('about:')
      )) {
        return {
          success: false,
          error: 'Cannot capture restricted pages (chrome://, extension pages, etc.)'
        };
      }

      // Try to capture with detailed error handling
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: 'png',
          quality: 100
        });

        if (!dataUrl) {
          return {
            success: false,
            error: 'Failed to capture tab - no data returned'
          };
        }

        console.log('✅ Tab captured successfully');
        return {
          success: true,
          dataUrl
        };

      } catch (captureError) {
        console.error('❌ Capture error details:', captureError);
        
        // Check for specific permission errors
        const errorMessage = captureError instanceof Error ? captureError.message : String(captureError);
        
        if (errorMessage.includes('activeTab')) {
          return {
            success: false,
            error: 'Permission denied. Please click the extension icon first, then try Region capture.'
          };
        }

        if (errorMessage.includes('all_urls')) {
          return {
            success: false,
            error: 'Insufficient permissions. Extension needs to be invoked by user action.'
          };
        }

        if (errorMessage.includes('Cannot access contents')) {
          return {
            success: false,
            error: 'Cannot access this page. Try on a regular webpage (not chrome:// or extension pages).'
          };
        }

        return {
          success: false,
          error: `Capture failed: ${errorMessage}`
        };
      }

    } catch (error) {
      console.error('❌ Tab capture error:', error);
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
      console.log('🪟 Opening overlay window...');

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
        // Use screen API fallback
        displayInfo = {
          left: 0,
          top: 0,
          width: globalThis.screen?.width || 1920,
          height: globalThis.screen?.height || 1080
        };
      }

      console.log('📐 Using display info:', displayInfo);

      // Create fullscreen window
      const overlayWindow = await chrome.windows.create({
        url: chrome.runtime.getURL('region-selector.html'),
        type: 'popup',
        focused: true,
        state: 'maximized'
      });

      if (!overlayWindow || !overlayWindow.id) {
        return {
          success: false,
          error: 'Failed to create overlay window'
        };
      }

      this.regionWindow = overlayWindow;
      this.regionWindowId = overlayWindow.id;

      console.log('✅ Overlay window created:', overlayWindow.id);

      // Setup window close listener
      this.setupWindowCloseListener();

      // Send screenshot data to window after it loads
      setTimeout(() => {
        this.sendDataToOverlayWindow();
      }, 500);

      return { success: true };

    } catch (error) {
      console.error('❌ Failed to create overlay window:', error);
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
    if (!this.screenshotData || !this.regionWindowId) {
      console.warn('⚠️ Cannot send data: missing screenshot or window ID');
      return;
    }

    console.log('📤 Sending screenshot data to overlay window...');

    chrome.runtime.sendMessage({
      type: 'REGION_SELECTOR_DATA',
      data: {
        screenshot: this.screenshotData,
        timestamp: Date.now()
      },
      target: 'region-selector-window'
    }).catch(error => {
      console.warn('❌ Failed to send data to overlay window:', error);
    });
  }

  /**
   * Setup message listener for communication with overlay window
   */
  private setupMessageListener(): void {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('📨 Received message:', message.type);

        if (message.type === 'REGION_SELECTED' && sender.tab === undefined) {
          this.clearTimeout();
          this.handleRegionSelected(message.data);
          sendResponse({ success: true });
        }

        if (message.type === 'REGION_CANCELLED' && sender.tab === undefined) {
          this.clearTimeout();
          this.handleRegionCancelled();
          sendResponse({ success: true });
        }

        if (message.type === 'REGION_WINDOW_READY' && sender.tab === undefined) {
          console.log('🪟 Region window ready, sending data...');
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
        console.log('🪟 Region window closed');
        this.clearTimeout();
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
    console.log('✅ Region selected:', region);
    if (this.onRegionSelectedCallback) {
      this.onRegionSelectedCallback(region);
    }
    this.closeOverlayWindow();
  }

  /**
   * Handle region selection cancellation
   */
  private handleRegionCancelled(): void {
    console.log('❌ Region selection cancelled');
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
        console.log('🪟 Overlay window closed');
      } catch (error) {
        console.warn('⚠️ Failed to close overlay window:', error);
      }
    }
    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.clearTimeout();
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