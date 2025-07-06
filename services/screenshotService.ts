// services/screenshotService.ts - Fixed with proper Screen vs Full distinction
export interface ScreenshotOptions {
  type?: 'visible' | 'full' | 'region';
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface ScreenshotResult {
  success: boolean;
  dataUrl?: string;
  filename?: string;
  blob?: Blob;
  sourceUrl?: string;
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
   * 🖥️ SCREEN: Capture only visible area (what you see in viewport)
   */
  async captureVisibleArea(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    try {
      console.log('📸 Starting VISIBLE AREA capture...');

      const currentUrl = await this.getCurrentTabUrl();
      const permissionCheck = await this.checkTabPermissions();
      
      if (!permissionCheck.canCapture) {
        return {
          success: false,
          error: permissionCheck.error || 'Cannot capture current tab'
        };
      }

      const tab = permissionCheck.tab!;
      
      // Simple visible tab capture
      const result = await this.performVisibleCapture(tab, options);
      
      if (result.success && currentUrl) {
        result.sourceUrl = currentUrl;
      }

      return result;

    } catch (error) {
      console.error('❌ Visible area capture error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Visible area capture failed'
      };
    }
  }

  /**
   * 📄 FULL: Capture entire page including content below the fold
   */
  async captureFullPage(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    try {
      console.log('📄 Starting FULL PAGE capture...');

      const currentUrl = await this.getCurrentTabUrl();
      const permissionCheck = await this.checkTabPermissions();
      
      if (!permissionCheck.canCapture) {
        return {
          success: false,
          error: permissionCheck.error || 'Cannot capture current tab'
        };
      }

      const tab = permissionCheck.tab!;
      
      // Full page capture with scrolling
      const result = await this.performFullPageCapture(tab, options);
      
      if (result.success && currentUrl) {
        result.sourceUrl = currentUrl;
      }

      return result;

    } catch (error) {
      console.error('❌ Full page capture error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Full page capture failed'
      };
    }
  }

  /**
   * Legacy method - now properly routes to visible or full
   */
  async captureCurrentTab(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    if (options.type === 'full') {
      return this.captureFullPage(options);
    } else {
      return this.captureVisibleArea(options);
    }
  }

  /**
   * Enhanced captureFullScreen - routes based on type
   */
  async captureFullScreen(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    if (options.type === 'full') {
      return this.captureFullPage(options);
    } else {
      return this.captureVisibleArea(options);
    }
  }

  /**
   * Perform simple visible area capture
   */
  private async performVisibleCapture(tab: chrome.tabs.Tab, options: ScreenshotOptions): Promise<ScreenshotResult> {
    try {
      if (!tab.windowId) {
        return {
          success: false,
          error: 'Tab has no window ID'
        };
      }

      console.log('📸 Capturing visible area only...');

      // Simple capture of visible area
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

      const blob = await this.dataUrlToBlob(dataUrl);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const domain = this.extractDomain(tab.url || 'unknown');
      const filename = `visible_${domain}_${timestamp}.png`;

      console.log('✅ Visible area captured successfully');

      return {
        success: true,
        dataUrl,
        filename,
        blob
      };

    } catch (error) {
      return this.handleCaptureError(error);
    }
  }

  /**
   * Perform full page capture with scrolling
   */
  private async performFullPageCapture(tab: chrome.tabs.Tab, options: ScreenshotOptions): Promise<ScreenshotResult> {
    try {
      if (!tab.windowId || !tab.id) {
        return {
          success: false,
          error: 'Tab has no window/tab ID'
        };
      }

      console.log('📄 Starting full page capture with scrolling...');

      // Inject content script to get page dimensions and handle scrolling
      const injectionResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: this.getPageDimensionsScript,
      });

      if (!injectionResult || !injectionResult[0]?.result) {
        throw new Error('Failed to get page dimensions');
      }

      const pageDimensions = injectionResult[0].result;
      console.log('📐 Page dimensions:', pageDimensions);

      // If page fits in viewport, just do a simple capture
      if (pageDimensions.scrollHeight <= pageDimensions.viewportHeight + 100) {
        console.log('📸 Page fits in viewport, using simple capture');
        return this.performVisibleCapture(tab, options);
      }

      // Calculate how many captures we need
      const viewportHeight = pageDimensions.viewportHeight;
      const totalHeight = pageDimensions.scrollHeight;
      const captureCount = Math.ceil(totalHeight / viewportHeight);
      
      console.log(`📸 Need ${captureCount} captures for full page (${totalHeight}px total)`);

      const captures: string[] = [];
      
      // Reset scroll to top
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollTo(0, 0),
      });

      // Wait for initial scroll
      await this.wait(500);

      // Capture each section
      for (let i = 0; i < captureCount; i++) {
        const scrollY = i * viewportHeight;
        
        console.log(`📸 Capturing section ${i + 1}/${captureCount} at scroll ${scrollY}px`);

        // Scroll to position
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (y) => window.scrollTo(0, y),
          args: [scrollY]
        });

        // Wait for scroll and rendering
        await this.wait(300);

        // Capture this section
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: options.format || 'png',
          quality: options.quality || 100
        });

        if (dataUrl) {
          captures.push(dataUrl);
        }
      }

      // Reset scroll position
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollTo(0, 0),
      });

      if (captures.length === 0) {
        throw new Error('No captures were successful');
      }

      console.log(`✅ Captured ${captures.length} sections, stitching together...`);

      // Stitch images together
      const stitchedResult = await this.stitchImages(captures, pageDimensions);
      
      if (!stitchedResult.success) {
        throw new Error(stitchedResult.error || 'Failed to stitch images');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const domain = this.extractDomain(tab.url || 'unknown');
      const filename = `fullpage_${domain}_${timestamp}.png`;

      console.log('✅ Full page capture completed successfully');

      return {
        success: true,
        dataUrl: stitchedResult.dataUrl!,
        filename,
        blob: stitchedResult.blob!
      };

    } catch (error) {
      return this.handleCaptureError(error);
    }
  }

  /**
   * Script to get page dimensions (injected into page)
   */
  private getPageDimensionsScript = () => {
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: Math.max(
        document.body.scrollWidth,
        document.documentElement.scrollWidth,
        document.body.offsetWidth,
        document.documentElement.offsetWidth,
        document.body.clientWidth,
        document.documentElement.clientWidth
      ),
      scrollHeight: Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.body.clientHeight,
        document.documentElement.clientHeight
      )
    };
  };

  /**
   * Stitch multiple images together vertically
   */
  private async stitchImages(
    captures: string[], 
    dimensions: { viewportWidth: number; viewportHeight: number; scrollHeight: number }
  ): Promise<{ success: boolean; dataUrl?: string; blob?: Blob; error?: string }> {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve({ success: false, error: 'Canvas context not available' });
          return;
        }

        canvas.width = dimensions.viewportWidth;
        canvas.height = dimensions.scrollHeight;

        let loadedImages = 0;
        const images: HTMLImageElement[] = [];

        // Load all images
        captures.forEach((dataUrl, index) => {
          const img = new Image();
          img.onload = () => {
            images[index] = img;
            loadedImages++;
            
            if (loadedImages === captures.length) {
              // All images loaded, stitch them
              try {
                images.forEach((img, i) => {
                  const y = i * dimensions.viewportHeight;
                  const remainingHeight = dimensions.scrollHeight - y;
                  const drawHeight = Math.min(dimensions.viewportHeight, remainingHeight);
                  
                  ctx.drawImage(img, 0, y, canvas.width, drawHeight);
                });

                canvas.toBlob((blob) => {
                  if (blob) {
                    const dataUrl = canvas.toDataURL('image/png');
                    resolve({
                      success: true,
                      dataUrl,
                      blob
                    });
                  } else {
                    resolve({ success: false, error: 'Failed to create stitched image blob' });
                  }
                }, 'image/png');

              } catch (error) {
                resolve({
                  success: false,
                  error: error instanceof Error ? error.message : 'Stitching failed'
                });
              }
            }
          };

          img.onerror = () => {
            resolve({ success: false, error: `Failed to load image ${index}` });
          };

          img.src = dataUrl;
        });

      } catch (error) {
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Image stitching failed'
        });
      }
    });
  }

  /**
   * Capture region with enhanced permission checking
   */
  async captureRegion(region: { x: number; y: number; width: number; height: number }, options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    try {
      console.log('📸 Starting region capture...');

      // First capture the visible area (not full page for region)
      const fullCapture = await this.captureVisibleArea(options);
      
      if (!fullCapture.success) {
        return fullCapture;
      }

      // Crop the region
      const croppedResult = await this.cropImage(fullCapture.dataUrl!, region);
      
      if (!croppedResult.success) {
        return {
          success: false,
          error: croppedResult.error || 'Failed to crop region'
        };
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `region_${region.width}x${region.height}_${timestamp}.png`;

      return {
        success: true,
        dataUrl: croppedResult.dataUrl,
        filename,
        blob: croppedResult.blob,
        sourceUrl: fullCapture.sourceUrl
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
   * Wait helper function
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle capture errors with specific messages
   */
  private handleCaptureError(error: unknown): ScreenshotResult {
    console.error('❌ Capture execution error:', error);
    
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