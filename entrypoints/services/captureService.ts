// services/captureService.ts
export interface CaptureOptions {
  type: 'screen' | 'tab' | 'region';
  format: 'png' | 'jpeg';
  quality?: number; // 0-100 for jpeg
}

export interface CaptureResult {
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

export class CaptureService {
  private static instance: CaptureService;

  private constructor() {}

  public static getInstance(): CaptureService {
    if (!CaptureService.instance) {
      CaptureService.instance = new CaptureService();
    }
    return CaptureService.instance;
  }

  /**
   * Check if capture APIs are available
   */
  checkPermissions(): boolean {
    return !!(
      typeof chrome !== 'undefined' &&
      chrome.tabs &&
      chrome.desktopCapture
    );
  }

  /**
   * Capture current tab screenshot
   */
  async captureTab(options: CaptureOptions = { type: 'tab', format: 'png' }): Promise<CaptureResult> {
    try {
      if (!this.checkPermissions()) {
        return {
          success: false,
          error: 'Chrome extension capture APIs not available'
        };
      }

      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        return {
          success: false,
          error: 'No active tab found'
        };
      }

      // Capture tab screenshot
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: options.format,
        quality: options.quality || 90
      });

      const blob = await this.dataUrlToBlob(dataUrl);
      const filename = this.generateFilename('tab', options.format);

      return {
        success: true,
        dataUrl,
        blob,
        filename
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Screenshot capture failed'
      };
    }
  }

  /**
   * Capture full screen (requires desktop capture permission)
   */
  async captureScreen(options: CaptureOptions = { type: 'screen', format: 'png' }): Promise<CaptureResult> {
    try {
      if (!this.checkPermissions()) {
        return {
          success: false,
          error: 'Chrome extension capture APIs not available'
        };
      }

      // Request desktop capture
      const streamId = await new Promise<string>((resolve, reject) => {
        chrome.desktopCapture.chooseDesktopMedia(
          ['screen', 'window'],
          (streamId) => {
            if (streamId) {
              resolve(streamId);
            } else {
              reject(new Error('User cancelled screen capture'));
            }
          }
        );
      });

      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: streamId
          }
        } as any
      });

      // Capture frame from video stream
      const dataUrl = await this.captureFromStream(stream);
      stream.getTracks().forEach(track => track.stop());

      const blob = await this.dataUrlToBlob(dataUrl);
      const filename = this.generateFilename('screen', options.format);

      return {
        success: true,
        dataUrl,
        blob,
        filename
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Screen capture failed'
      };
    }
  }

  /**
   * Capture selected region (requires tab capture + cropping)
   */
  async captureRegion(region: RegionSelection, options: CaptureOptions = { type: 'region', format: 'png' }): Promise<CaptureResult> {
    try {
      // First capture the full tab
      const tabCapture = await this.captureTab(options);
      
      if (!tabCapture.success || !tabCapture.dataUrl) {
        return tabCapture;
      }

      // Crop the image to the selected region
      const croppedDataUrl = await this.cropImage(tabCapture.dataUrl, region);
      const blob = await this.dataUrlToBlob(croppedDataUrl);
      const filename = this.generateFilename('region', options.format);

      return {
        success: true,
        dataUrl: croppedDataUrl,
        blob,
        filename
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Region capture failed'
      };
    }
  }

  /**
   * Capture frame from video stream
   */
  private captureFromStream(stream: MediaStream): Promise<string> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0);
        
        // Get data URL
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      };

      video.onerror = () => reject(new Error('Video stream error'));
      video.srcObject = stream;
      video.play();
    });
  }

  /**
   * Crop image to specified region
   */
  private cropImage(dataUrl: string, region: RegionSelection): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      img.onload = () => {
        canvas.width = region.width;
        canvas.height = region.height;

        // Draw cropped portion
        ctx.drawImage(
          img,
          region.x, region.y, region.width, region.height,
          0, 0, region.width, region.height
        );

        const croppedDataUrl = canvas.toDataURL('image/png');
        resolve(croppedDataUrl);
      };

      img.onerror = () => reject(new Error('Image load error'));
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
   * Generate filename for captured image
   */
  private generateFilename(type: string, format: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${type}-capture-${timestamp}.${format}`;
  }

  /**
   * Download captured image
   */
  downloadImage(dataUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Copy image to clipboard (modern browsers)
   */
  async copyToClipboard(blob: Blob): Promise<boolean> {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const captureService = CaptureService.getInstance();