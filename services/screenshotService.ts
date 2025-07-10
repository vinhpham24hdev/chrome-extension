// services/screenshotService.ts - Original Code + Real S3 Integration

// Declare global interface for temporary scroll position storage
declare global {
  interface Window {
    __originalScrollY?: number;
    __originalScrollX?: number;
  }
}

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
   * 📄 FULL: Capture entire page including content below the fold - ENHANCED VERSION
   */
  async captureFullPage(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    try {
      console.log('📄 Starting ENHANCED FULL PAGE capture...');

      const currentUrl = await this.getCurrentTabUrl();
      const permissionCheck = await this.checkTabPermissions();
      
      if (!permissionCheck.canCapture) {
        return {
          success: false,
          error: permissionCheck.error || 'Cannot capture current tab'
        };
      }

      const tab = permissionCheck.tab!;
      
      // Enhanced full page capture with better scrolling logic
      const result = await this.performEnhancedFullPageCapture(tab, options);
      
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
   * ENHANCED: Perform full page capture with improved scrolling and stitching
   */
  private async performEnhancedFullPageCapture(tab: chrome.tabs.Tab, options: ScreenshotOptions): Promise<ScreenshotResult> {
    try {
      if (!tab.windowId || !tab.id) {
        return {
          success: false,
          error: 'Tab has no window/tab ID'
        };
      }

      console.log('📄 Starting ENHANCED full page capture...');

      // Step 1: Get page dimensions and scroll info
      const pageInfo = await this.getEnhancedPageInfo(tab.id);
      
      if (!pageInfo.success) {
        throw new Error(pageInfo.error || 'Failed to get page dimensions');
      }

      const dimensions = pageInfo.data!;
      console.log('📐 Enhanced page dimensions:', dimensions);

      // Step 2: Check if scrolling is needed
      const needsScrolling = dimensions.documentHeight > dimensions.viewportHeight + 50; // 50px tolerance
      
      if (!needsScrolling) {
        console.log('📸 Page fits in viewport, using simple capture');
        return this.performVisibleCapture(tab, options);
      }

      // Step 3: Prepare for scrolling capture
      console.log(`📸 Page requires scrolling - Document: ${dimensions.documentHeight}px, Viewport: ${dimensions.viewportHeight}px`);
      
      // Save original scroll position
      await this.executeScript(tab.id, () => {
        (window as any).__originalScrollY = window.scrollY;
        (window as any).__originalScrollX = window.scrollX;
      });

      // Step 4: Reset to top and wait for stability
      await this.executeScript(tab.id, () => {
        window.scrollTo(0, 0);
      });
      await this.wait(800); // Longer wait for complex pages

      // Step 5: Calculate optimal scroll steps
      const scrollSteps = this.calculateOptimalScrollSteps(dimensions);
      console.log(`📸 Using ${scrollSteps.length} scroll positions for capture`);

      const captures: string[] = [];
      
      // Step 6: Capture each section with enhanced logic
      for (let i = 0; i < scrollSteps.length; i++) {
        const scrollPosition = scrollSteps[i];
        
        console.log(`📸 Capturing section ${i + 1}/${scrollSteps.length} at scroll ${scrollPosition}px`);

        // Scroll to position
        await this.executeScript(tab.id, (scrollY: number) => {
          window.scrollTo(0, scrollY);
          
          // Force layout recalculation for better rendering
          document.body.offsetHeight;
          
          // Trigger any lazy-loading images
          const images = document.querySelectorAll('img[data-src], img[loading="lazy"]');
          images.forEach(img => {
            if (img instanceof HTMLImageElement) {
              const rect = img.getBoundingClientRect();
              if (rect.top < window.innerHeight && rect.bottom > 0) {
                if (img.dataset.src && !img.src) {
                  img.src = img.dataset.src;
                }
              }
            }
          });
        }, [scrollPosition]);

        // Wait for scroll completion and content loading
        await this.wait(600); // Increased wait time

        // Wait for images to load
        await this.executeScript(tab.id, () => {
          return new Promise<void>((resolve) => {
            const images = Array.from(document.querySelectorAll('img'));
            const visibleImages = images.filter(img => {
              const rect = img.getBoundingClientRect();
              return rect.top < window.innerHeight && rect.bottom > 0;
            });

            if (visibleImages.length === 0) {
              resolve();
              return;
            }

            let loaded = 0;
            const checkComplete = () => {
              loaded++;
              if (loaded >= visibleImages.length) {
                resolve();
              }
            };

            visibleImages.forEach(img => {
              if (img.complete) {
                checkComplete();
              } else {
                img.onload = checkComplete;
                img.onerror = checkComplete;
              }
            });

            // Timeout after 2 seconds
            setTimeout(resolve, 2000);
          });
        });

        // Additional wait for any animations or dynamic content
        await this.wait(200);

        // Capture this section
        try {
          const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: options.format || 'png',
            quality: options.quality || 100
          });

          if (dataUrl) {
            captures.push(dataUrl);
            console.log(`✅ Section ${i + 1} captured successfully`);
          } else {
            console.warn(`⚠️ Section ${i + 1} capture returned empty data`);
          }
        } catch (captureError) {
          console.warn(`⚠️ Section ${i + 1} capture failed:`, captureError);
          // Continue with other sections
        }
      }

      // Step 7: Restore original scroll position
      await this.executeScript(tab.id, () => {
        const originalY = window.__originalScrollY || 0;
        const originalX = window.__originalScrollX || 0;
        window.scrollTo(originalX, originalY);
        
        // Cleanup
        delete window.__originalScrollY;
        delete window.__originalScrollX;
      });

      if (captures.length === 0) {
        throw new Error('No sections were captured successfully');
      }

      console.log(`✅ Captured ${captures.length} sections, stitching together...`);

      // Step 8: Enhanced image stitching
      const stitchedResult = await this.enhancedImageStitching(captures, dimensions, scrollSteps);
      
      if (!stitchedResult.success) {
        throw new Error(stitchedResult.error || 'Failed to stitch images');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const domain = this.extractDomain(tab.url || 'unknown');
      const filename = `fullpage_${domain}_${timestamp}.png`;

      console.log('✅ Enhanced full page capture completed successfully');

      return {
        success: true,
        dataUrl: stitchedResult.dataUrl!,
        filename,
        blob: stitchedResult.blob!
      };

    } catch (error) {
      // Restore scroll position on error
      try {
        if (tab.id) {
          await this.executeScript(tab.id, () => {
            const originalY = window.__originalScrollY || 0;
            const originalX = window.__originalScrollX || 0;
            window.scrollTo(originalX, originalY);
            
            // Cleanup
            delete window.__originalScrollY;
            delete window.__originalScrollX;
          });
        }
      } catch (restoreError) {
        console.warn('Failed to restore scroll position:', restoreError);
      }

      return this.handleCaptureError(error);
    }
  }

  /**
   * Get enhanced page information for better full-page capture
   */
  private async getEnhancedPageInfo(tabId: number): Promise<{
    success: boolean;
    data?: {
      viewportWidth: number;
      viewportHeight: number;
      documentWidth: number;
      documentHeight: number;
      scrollTop: number;
      scrollLeft: number;
      devicePixelRatio: number;
      hasFixedElements: boolean;
    };
    error?: string;
  }> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // Get accurate document dimensions
          const body = document.body;
          const documentElement = document.documentElement;
          
          const documentHeight = Math.max(
            body.scrollHeight, documentElement.scrollHeight,
            body.offsetHeight, documentElement.offsetHeight,
            body.clientHeight, documentElement.clientHeight
          );
          
          const documentWidth = Math.max(
            body.scrollWidth, documentElement.scrollWidth,
            body.offsetWidth, documentElement.offsetWidth,
            body.clientWidth, documentElement.clientWidth
          );

          // Check for fixed/sticky elements that might affect capturing
          const fixedElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const style = window.getComputedStyle(el);
            return style.position === 'fixed' || style.position === 'sticky';
          });

          return {
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            documentWidth,
            documentHeight,
            scrollTop: window.scrollY || documentElement.scrollTop || body.scrollTop,
            scrollLeft: window.scrollX || documentElement.scrollLeft || body.scrollLeft,
            devicePixelRatio: window.devicePixelRatio || 1,
            hasFixedElements: fixedElements.length > 0
          };
        }
      });

      if (results && results[0]?.result) {
        return {
          success: true,
          data: results[0].result
        };
      } else {
        return {
          success: false,
          error: 'Failed to execute page info script'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get page info'
      };
    }
  }

  /**
   * Calculate optimal scroll steps for better coverage
   */
  private calculateOptimalScrollSteps(dimensions: any): number[] {
    const { viewportHeight, documentHeight } = dimensions;
    const steps: number[] = [];
    
    // Calculate overlap to avoid missing content between captures
    const overlap = Math.min(100, viewportHeight * 0.1); // 10% overlap or 100px max
    const stepSize = viewportHeight - overlap;
    
    let currentPosition = 0;
    
    while (currentPosition < documentHeight) {
      steps.push(currentPosition);
      currentPosition += stepSize;
      
      // Ensure we don't go beyond the document
      if (currentPosition >= documentHeight - viewportHeight) {
        // Add final position that captures the bottom of the page
        const finalPosition = Math.max(0, documentHeight - viewportHeight);
        if (finalPosition > steps[steps.length - 1]) {
          steps.push(finalPosition);
        }
        break;
      }
    }
    
    return steps;
  }

  /**
   * Enhanced image stitching with better overlap handling
   */
  private async enhancedImageStitching(
    captures: string[], 
    dimensions: any,
    scrollSteps: number[]
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
        canvas.height = dimensions.documentHeight;

        // Fill with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let loadedImages = 0;
        const images: HTMLImageElement[] = [];

        // Load all images
        captures.forEach((dataUrl, index) => {
          const img = new Image();
          img.onload = () => {
            images[index] = img;
            loadedImages++;
            
            if (loadedImages === captures.length) {
              // All images loaded, stitch them with enhanced logic
              try {
                images.forEach((img, i) => {
                  if (!img) return; // Skip failed images
                  
                  const scrollPosition = scrollSteps[i];
                  let drawY = scrollPosition;
                  let drawHeight = dimensions.viewportHeight;
                  
                  // Handle last image to ensure it reaches the bottom
                  if (i === images.length - 1) {
                    drawY = Math.max(scrollPosition, dimensions.documentHeight - img.height);
                    drawHeight = Math.min(img.height, dimensions.documentHeight - drawY);
                  }
                  
                  // Ensure we don't draw outside canvas bounds
                  if (drawY + drawHeight > canvas.height) {
                    drawHeight = canvas.height - drawY;
                  }
                  
                  if (drawHeight > 0) {
                    ctx.drawImage(img, 0, drawY, canvas.width, drawHeight);
                  }
                });

                canvas.toBlob((blob) => {
                  if (blob) {
                    const dataUrl = canvas.toDataURL('image/png', 1.0);
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
                  error: error instanceof Error ? error.message : 'Enhanced stitching failed'
                });
              }
            }
          };

          img.onerror = () => {
            console.warn(`Failed to load capture ${index}`);
            loadedImages++;
            
            if (loadedImages === captures.length) {
              // Continue with available images
              resolve({ success: false, error: `Failed to load capture ${index}` });
            }
          };

          img.src = dataUrl;
        });

      } catch (error) {
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Enhanced image stitching failed'
        });
      }
    });
  }

  /**
   * Helper: Execute script in tab with better error handling
   */
  private async executeScript(tabId: number, func: (...args: any[]) => any, args: any[] = []): Promise<any> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func,
        args
      });
      
      return results[0]?.result;
    } catch (error) {
      console.error('Script execution error:', error);
      throw error;
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
   * 🔥 UPDATED: Save screenshot to storage with REAL S3 integration
   */
  async saveToStorage(result: ScreenshotResult, caseId: string): Promise<boolean> {
    try {
      if (!result.success || !result.blob || !result.filename) {
        throw new Error('Invalid screenshot result for saving');
      }

      console.log('💾 Saving screenshot to S3 via Backend API...', {
        filename: result.filename,
        size: result.blob.size,
        caseId
      });

      // 🔥 NEW: Import S3 service dynamically to avoid circular dependency
      const { s3Service } = await import('./s3Service');

      // 🔥 NEW: Upload to S3 via Backend API with real progress tracking
      const uploadResult = await s3Service.uploadFile(
        result.blob,
        result.filename,
        caseId,
        'screenshot',
        {
          onProgress: (progress) => {
            console.log(`📤 Upload progress: ${progress.percentage}%`);
          },
          metadata: {
            captureType: 'screenshot',
            sourceUrl: result.sourceUrl,
            timestamp: new Date().toISOString(),
          }
        }
      );

      if (uploadResult.success) {
        console.log('✅ Screenshot saved to S3 successfully:', uploadResult.fileKey);
        return true;
      } else {
        console.error('❌ Screenshot save failed:', uploadResult.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Error saving screenshot:', error);
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

  // 🔥 NEW: Additional methods for backend integration

  /**
   * Get screenshot history from backend
   */
  async getScreenshotHistory(caseId?: string): Promise<any[]> {
    try {
      if (!caseId) {
        console.warn('No case ID provided for screenshot history');
        return [];
      }

      const { caseService } = await import('./caseService');
      
      const files = await caseService.getCaseFiles(caseId, {
        captureType: 'screenshot',
        limit: 50
      });
      
      console.log('📸 Screenshot history loaded:', files.length);
      return files;
    } catch (error) {
      console.error('❌ Failed to load screenshot history:', error);
      return [];
    }
  }

  /**
   * Delete screenshot from backend and S3
   */
  async deleteScreenshot(fileKey: string, caseId?: string): Promise<boolean> {
    try {
      console.log('🗑️ Deleting screenshot:', fileKey);
      
      const { s3Service } = await import('./s3Service');
      
      await s3Service.deleteFile(fileKey, caseId);
      console.log('✅ Screenshot deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to delete screenshot:', error);
      return false;
    }
  }

  /**
   * Get screenshot statistics from backend
   */
  async getScreenshotStats(caseId?: string): Promise<any> {
    try {
      const { s3Service } = await import('./s3Service');
      
      const stats = await s3Service.getUploadStats({
        caseId,
        detailed: true
      });
      
      const screenshotStats = {
        total: stats.byType?.screenshot || 0,
        totalSize: stats.totalSize || 0,
        recentUploads: (stats.recentUploads || []).filter((upload: any) => 
          upload.captureType === 'screenshot'
        )
      };
      
      console.log('📊 Screenshot stats loaded:', screenshotStats);
      return screenshotStats;
    } catch (error) {
      console.error('❌ Failed to load screenshot stats:', error);
      return {
        total: 0,
        totalSize: 0,
        recentUploads: []
      };
    }
  }

  /**
   * Copy screenshot to clipboard
   */
  async copyToClipboard(dataUrl: string): Promise<boolean> {
    try {
      console.log('📋 Copying screenshot to clipboard...');
      
      const blob = await this.dataUrlToBlob(dataUrl);
      const clipboardItem = new ClipboardItem({
        [blob.type]: blob
      });
      
      await navigator.clipboard.write([clipboardItem]);
      console.log('✅ Screenshot copied to clipboard');
      return true;
    } catch (error) {
      console.error('❌ Clipboard copy failed:', error);
      return false;
    }
  }
}

export const screenshotService = ScreenshotService.getInstance();