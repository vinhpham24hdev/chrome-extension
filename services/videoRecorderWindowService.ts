// services/videoRecorderWindowService.ts - Service for managing video recorder windows
import { VideoOptions, VideoResult } from './videoService';

export interface RecorderWindowOptions {
  width?: number;
  height?: number;
  centered?: boolean;
}

export interface RecorderData {
  caseId: string;
  options?: Partial<VideoOptions>;
  autoStart?: boolean; // Auto-start recording immediately
}

export class VideoRecorderWindowService {
  private static instance: VideoRecorderWindowService;
  private activeRecorderWindow: chrome.windows.Window | null = null;
  private activeRecorderWindowId: number | null = null;
  private activeRecorderTabId: number | null = null;
  private messageListeners: Map<string, (message: any) => void> = new Map();

  private constructor() {
    this.setupMessageListener();
  }

  public static getInstance(): VideoRecorderWindowService {
    if (!VideoRecorderWindowService.instance) {
      VideoRecorderWindowService.instance = new VideoRecorderWindowService();
    }
    return VideoRecorderWindowService.instance;
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
   * Open video recorder in new tab
   */
  async openVideoRecorder(
    recorderData: RecorderData,
    options: RecorderWindowOptions = {}
  ): Promise<{ success: boolean; windowId?: number; tabId?: number; error?: string }> {
    try {
      if (!this.isExtensionContext()) {
        return {
          success: false,
          error: 'Extension context not available'
        };
      }

      // Close existing recorder window if open
      await this.closeActiveRecorderWindow();

      // Generate unique ID for this recording session
      const recordingId = `recorder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store recorder data temporarily
      try {
        await chrome.storage.local.set({
          [`video_recording_${recordingId}`]: recorderData
        });
      } catch (storageError) {
        console.error('Failed to store recorder data:', storageError);
        return {
          success: false,
          error: 'Failed to store recorder data'
        };
      }

      // Get the recorder page URL
      const recorderUrl = chrome.runtime.getURL(`video-recorder.html?id=${recordingId}`);

      // For Loom-like experience, open in new tab in current window
      const tab = await chrome.tabs.create({
        url: recorderUrl,
        active: true
      });

      if (!tab || !tab.id) {
        throw new Error('Failed to create recorder tab');
      }

      // Get the window containing the new tab
      const window = await chrome.windows.get(tab.windowId);

      this.activeRecorderWindow = window;
      this.activeRecorderWindowId = window.id ?? null;
      this.activeRecorderTabId = tab.id;

      // Setup tab close listener
      this.setupTabCloseListener(tab.id);

      // Send recorder data to the new tab after a short delay
      setTimeout(() => {
        this.sendMessageToRecorderTab('RECORDING_DATA', recorderData);
      }, 500);

      console.log('✅ Video recorder tab opened successfully:', tab.id);

      return {
        success: true,
        windowId: window.id,
        tabId: tab.id
      };

    } catch (error) {
      console.error('❌ Failed to open video recorder tab:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open recorder tab'
      };
    }
  }

  /**
   * Open video recorder in popup window (alternative)
   */
  async openVideoRecorderPopup(
    recorderData: RecorderData,
    options: RecorderWindowOptions = {}
  ): Promise<{ success: boolean; windowId?: number; error?: string }> {
    try {
      if (!this.isExtensionContext()) {
        return {
          success: false,
          error: 'Extension context not available'
        };
      }

      // Close existing recorder window if open
      await this.closeActiveRecorderWindow();

      // Generate unique ID for this recording session
      const recordingId = `recorder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store recorder data temporarily
      try {
        await chrome.storage.local.set({
          [`video_recording_${recordingId}`]: recorderData
        });
      } catch (storageError) {
        console.error('Failed to store recorder data:', storageError);
        return {
          success: false,
          error: 'Failed to store recorder data'
        };
      }

      // Calculate window dimensions and position
      const windowOptions = this.calculateWindowOptions(options);

      // Get the recorder page URL
      const recorderUrl = chrome.runtime.getURL(`video-recorder.html?id=${recordingId}`);

      // Create new popup window
      const window = await chrome.windows.create({
        url: recorderUrl,
        type: 'popup',
        width: windowOptions.width,
        height: windowOptions.height,
        left: windowOptions.left,
        top: windowOptions.top,
        focused: true
      });

      if (!window || !window.id) {
        throw new Error('Failed to create recorder window');
      }

      this.activeRecorderWindow = window;
      this.activeRecorderWindowId = window.id;

      // Setup window close listener
      this.setupWindowCloseListener(window.id);

      // Send recorder data to the new window after a short delay
      setTimeout(() => {
        this.sendMessageToRecorderWindow('RECORDING_DATA', recorderData);
      }, 500);

      console.log('✅ Video recorder popup opened successfully:', window.id);

      return {
        success: true,
        windowId: window.id
      };

    } catch (error) {
      console.error('❌ Failed to open video recorder popup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open recorder popup'
      };
    }
  }

  /**
   * Close active recorder window/tab
   */
  async closeActiveRecorderWindow(): Promise<void> {
    if (this.activeRecorderTabId) {
      try {
        await chrome.tabs.remove(this.activeRecorderTabId);
        console.log('📄 Closed previous recorder tab');
      } catch (error) {
        console.warn('⚠️ Failed to close recorder tab:', error);
      }
    } else if (this.activeRecorderWindowId) {
      try {
        await chrome.windows.remove(this.activeRecorderWindowId);
        console.log('📄 Closed previous recorder window');
      } catch (error) {
        console.warn('⚠️ Failed to close recorder window:', error);
      }
    }
    
    this.activeRecorderWindow = null;
    this.activeRecorderWindowId = null;
    this.activeRecorderTabId = null;
  }

  /**
   * Send message to recorder tab
   */
  private sendMessageToRecorderTab(type: string, data?: any): void {
    if (this.isExtensionContext() && this.activeRecorderTabId) {
      chrome.tabs.sendMessage(this.activeRecorderTabId, {
        type,
        data,
        target: 'video-recorder',
        timestamp: Date.now()
      }).catch((error) => {
        console.warn('⚠️ Failed to send message to recorder tab:', error);
      });
    }
  }

  /**
   * Send message to recorder window
   */
  private sendMessageToRecorderWindow(type: string, data?: any): void {
    if (this.isExtensionContext()) {
      chrome.runtime.sendMessage({
        type,
        data,
        target: 'video-recorder',
        timestamp: Date.now()
      }).catch((error) => {
        console.warn('⚠️ Failed to send message to recorder window:', error);
      });
    }
  }

  /**
   * Setup message listener for communication with recorder
   */
  private setupMessageListener(): void {
    if (this.isExtensionContext()) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
          // Handle messages from recorder window/tab
          if (message.type === 'RECORDING_WINDOW_CLOSED') {
            this.activeRecorderWindow = null;
            this.activeRecorderWindowId = null;
            this.activeRecorderTabId = null;
            this.notifyListeners('recording_window_closed', null);
            sendResponse({ received: true });
          }

          if (message.type === 'VIDEO_RECORDED') {
            this.notifyListeners('video_recorded', message.data);
            sendResponse({ received: true });
          }

          if (message.type === 'RECORDING_CANCELLED') {
            this.notifyListeners('recording_cancelled', null);
            this.closeActiveRecorderWindow();
            sendResponse({ received: true });
          }

          if (message.type === 'CLOSE_RECORDER') {
            this.closeActiveRecorderWindow();
            sendResponse({ received: true });
          }

          return true; // Keep message channel open for async response
        } catch (error) {
          console.error('❌ Error handling recorder message:', error);
          sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
      });
    }
  }

  /**
   * Setup listener for tab close events
   */
  private setupTabCloseListener(tabId: number): void {
    if (this.isExtensionContext() && chrome.tabs) {
      const handleTabRemoved = (removedTabId: number) => {
        if (removedTabId === tabId) {
          this.activeRecorderWindow = null;
          this.activeRecorderWindowId = null;
          this.activeRecorderTabId = null;
          this.notifyListeners('recording_window_closed', null);
          chrome.tabs.onRemoved.removeListener(handleTabRemoved);
          console.log('📄 Recorder tab closed by user');
        }
      };

      chrome.tabs.onRemoved.addListener(handleTabRemoved);
    }
  }

  /**
   * Setup listener for window close events
   */
  private setupWindowCloseListener(windowId: number): void {
    if (this.isExtensionContext() && chrome.windows) {
      const handleWindowRemoved = (removedWindowId: number) => {
        if (removedWindowId === windowId) {
          this.activeRecorderWindow = null;
          this.activeRecorderWindowId = null;
          this.activeRecorderTabId = null;
          this.notifyListeners('recording_window_closed', null);
          chrome.windows.onRemoved.removeListener(handleWindowRemoved);
          console.log('📄 Recorder window closed by user');
        }
      };

      chrome.windows.onRemoved.addListener(handleWindowRemoved);
    }
  }

  /**
   * Calculate optimal window options for popup mode
   */
  private calculateWindowOptions(
    options: RecorderWindowOptions
  ): {
    width: number;
    height: number;
    left: number;
    top: number;
  } {
    // Recorder optimized dimensions
    const screenWidth = window.screen.availWidth;
    const screenHeight = window.screen.availHeight;
    
    // Use compact dimensions for recorder
    const defaultWidth = Math.min(800, Math.round(screenWidth * 0.5));
    const defaultHeight = Math.min(600, Math.round(screenHeight * 0.6));

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
   * Add listener for recorder events
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
        console.error('❌ Error in recorder event listener:', error);
      }
    }
  }

  /**
   * Check if recorder window/tab is open
   */
  isRecorderOpen(): boolean {
    return this.activeRecorderWindowId !== null || this.activeRecorderTabId !== null;
  }

  /**
   * Get active recorder window info
   */
  getActiveRecorderWindow(): chrome.windows.Window | null {
    return this.activeRecorderWindow;
  }

  /**
   * Focus recorder window/tab if open
   */
  async focusRecorderWindow(): Promise<boolean> {
    if (this.activeRecorderTabId && this.isExtensionContext()) {
      try {
        await chrome.tabs.update(this.activeRecorderTabId, { active: true });
        if (this.activeRecorderWindowId) {
          await chrome.windows.update(this.activeRecorderWindowId, { focused: true });
        }
        return true;
      } catch (error) {
        console.error('❌ Failed to focus recorder tab:', error);
        this.activeRecorderWindow = null;
        this.activeRecorderWindowId = null;
        this.activeRecorderTabId = null;
        return false;
      }
    } else if (this.activeRecorderWindowId && this.isExtensionContext()) {
      try {
        await chrome.windows.update(this.activeRecorderWindowId, { focused: true });
        return true;
      } catch (error) {
        console.error('❌ Failed to focus recorder window:', error);
        this.activeRecorderWindow = null;
        this.activeRecorderWindowId = null;
        return false;
      }
    }
    return false;
  }

  /**
   * Switch between tab and popup mode
   */
  getDefaultMode(): 'tab' | 'popup' {
    // Default to tab mode for Loom-like experience
    return 'tab';
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.closeActiveRecorderWindow();
    this.messageListeners.clear();
  }
}

// Export singleton instance
export const videoRecorderWindowService = VideoRecorderWindowService.getInstance();