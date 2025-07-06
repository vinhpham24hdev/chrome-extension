// services/screenshotService.ts - Updated with URL capture
export interface ScreenshotOptions {
  type?: 'visible' | 'full';
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface ScreenshotResult {
  success: boolean;
  dataUrl?: string;
  filename?: string;
  blob?: Blob;
  sourceUrl?: string; // Add source URL
  error?: string;
}

class ScreenshotService {
  private static instance: ScreenshotService;
  private initialized = false;

  private constructor() {}

  public static getInstance(): ScreenshotService {
    if (!ScreenshotService.instance) {
      ScreenshotService.instance = new ScreenshotService();
    }
    return ScreenshotService.instance;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    console.log('✅ Screenshot service initialized');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current tab URL safely
   */
  private async getCurrentTabUrl(): Promise<string | null> {
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        return null;
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.url) {
        return null;
      }

      // Filter out restricted URLs
      const restrictedPatterns = [
        /^chrome:\/\//,
        /^chrome-extension:\/\//,
        /^moz-extension:\/\//,
        /^about:/,
        /^edge:\/\//,
        /^opera:\/\//,
        /^vivaldi:\/\//,
        /^brave:\/\//,
        /^chrome-search:\/\//,
        /^chrome-devtools:\/\//,
        /^view-source:/,
        /^file:\/\//,
        /^data:/
      ];

      const isRestricted = restrictedPatterns.some(pattern => pattern.test(tab.url!));
      
      if (isRestricted) {
        console.log('Current tab URL is restricted, not capturing URL');
        return null;
      }

      return tab.url;
    } catch (error) {
      console.warn('Could not get current tab URL:', error);
      return null;
    }
  }

  /**
   * Check if current tab can be captured
   */
  private async checkTabPermissions(): Promise<{
    canCapture: boolean;
    error?: string;
    tab?: chrome.tabs.Tab;
  }> {
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        return {
          canCapture: false,
          error: 'Chrome tabs API not available'
        };
      }

      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        return {
          canCapture: false,
          error: 'No active tab found'
        };
      }

      if (!tab.url) {
        return {
          canCapture: false,
          error: 'Cannot access tab URL'
        };
      }

      return {
        canCapture: true,
        tab
      };

    } catch (error) {
      return {
        canCapture: false,
        error: `Permission check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Capture current tab with enhanced error handling
   */
  async captureCurrentTab(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    try {
      console.log('📸 Starting tab capture with permission check...');

      // Get current tab URL first
      const currentUrl = await this.getCurrentTabUrl();
      console.log('🌐 Current tab URL:', currentUrl || 'Not available/restricted');

      // Check permissions
      const permissionCheck = await this.checkTabPermissions();
      
      if (!permissionCheck.canCapture) {
        console.error('❌ Tab capture not allowed:', permissionCheck.error);
        return {
          success: false,
          error: permissionCheck.error || 'Cannot capture current tab'
        };
      }

      const tab = permissionCheck.tab!;
      console.log('✅ Tab capture allowed:', { id: tab.id, url: tab.url?.substring(0, 50) + '...' });

      // Proceed with capture
      const result = await this.performCapture(tab, options);
      
      if (result.success && currentUrl) {
        // Add the source URL to the result
        result.sourceUrl = currentUrl;
        console.log('🔗 Added source URL to screenshot result:', currentUrl);
      }

      return result;

    } catch (error) {
      console.error('❌ Tab capture error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tab capture failed'
      };
    }
  }

  /**
   * Perform the actual capture after permission checks
   */
  private async performCapture(tab: chrome.tabs.Tab, options: ScreenshotOptions): Promise<ScreenshotResult> {
    try {
      if (!tab.windowId) {
        return {
          success: false,
          error: 'Tab has no window ID'
        };
      }

      // Capture the visible tab
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: options.format || 'png',
        quality: options.quality || 100
      });

      if (!dataUrl) {
        return {
          success: false,
          error: 'No image data returned from capture'
        };
      }

      // Convert to blob
      const blob = await this.dataUrlToBlob(dataUrl);
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const domain = this.extractDomain(tab.url || 'unknown');
      const filename = `screenshot_${domain}_${timestamp}.png`;

      return {
        success: true,
        dataUrl,
        filename,
        blob
      };

    } catch (error) {
      console.error('❌ Capture execution error:', error);
      
      // Provide specific error messages
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('activeTab')) {
        return {
          success: false,
          error: 'Permission denied. Please click the extension icon first to grant access, then try again.'
        };
      }

      if (errorMessage.includes('Cannot access contents')) {
        return {
          success: false,
          error: 'Cannot access this page. Please try on a regular website instead.'
        };
      }

      return {
        success: false,
        error: `Capture failed: ${errorMessage}`
      };
    }
  }

  /**
   * Enhanced captureFullScreen with better error messages
   */
  async captureFullScreen(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    return this.captureCurrentTab(options);
  }

  /**
   * Capture region with enhanced permission checking
   */
  async captureRegion(region: { x: number; y: number; width: number; height: number }, options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    try {
      console.log('📸 Starting region capture...');

      // First capture the full tab
      const fullCapture = await this.captureCurrentTab(options);
      
      if (!fullCapture.success) {
        return fullCapture; // Return the same error
      }

      // Crop the region
      const croppedResult = await this.cropImage(fullCapture.dataUrl!, region);
      
      if (!croppedResult.success) {
        return {
          success: false,
          error: croppedResult.error || 'Failed to crop region'
        };
      }

      // Generate new filename for region
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `region_${region.width}x${region.height}_${timestamp}.png`;

      return {
        success: true,
        dataUrl: croppedResult.dataUrl,
        filename,
        blob: croppedResult.blob,
        sourceUrl: fullCapture.sourceUrl // Pass through the source URL
      };

    } catch (error) {
      console.error('❌ Region capture error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Region capture failed'
      };
    }
  }

  /**
   * Helper: Convert data URL to blob
   */
  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    return response.blob();
  }

  /**
   * Helper: Extract domain from URL for filename
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/\./g, '_');
    } catch {
      return 'unknown';
    }
  }

  /**
   * Helper: Crop image to specified region
   */
  private async cropImage(dataUrl: string, region: { x: number; y: number; width: number; height: number }): Promise<{
    success: boolean;
    dataUrl?: string;
    blob?: Blob;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            resolve({ success: false, error: 'Canvas context not available' });
            return;
          }

          canvas.width = region.width;
          canvas.height = region.height;

          ctx.drawImage(
            img,
            region.x, region.y, region.width, region.height,
            0, 0, region.width, region.height
          );

          canvas.toBlob((blob) => {
            if (blob) {
              const croppedDataUrl = canvas.toDataURL('image/png');
              resolve({
                success: true,
                dataUrl: croppedDataUrl,
                blob
              });
            } else {
              resolve({ success: false, error: 'Failed to create cropped image blob' });
            }
          }, 'image/png');

        } catch (error) {
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Image cropping failed'
          });
        }
      };

      img.onerror = () => {
        resolve({ success: false, error: 'Failed to load image for cropping' });
      };

      img.src = dataUrl;
    });
  }

  /**
   * Save screenshot to storage/upload
   */
  async saveToStorage(result: ScreenshotResult, caseId: string): Promise<boolean> {
    try {
      console.log('💾 Saving screenshot to storage...');
      
      if (!result.success || !result.blob) {
        console.error('❌ Invalid screenshot result');
        return false;
      }

      // TODO: Implement actual save logic based on your storage service
      // For now, just log success
      console.log('✅ Screenshot saved successfully');
      return true;

    } catch (error) {
      console.error('❌ Save error:', error);
      return false;
    }
  }

  /**
   * Download screenshot to local disk
   */
  downloadScreenshot(dataUrl: string, filename: string): void {
    try {
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('✅ Screenshot downloaded:', filename);
    } catch (error) {
      console.error('❌ Download error:', error);
    }
  }
}

export const screenshotService = ScreenshotService.getInstance();