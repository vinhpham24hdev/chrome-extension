// services/screenshotWindowService.ts - Service for managing screenshot preview windows
import { ScreenshotData } from '../components/ScreenshotPreview';

export interface ScreenshotWindowOptions {
  width?: number;
  height?: number;
  centered?: boolean;
}

export class ScreenshotWindowService {
  private static instance: ScreenshotWindowService;
  private activeWindow: chrome.windows.Window | null = null;
  private activeWindowId: number | null = null;
  private messageListeners: Map<string, (message: any) => void> = new Map();

  private constructor() {
    this.setupMessageListener();
  }

  public static getInstance(): ScreenshotWindowService {
    if (!ScreenshotWindowService.instance) {
      ScreenshotWindowService.instance = new ScreenshotWindowService();
    }
    return ScreenshotWindowService.instance;
  }

  /**
   * Open screenshot preview in new window
   */
  async openScreenshotPreview(
    screenshot: ScreenshotData,
    options: ScreenshotWindowOptions = {}
  ): Promise<{ success: boolean; windowId?: number; error?: string }> {
    try {
      // Close existing preview window if open
      await this.closeActiveWindow();

      // Generate unique ID for this screenshot
      const screenshotId = `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store screenshot data temporarily
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({
          [`screenshot_preview_${screenshotId}`]: screenshot
        });
      }

      // Calculate window dimensions and position
      const windowOptions = await this.calculateWindowOptions(options);

      // Get the preview page URL from public folder
      const previewUrl = chrome.runtime.getURL(`screenshot-preview.html?id=${screenshotId}`);

      // Create new window
      const window = await chrome.windows.create({
        url: previewUrl,
        type: 'popup',
        width: windowOptions.width,
        height: windowOptions.height,
        left: windowOptions.left,
        top: windowOptions.top,
        focused: true
      });

      if (!window || !window.id) {
        throw new Error('Failed to create preview window');
      }

      this.activeWindow = window;
      this.activeWindowId = window.id;

      // Setup window close listener
      this.setupWindowCloseListener(window.id);

      // Send screenshot data to the new window
      setTimeout(() => {
        this.sendMessageToPreviewWindow('SCREENSHOT_DATA', screenshot);
      }, 500); // Give window time to load

      return {
        success: true,
        windowId: window.id
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open preview window'
      };
    }
  }

  /**
   * Close active preview window
   */
  async closeActiveWindow(): Promise<void> {
    if (this.activeWindowId) {
      try {
        await chrome.windows.remove(this.activeWindowId);
      } catch (error) {
        // Window might already be closed
        console.warn('Failed to close window:', error);
      }
      
      this.activeWindow = null;
      this.activeWindowId = null;
    }
  }

  /**
   * Send message to preview window
   */
  private sendMessageToPreviewWindow(type: string, data?: any): void {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type,
        data,
        target: 'screenshot-preview'
      }).catch((error) => {
        console.warn('Failed to send message to preview window:', error);
      });
    }
  }

  /**
   * Setup message listener for communication with preview window
   */
  private setupMessageListener(): void {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Handle messages from preview window
        if (message.type === 'PREVIEW_WINDOW_CLOSED') {
          this.activeWindow = null;
          this.activeWindowId = null;
          
          // Notify listeners
          this.notifyListeners('window_closed', null);
          sendResponse({ received: true });
        }

        if (message.type === 'SAVE_SCREENSHOT') {
          // Forward save request to listeners
          this.notifyListeners('save_screenshot', message.data);
          sendResponse({ received: true });
        }

        if (message.type === 'RETAKE_SCREENSHOT') {
          // Forward retake request to listeners
          this.notifyListeners('retake_screenshot', null);
          
          // Close preview window
          this.closeActiveWindow();
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
          
          // Notify listeners
          this.notifyListeners('window_closed', null);
          
          // Remove this specific listener
          chrome.windows.onRemoved.removeListener(handleWindowRemoved);
        }
      };

      chrome.windows.onRemoved.addListener(handleWindowRemoved);
    }
  }

  /**
   * Calculate optimal window options
   */
  private async calculateWindowOptions(
    options: ScreenshotWindowOptions
  ): Promise<{
    width: number;
    height: number;
    left: number;
    top: number;
  }> {
    // Default dimensions
    const defaultWidth = Math.min(1400, window.screen.availWidth * 0.9);
    const defaultHeight = Math.min(900, window.screen.availHeight * 0.9);

    const width = options.width || defaultWidth;
    const height = options.height || defaultHeight;

    let left = 0;
    let top = 0;

    if (options.centered !== false) {
      // Center the window
      left = Math.round((window.screen.availWidth - width) / 2);
      top = Math.round((window.screen.availHeight - height) / 2);
    }

    // Ensure window is within screen bounds
    left = Math.max(0, Math.min(left, window.screen.availWidth - width));
    top = Math.max(0, Math.min(top, window.screen.availHeight - height));

    return { width, height, left, top };
  }

  /**
   * Add listener for window events
   */
  addListener(event: string, callback: (data: any) => void): void {
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
  private notifyListeners(event: string, data: any): void {
    const listener = this.messageListeners.get(event);
    if (listener) {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    }
  }

  /**
   * Check if preview window is open
   */
  isPreviewWindowOpen(): boolean {
    return this.activeWindowId !== null;
  }

  /**
   * Get active window info
   */
  getActiveWindow(): chrome.windows.Window | null {
    return this.activeWindow;
  }

  /**
   * Focus preview window if open
   */
  async focusPreviewWindow(): Promise<boolean> {
    if (this.activeWindowId) {
      try {
        await chrome.windows.update(this.activeWindowId, { focused: true });
        return true;
      } catch (error) {
        console.error('Failed to focus preview window:', error);
        // Window might be closed
        this.activeWindow = null;
        this.activeWindowId = null;
        return false;
      }
    }
    return false;
  }

  /**
   * Update preview window with new screenshot data
   */
  updatePreviewWindow(screenshot: ScreenshotData): void {
    if (this.isPreviewWindowOpen()) {
      this.sendMessageToPreviewWindow('SCREENSHOT_DATA', screenshot);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.closeActiveWindow();
    this.messageListeners.clear();
  }
}

// Export singleton instance
export const screenshotWindowService = ScreenshotWindowService.getInstance();