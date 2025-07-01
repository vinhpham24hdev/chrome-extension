// services/videoWindowService.ts - Simple service for managing video preview windows
import { VideoData } from '../components/VideoPreview';

export interface VideoWindowOptions {
  width?: number;
  height?: number;
  centered?: boolean;
}

export class VideoWindowService {
  private static instance: VideoWindowService;
  private activePreviewWindow: chrome.windows.Window | null = null;
  private activePreviewWindowId: number | null = null;
  private messageListeners: Map<string, (message: any) => void> = new Map();

  private constructor() {
    this.setupMessageListener();
  }

  public static getInstance(): VideoWindowService {
    if (!VideoWindowService.instance) {
      VideoWindowService.instance = new VideoWindowService();
    }
    return VideoWindowService.instance;
  }

  /**
   * Check if Chrome extension APIs are available
   */
  private isExtensionContext(): boolean {
    try {
      return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
    } catch (error) {
      console.warn('Extension context not available:', error);
      return false;
    }
  }

  /**
   * Open video preview in new window
   */
  async openVideoPreview(
    video: VideoData,
    options: VideoWindowOptions = {}
  ): Promise<{ success: boolean; windowId?: number; error?: string }> {
    try {
      if (!this.isExtensionContext()) {
        return {
          success: false,
          error: 'Extension context not available'
        };
      }

      // Close existing preview window if open
      await this.closeActivePreviewWindow();

      // Generate unique ID for this video
      const videoId = `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store video data temporarily
      try {
        await chrome.storage.local.set({
          [`video_preview_${videoId}`]: video
        });
      } catch (storageError) {
        console.error('Failed to store video data:', storageError);
        return {
          success: false,
          error: 'Failed to store video data'
        };
      }

      // Calculate window dimensions and position
      const windowOptions = this.calculateWindowOptions(options);

      // Get the preview page URL
      const previewUrl = chrome.runtime.getURL(`video-preview.html?id=${videoId}`);

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

      this.activePreviewWindow = window;
      this.activePreviewWindowId = window.id;

      // Setup window close listener
      this.setupWindowCloseListener(window.id);

      // Send video data to the new window after a short delay
      setTimeout(() => {
        this.sendMessageToPreviewWindow('VIDEO_DATA', video);
      }, 500);

      console.log('✅ Video preview window opened successfully:', window.id);

      return {
        success: true,
        windowId: window.id
      };

    } catch (error) {
      console.error('❌ Failed to open video preview window:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open preview window'
      };
    }
  }

  /**
   * Close active preview window
   */
  async closeActivePreviewWindow(): Promise<void> {
    if (this.activePreviewWindowId) {
      try {
        await chrome.windows.remove(this.activePreviewWindowId);
        console.log('📄 Closed previous preview window');
      } catch (error) {
        console.warn('⚠️ Failed to close preview window:', error);
      }
      
      this.activePreviewWindow = null;
      this.activePreviewWindowId = null;
    }
  }

  /**
   * Send message to preview window
   */
  private sendMessageToPreviewWindow(type: string, data?: any): void {
    if (this.isExtensionContext()) {
      chrome.runtime.sendMessage({
        type,
        data,
        target: 'video-preview',
        timestamp: Date.now()
      }).catch((error) => {
        console.warn('⚠️ Failed to send message to preview window:', error);
      });
    }
  }

  /**
   * Setup message listener for communication with windows
   */
  private setupMessageListener(): void {
    if (this.isExtensionContext()) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
          // Handle messages from preview window
          if (message.type === 'PREVIEW_WINDOW_CLOSED') {
            this.activePreviewWindow = null;
            this.activePreviewWindowId = null;
            this.notifyListeners('preview_window_closed', null);
            sendResponse({ received: true });
          }

          if (message.type === 'SAVE_VIDEO') {
            this.notifyListeners('save_video', message.data);
            sendResponse({ received: true });
          }

          if (message.type === 'RETAKE_VIDEO') {
            this.notifyListeners('retake_video', null);
            this.closeActivePreviewWindow();
            sendResponse({ received: true });
          }

          if (message.type === 'CLOSE_PREVIEW') {
            this.closeActivePreviewWindow();
            sendResponse({ received: true });
          }

          return true; // Keep message channel open for async response
        } catch (error) {
          console.error('❌ Error handling message:', error);
          sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
      });
    }
  }

  /**
   * Setup listener for window close events
   */
  private setupWindowCloseListener(windowId: number): void {
    if (this.isExtensionContext() && chrome.windows) {
      const handleWindowRemoved = (removedWindowId: number) => {
        if (removedWindowId === windowId) {
          this.activePreviewWindow = null;
          this.activePreviewWindowId = null;
          this.notifyListeners('preview_window_closed', null);
          chrome.windows.onRemoved.removeListener(handleWindowRemoved);
          console.log('📄 Preview window closed by user');
        }
      };

      chrome.windows.onRemoved.addListener(handleWindowRemoved);
    }
  }

  /**
   * Calculate optimal window options
   */
  private calculateWindowOptions(
    options: VideoWindowOptions
  ): {
    width: number;
    height: number;
    left: number;
    top: number;
  } {
    // Default dimensions - optimized for video preview
    const defaultWidth = Math.min(1600, window.screen.availWidth * 0.9);
    const defaultHeight = Math.min(1000, window.screen.availHeight * 0.9);

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
        console.error('❌ Error in event listener:', error);
      }
    }
  }

  /**
   * Check if preview window is open
   */
  isPreviewWindowOpen(): boolean {
    return this.activePreviewWindowId !== null;
  }

  /**
   * Get active preview window info
   */
  getActivePreviewWindow(): chrome.windows.Window | null {
    return this.activePreviewWindow;
  }

  /**
   * Focus preview window if open
   */
  async focusPreviewWindow(): Promise<boolean> {
    if (this.activePreviewWindowId && this.isExtensionContext()) {
      try {
        await chrome.windows.update(this.activePreviewWindowId, { focused: true });
        return true;
      } catch (error) {
        console.error('❌ Failed to focus preview window:', error);
        this.activePreviewWindow = null;
        this.activePreviewWindowId = null;
        return false;
      }
    }
    return false;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.closeActivePreviewWindow();
    this.messageListeners.clear();
  }
}

// Export singleton instance
export const videoWindowService = VideoWindowService.getInstance();