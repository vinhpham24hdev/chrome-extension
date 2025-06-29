// services/videoWindowService.ts - Service for managing video preview windows
import { VideoData } from '../components/VideoPreview';

export interface VideoWindowOptions {
  width?: number;
  height?: number;
  centered?: boolean;
}

export interface RecordingWindowData {
  caseId: string;
  options?: any;
}

export class VideoWindowService {
  private static instance: VideoWindowService;
  private activeRecordingWindow: chrome.windows.Window | null = null;
  private activeRecordingWindowId: number | null = null;
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
   * Open video recorder in new window
   */
  async openVideoRecorder(
    data: RecordingWindowData,
    options: VideoWindowOptions = {}
  ): Promise<{ success: boolean; windowId?: number; error?: string }> {
    try {
      // Close existing recording window if open
      await this.closeActiveRecordingWindow();

      // Generate unique ID for this recording session
      const recordingId = `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store recording data temporarily
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({
          [`video_recording_${recordingId}`]: data
        });
      }

      // Calculate window dimensions and position
      const windowOptions = await this.calculateWindowOptions(options);

      // Get the recording page URL
      const recordingUrl = chrome.runtime.getURL(`video-recorder.html?id=${recordingId}`);

      // Create new window
      const window = await chrome.windows.create({
        url: recordingUrl,
        type: 'popup',
        width: windowOptions.width,
        height: windowOptions.height,
        left: windowOptions.left,
        top: windowOptions.top,
        focused: true
      });

      if (!window || !window.id) {
        throw new Error('Failed to create recording window');
      }

      this.activeRecordingWindow = window;
      this.activeRecordingWindowId = window.id;

      // Setup window close listener
      this.setupWindowCloseListener(window.id, 'recording');

      // Send recording data to the new window
      setTimeout(() => {
        this.sendMessageToRecordingWindow('RECORDING_DATA', data);
      }, 500);

      return {
        success: true,
        windowId: window.id
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open recording window'
      };
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
      // Close existing preview window if open
      await this.closeActivePreviewWindow();

      // Generate unique ID for this video
      const videoId = `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store video data temporarily
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({
          [`video_preview_${videoId}`]: video
        });
      }

      // Calculate window dimensions and position
      const windowOptions = await this.calculateWindowOptions(options);

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
      this.setupWindowCloseListener(window.id, 'preview');

      // Send video data to the new window
      setTimeout(() => {
        this.sendMessageToPreviewWindow('VIDEO_DATA', video);
      }, 500);

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
   * Close active recording window
   */
  async closeActiveRecordingWindow(): Promise<void> {
    if (this.activeRecordingWindowId) {
      try {
        await chrome.windows.remove(this.activeRecordingWindowId);
      } catch (error) {
        console.warn('Failed to close recording window:', error);
      }
      
      this.activeRecordingWindow = null;
      this.activeRecordingWindowId = null;
    }
  }

  /**
   * Close active preview window
   */
  async closeActivePreviewWindow(): Promise<void> {
    if (this.activePreviewWindowId) {
      try {
        await chrome.windows.remove(this.activePreviewWindowId);
      } catch (error) {
        console.warn('Failed to close preview window:', error);
      }
      
      this.activePreviewWindow = null;
      this.activePreviewWindowId = null;
    }
  }

  /**
   * Send message to recording window
   */
  private sendMessageToRecordingWindow(type: string, data?: any): void {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type,
        data,
        target: 'video-recorder'
      }).catch((error) => {
        console.warn('Failed to send message to recording window:', error);
      });
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
        target: 'video-preview'
      }).catch((error) => {
        console.warn('Failed to send message to preview window:', error);
      });
    }
  }

  /**
   * Setup message listener for communication with windows
   */
  private setupMessageListener(): void {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Handle messages from recording window
        if (message.type === 'RECORDING_WINDOW_CLOSED') {
          this.activeRecordingWindow = null;
          this.activeRecordingWindowId = null;
          this.notifyListeners('recording_window_closed', null);
          sendResponse({ received: true });
        }

        if (message.type === 'VIDEO_RECORDED') {
          // Forward video recorded event to listeners
          this.notifyListeners('video_recorded', message.data);
          sendResponse({ received: true });
        }

        if (message.type === 'CLOSE_RECORDING') {
          this.closeActiveRecordingWindow();
          sendResponse({ received: true });
        }

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

        return true;
      });
    }
  }

  /**
   * Setup listener for window close events
   */
  private setupWindowCloseListener(windowId: number, type: 'recording' | 'preview'): void {
    if (typeof chrome !== 'undefined' && chrome.windows) {
      const handleWindowRemoved = (removedWindowId: number) => {
        if (removedWindowId === windowId) {
          if (type === 'recording') {
            this.activeRecordingWindow = null;
            this.activeRecordingWindowId = null;
            this.notifyListeners('recording_window_closed', null);
          } else {
            this.activePreviewWindow = null;
            this.activePreviewWindowId = null;
            this.notifyListeners('preview_window_closed', null);
          }
          
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
    options: VideoWindowOptions
  ): Promise<{
    width: number;
    height: number;
    left: number;
    top: number;
  }> {
    // Default dimensions - larger for video
    const defaultWidth = Math.min(1600, window.screen.availWidth * 0.95);
    const defaultHeight = Math.min(1000, window.screen.availHeight * 0.95);

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
   * Check if recording window is open
   */
  isRecordingWindowOpen(): boolean {
    return this.activeRecordingWindowId !== null;
  }

  /**
   * Check if preview window is open
   */
  isPreviewWindowOpen(): boolean {
    return this.activePreviewWindowId !== null;
  }

  /**
   * Get active recording window info
   */
  getActiveRecordingWindow(): chrome.windows.Window | null {
    return this.activeRecordingWindow;
  }

  /**
   * Get active preview window info
   */
  getActivePreviewWindow(): chrome.windows.Window | null {
    return this.activePreviewWindow;
  }

  /**
   * Focus recording window if open
   */
  async focusRecordingWindow(): Promise<boolean> {
    if (this.activeRecordingWindowId) {
      try {
        await chrome.windows.update(this.activeRecordingWindowId, { focused: true });
        return true;
      } catch (error) {
        console.error('Failed to focus recording window:', error);
        this.activeRecordingWindow = null;
        this.activeRecordingWindowId = null;
        return false;
      }
    }
    return false;
  }

  /**
   * Focus preview window if open
   */
  async focusPreviewWindow(): Promise<boolean> {
    if (this.activePreviewWindowId) {
      try {
        await chrome.windows.update(this.activePreviewWindowId, { focused: true });
        return true;
      } catch (error) {
        console.error('Failed to focus preview window:', error);
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
    this.closeActiveRecordingWindow();
    this.closeActivePreviewWindow();
    this.messageListeners.clear();
  }
}

// Export singleton instance
export const videoWindowService = VideoWindowService.getInstance();