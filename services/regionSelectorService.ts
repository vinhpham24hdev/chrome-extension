// services/regionSelectorService.ts - Service for managing region selector
export interface RegionSelectorOptions {
  caseId?: string;
  centered?: boolean;
}

export interface RegionResult {
  success: boolean;
  dataUrl?: string;
  filename?: string;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  caseId?: string;
  error?: string;
}

export class RegionSelectorService {
  private static instance: RegionSelectorService;
  private activeWindow: chrome.windows.Window | null = null;
  private activeWindowId: number | null = null;
  private activeTabId: number | null = null;
  private messageListeners: Map<string, (result: RegionResult) => void> = new Map();

  private constructor() {
    this.setupMessageListener();
  }

  public static getInstance(): RegionSelectorService {
    if (!RegionSelectorService.instance) {
      RegionSelectorService.instance = new RegionSelectorService();
    }
    return RegionSelectorService.instance;
  }

  /**
   * Open region selector in new tab/window
   */
  async openRegionSelector(
    options: RegionSelectorOptions = {}
  ): Promise<{ success: boolean; windowId?: number; tabId?: number; error?: string }> {
    try {
      // Close existing selector if open
      await this.closeActiveSelector();

      console.log('🎯 Opening region selector...');

      // Get the region selector page URL
      const selectorUrl = chrome.runtime.getURL(`region-selector.html?caseId=${encodeURIComponent(options.caseId || 'default')}`);

      // Get current window to position new window
      const currentWindow = await chrome.windows.getCurrent();
      
      // Create new window for region selector
      const window = await chrome.windows.create({
        url: selectorUrl,
        type: 'popup',
        width: currentWindow.width,
        height: currentWindow.height,
        left: currentWindow.left,
        top: currentWindow.top,
        focused: true,
        state: 'fullscreen' // Make it fullscreen for better region selection
      });

      if (!window || !window.id) {
        throw new Error('Failed to create region selector window');
      }

      this.activeWindow = window;
      this.activeWindowId = window.id;
      
      // Get the tab ID if available
      if (window.tabs && window.tabs[0]) {
        this.activeTabId = window.tabs[0].id || null;
      }

      // Setup window close listener
      this.setupWindowCloseListener(window.id);

      console.log('✅ Region selector opened:', { windowId: window.id, tabId: this.activeTabId });

      return {
        success: true,
        windowId: window.id,
        tabId: this.activeTabId || undefined
      };

    } catch (error) {
      console.error('❌ Failed to open region selector:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open region selector'
      };
    }
  }

  /**
   * Close active region selector
   */
  async closeActiveSelector(): Promise<void> {
    if (this.activeWindowId) {
      try {
        await chrome.windows.remove(this.activeWindowId);
      } catch (error) {
        console.warn('Failed to close region selector window:', error);
      }
      
      this.activeWindow = null;
      this.activeWindowId = null;
      this.activeTabId = null;
    }
  }

  /**
   * Check if region selector is currently open
   */
  isRegionSelectorOpen(): boolean {
    return this.activeWindowId !== null;
  }

  /**
   * Focus region selector window if open
   */
  async focusRegionSelector(): Promise<boolean> {
    if (this.activeWindowId) {
      try {
        await chrome.windows.update(this.activeWindowId, { focused: true });
        return true;
      } catch (error) {
        console.error('Failed to focus region selector:', error);
        // Window might be closed
        this.activeWindow = null;
        this.activeWindowId = null;
        this.activeTabId = null;
        return false;
      }
    }
    return false;
  }

  /**
   * Setup message listener for communication with region selector
   */
  private setupMessageListener(): void {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('📨 RegionSelectorService received message:', message.type);

        // Handle region selection completion
        if (message.type === 'REGION_DONE') {
          const result: RegionResult = {
            success: message.success || true,
            dataUrl: message.dataUrl,
            filename: message.filename,
            region: message.region,
            caseId: message.caseId,
            error: message.error
          };

          console.log('✅ Region selection completed:', result);

          // Notify listeners
          this.notifyListeners('region_selected', result);

          // Close selector
          this.closeActiveSelector();

          sendResponse({ received: true });
          return true;
        }

        // Handle region selector window closed
        if (message.type === 'REGION_SELECTOR_CLOSED') {
          this.activeWindow = null;
          this.activeWindowId = null;
          this.activeTabId = null;

          // Notify listeners
          this.notifyListeners('selector_closed', { success: false });

          sendResponse({ received: true });
        }

        return true; // Keep message channel open
      });
    }
  }

  /**
   * Setup listener for window close events
   */
  private setupWindowCloseListener(windowId: number): void {
    if (typeof chrome !== 'undefined' && chrome.windows) {
      const handleWindowRemoved = (removedWindowId: number) => {
        if (removedWindowId === windowId) {
          this.activeWindow = null;
          this.activeWindowId = null;
          this.activeTabId = null;

          // Notify listeners
          this.notifyListeners('selector_closed', { success: false });

          // Remove this specific listener
          chrome.windows.onRemoved.removeListener(handleWindowRemoved);
        }
      };

      chrome.windows.onRemoved.addListener(handleWindowRemoved);
    }
  }

  /**
   * Add listener for region selector events
   */
  addListener(event: string, callback: (result: RegionResult) => void): void {
    this.messageListeners.set(event, callback);
  }

  /**
   * Remove listener
   */
  removeListener(event: string): void {
    this.messageListeners.delete(event);
  }

  /**
   * Notify all listeners of an event
   */
  private notifyListeners(event: string, result: RegionResult): void {
    const listener = this.messageListeners.get(event);
    if (listener) {
      try {
        listener(result);
      } catch (error) {
        console.error('Error in region selector event listener:', error);
      }
    }
  }

  /**
   * Get active window info
   */
  getActiveWindow(): chrome.windows.Window | null {
    return this.activeWindow;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.closeActiveSelector();
    this.messageListeners.clear();
  }
}

// Export singleton instance
export const regionSelectorService = RegionSelectorService.getInstance();