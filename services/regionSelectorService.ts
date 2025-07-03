// services/regionSelectorService.ts - Tab-based region selector like Loom
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
  private onRegionSelectedCallback: ((region: RegionSelection) => void) | null = null;
  private onCancelledCallback: (() => void) | null = null;
  private timeoutId: NodeJS.Timeout | null = null;

  private constructor() {
    this.setupMessageListener();
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
  async startRegionSelection(caseId: string): Promise<RegionSelectorResult> {
    try {
      console.log('🎯 Starting region selection in new tab...');

      this.currentCaseId = caseId;

      // Set timeout to prevent infinite loading
      this.timeoutId = setTimeout(() => {
        console.error('⏰ Region selection timeout');
        this.handleRegionCancelled();
      }, 15000); // 15 seconds timeout

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

      // Step 2: Open region selector in new tab
      const tabResult = await this.openRegionSelectorTab();
      
      if (!tabResult.success) {
        this.clearTimeout();
        return {
          success: false,
          error: tabResult.error || 'Failed to open region selector tab'
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
      console.log('📸 Capturing current tab for region selection...');

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

      // Capture the tab
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

        console.log('✅ Tab captured successfully for region selection');
        return {
          success: true,
          dataUrl
        };

      } catch (captureError) {
        console.error('❌ Capture error details:', captureError);
        
        const errorMessage = captureError instanceof Error ? captureError.message : String(captureError);
        
        if (errorMessage.includes('activeTab')) {
          return {
            success: false,
            error: 'Permission denied. Please click the extension icon first, then try Region capture.'
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
   * Open region selector in new tab (Loom-style)
   */
  private async openRegionSelectorTab(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log('🆕 Opening region selector in new tab...');

      // Close existing tab if any
      await this.closeSelectorTab();

      // Create new tab for region selection
      const selectorTab = await chrome.tabs.create({
        url: chrome.runtime.getURL('region-selector.html'),
        active: true // Focus the new tab immediately
      });

      if (!selectorTab || !selectorTab.id) {
        return {
          success: false,
          error: 'Failed to create region selector tab'
        };
      }

      this.selectorTab = selectorTab;
      this.selectorTabId = selectorTab.id;

      console.log('✅ Region selector tab created:', selectorTab.id);

      // Wait a bit for tab to load, then send data
      setTimeout(() => {
        this.sendDataToSelectorTab();
      }, 1000);

      return { success: true };

    } catch (error) {
      console.error('❌ Failed to create region selector tab:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create tab'
      };
    }
  }

  /**
   * Send screenshot data to selector tab
   */
  private sendDataToSelectorTab(): void {
    if (!this.screenshotData || !this.selectorTabId) {
      console.warn('⚠️ Cannot send data: missing screenshot or tab ID');
      return;
    }

    console.log('📤 Sending screenshot data to selector tab...');

    // Send message to the specific tab
    chrome.tabs.sendMessage(this.selectorTabId, {
      type: 'REGION_SELECTOR_DATA',
      data: {
        screenshot: this.screenshotData,
        caseId: this.currentCaseId,
        timestamp: Date.now()
      }
    }).catch(error => {
      console.warn('❌ Failed to send data to selector tab:', error);
      // Try via runtime message as fallback
      chrome.runtime.sendMessage({
        type: 'REGION_SELECTOR_DATA',
        data: {
          screenshot: this.screenshotData,
          caseId: this.currentCaseId,
          timestamp: Date.now()
        },
        target: 'region-selector-tab'
      }).catch(fallbackError => {
        console.warn('❌ Fallback message also failed:', fallbackError);
      });
    });
  }

  /**
   * Setup message listener for communication with selector tab
   */
  private setupMessageListener(): void {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Only handle messages from our selector tab
        if (sender.tab?.id !== this.selectorTabId) {
          return;
        }

        console.log('📨 Received message from selector tab:', message.type);

        switch (message.type) {
          case 'REGION_SELECTED':
            this.clearTimeout();
            this.handleRegionSelected(message.data);
            sendResponse({ success: true });
            break;

          case 'REGION_CANCELLED':
            this.clearTimeout();
            this.handleRegionCancelled();
            sendResponse({ success: true });
            break;

          case 'REGION_TAB_READY':
            console.log('🆕 Region selector tab ready, sending data...');
            this.sendDataToSelectorTab();
            sendResponse({ success: true });
            break;

          default:
            sendResponse({ success: false, error: 'Unknown message type' });
        }

        return true; // Keep message channel open for async response
      });
    }
  }

  /**
   * Setup tab close listener
   */
  private setupTabCloseListener(): void {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
        if (tabId === this.selectorTabId) {
          console.log('🆕 Region selector tab closed');
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
    console.log('✅ Region selected in tab:', region);
    if (this.onRegionSelectedCallback) {
      this.onRegionSelectedCallback(region);
    }
    this.closeSelectorTab();
  }

  /**
   * Handle region selection cancellation
   */
  private handleRegionCancelled(): void {
    console.log('❌ Region selection cancelled');
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
        console.log('🆕 Selector tab closed');
      } catch (error) {
        console.warn('⚠️ Failed to close selector tab:', error);
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
        console.warn('⚠️ Failed to focus selector tab:', error);
      }
    }
    return false;
  }
}

// Export singleton instance
export const regionSelectorService = RegionSelectorService.getInstance();