// services/screenshotService.ts
export interface ScreenshotOptions {
  type: 'full' | 'visible' | 'region';
  format: 'png' | 'jpeg';
  quality?: number; // 0-100, only for jpeg
}

export interface ScreenshotResult {
  success: boolean;
  dataUrl?: string;
  blob?: Blob;
  filename?: string;
  error?: string;
}

export interface RegionSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class ScreenshotService {
  private static instance: ScreenshotService;

  private constructor() {}

  public static getInstance(): ScreenshotService {
    if (!ScreenshotService.instance) {
      ScreenshotService.instance = new ScreenshotService();
    }
    return ScreenshotService.instance;
  }

  /**
   * Check if screenshot permissions are available
   */
  async checkPermissions(): Promise<boolean> {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        // Check if we have activeTab permission
        return true;
      }
      return false;
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  }

  /**
   * Capture full screen screenshot
   */
  async captureFullScreen(options: Partial<ScreenshotOptions> = {}): Promise<ScreenshotResult> {
    const defaultOptions: ScreenshotOptions = {
      type: 'full',
      format: 'png',
      ...options
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        // Chrome Extension API
        return await this.captureWithChromeAPI(defaultOptions);
      } else {
        // Fallback for development
        return await this.captureWithWebAPI(defaultOptions);
      }
    } catch (error) {
      return {
        success: false,
        error: `Screenshot capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Capture visible area only
   */
  async captureVisibleArea(options: Partial<ScreenshotOptions> = {}): Promise<ScreenshotResult> {
    return this.captureFullScreen({ ...options, type: 'visible' });
  }

  /**
   * Capture specific region (requires user selection)
   */
  async captureRegion(region?: RegionSelection, options: Partial<ScreenshotOptions> = {}): Promise<ScreenshotResult> {
    try {
      // First capture full screen
      const fullScreenResult = await this.captureFullScreen({ ...options, type: 'full' });
      
      if (!fullScreenResult.success || !fullScreenResult.dataUrl) {
        return fullScreenResult;
      }

      // If no region specified, return full screen
      if (!region) {
        return fullScreenResult;
      }

      // Crop the image to the specified region
      const croppedResult = await this.cropImage(fullScreenResult.dataUrl, region, options.format || 'png');
      
      return {
        success: true,
        dataUrl: croppedResult.dataUrl,
        blob: croppedResult.blob,
        filename: this.generateFilename('region', options.format || 'png')
      };

    } catch (error) {
      return {
        success: false,
        error: `Region capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Chrome Extension API implementation
   */
  private async captureWithChromeAPI(options: ScreenshotOptions): Promise<ScreenshotResult> {
    return new Promise((resolve) => {
      // Define capture options with correct typing
      const captureOptions: {
        format?: 'jpeg' | 'png';
        quality?: number;
      } = {
        format: options.format
      };

      // Only add quality for JPEG format
      if (options.format === 'jpeg' && options.quality) {
        captureOptions.quality = options.quality;
      }

      chrome.tabs.captureVisibleTab(captureOptions, (dataUrl) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        if (!dataUrl) {
          resolve({
            success: false,
            error: 'No image data captured'
          });
          return;
        }

        // Convert dataUrl to blob
        this.dataUrlToBlob(dataUrl).then(blob => {
          resolve({
            success: true,
            dataUrl,
            blob,
            filename: this.generateFilename(options.type, options.format)
          });
        }).catch(error => {
          resolve({
            success: false,
            error: `Blob conversion failed: ${error.message}`
          });
        });
      });
    });
  }

  /**
   * Web API fallback for development
   */
  private async captureWithWebAPI(options: ScreenshotOptions): Promise<ScreenshotResult> {
    try {
      // This is a mock implementation for development
      // In real browser environment, this would use Screen Capture API
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Create a mock screenshot
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#333';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Mock Screenshot', canvas.width / 2, canvas.height / 2);
      
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.fillText(`Format: ${options.format}`, canvas.width / 2, canvas.height / 2 + 40);
      ctx.fillText(`Type: ${options.type}`, canvas.width / 2, canvas.height / 2 + 65);
      ctx.fillText(new Date().toLocaleString(), canvas.width / 2, canvas.height / 2 + 90);

      const mimeType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const dataUrl = canvas.toDataURL(mimeType, options.quality ? options.quality / 100 : undefined);
      const blob = await this.dataUrlToBlob(dataUrl);

      return {
        success: true,
        dataUrl,
        blob,
        filename: this.generateFilename(options.type, options.format)
      };

    } catch (error) {
      return {
        success: false,
        error: `Web API capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Crop image to specified region
   */
  private async cropImage(dataUrl: string, region: RegionSelection, format: string): Promise<{ dataUrl: string; blob: Blob }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = region.width;
        canvas.height = region.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Draw the cropped region
        ctx.drawImage(
          img,
          region.x, region.y, region.width, region.height,
          0, 0, region.width, region.height
        );

        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const croppedDataUrl = canvas.toDataURL(mimeType);
        
        this.dataUrlToBlob(croppedDataUrl).then(blob => {
          resolve({ dataUrl: croppedDataUrl, blob });
        }).catch(reject);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /**
   * Convert data URL to Blob
   */
  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    return response.blob();
  }

  /**
   * Generate filename for screenshot
   */
  private generateFilename(type: string, format: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `screenshot-${type}-${timestamp}.${format}`;
  }

  /**
   * Download screenshot as file
   */
  downloadScreenshot(dataUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Save screenshot to Chrome storage
   */
  async saveToStorage(screenshot: ScreenshotResult, caseId: string): Promise<boolean> {
    try {
      if (!screenshot.success || !screenshot.dataUrl) {
        return false;
      }

      const storageKey = `screenshot_${caseId}_${Date.now()}`;
      const screenshotData = {
        dataUrl: screenshot.dataUrl,
        filename: screenshot.filename,
        caseId,
        timestamp: new Date().toISOString(),
        type: 'screenshot'
      };

      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ [storageKey]: screenshotData });
      } else {
        // Fallback to localStorage (with size limitations)
        localStorage.setItem(storageKey, JSON.stringify(screenshotData));
      }

      return true;
    } catch (error) {
      console.error('Failed to save screenshot:', error);
      return false;
    }
  }

  /**
   * Get saved screenshots for a case
   */
  async getSavedScreenshots(caseId: string): Promise<any[]> {
    try {
      const screenshots: any[] = [];

      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(null);
        Object.entries(result).forEach(([key, value]) => {
          if (key.startsWith(`screenshot_${caseId}_`) && typeof value === 'object') {
            screenshots.push({ id: key, ...value });
          }
        });
      } else {
        // Fallback to localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`screenshot_${caseId}_`)) {
            const value = localStorage.getItem(key);
            if (value) {
              try {
                screenshots.push({ id: key, ...JSON.parse(value) });
              } catch (error) {
                console.error('Failed to parse screenshot data:', error);
              }
            }
          }
        }
      }

      return screenshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Failed to get saved screenshots:', error);
      return [];
    }
  }
}

// Export singleton instance
export const screenshotService = ScreenshotService.getInstance();