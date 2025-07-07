// services/regionService.ts - Fixed Region Capture Service

export interface RegionSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RegionCaptureOptions {
  showGuides?: boolean;
  showDimensions?: boolean;
  overlayColor?: string;
  borderColor?: string;
}

export interface RegionCaptureResult {
  success: boolean;
  dataUrl?: string;
  filename?: string;
  blob?: Blob;
  selection?: RegionSelection;
  sourceUrl?: string;
  error?: string;
}

class RegionService {
  private static instance: RegionService;
  private initialized = false;

  private constructor() {}

  public static getInstance(): RegionService {
    if (!RegionService.instance) {
      RegionService.instance = new RegionService();
    }
    return RegionService.instance;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    console.log('✅ Region service initialized');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Start region selection process (FIXED - doesn't close popup)
   */
  async startRegionSelection(options: RegionCaptureOptions = {}): Promise<RegionCaptureResult> {
    try {
      console.log('🎯 Starting region selection process...');

      // Check if we can access the current tab
      const permissionCheck = await this.checkTabPermissions();
      if (!permissionCheck.canCapture) {
        return {
          success: false,
          error: permissionCheck.error || 'Cannot access current tab'
        };
      }

      // 🔥 FIXED: Use the new region capture workflow
      return await this.startEnhancedRegionCapture(options);

    } catch (error) {
      console.error('❌ Region selection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Region selection failed'
      };
    }
  }

  /**
   * FIXED: Enhanced region capture that works with the background script
   */
  private async startEnhancedRegionCapture(options: RegionCaptureOptions): Promise<RegionCaptureResult> {
    try {
      console.log('🎯 Starting enhanced region capture...');

      // Step 1: Get current tab info
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab || !currentTab.id) {
        throw new Error('No active tab found');
      }

      // Step 2: Capture base image from visible area
      const baseCapture = await this.captureBaseImage();
      if (!baseCapture.success) {
        throw new Error(baseCapture.error || 'Failed to capture base image');
      }

      console.log('✅ Base image captured for region selection');

      // Step 3: Create session and start region selector
      const sessionId = `region_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store session data
      await chrome.storage.local.set({
        [`region_session_${sessionId}`]: {
          dataUrl: baseCapture.dataUrl,
          filename: baseCapture.filename,
          sourceUrl: currentTab.url,
          timestamp: new Date().toISOString(),
          type: 'region-base'
        }
      });

      console.log('💾 Session data stored with ID:', sessionId);

      // Step 4: Start region selector via background script
      const bgResponse = await chrome.runtime.sendMessage({
        type: 'START_REGION_CAPTURE',
        sessionId: sessionId,
        options: options
      });

      if (!bgResponse || !bgResponse.success) {
        throw new Error(bgResponse?.error || 'Failed to start region selector');
      }

      console.log('✅ Region selector started successfully');

      // 🔥 FIXED: Return success immediately - result will be handled by background script
      return {
        success: true,
        sourceUrl: currentTab.url
      };

    } catch (error) {
      console.error('❌ Enhanced region capture failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Enhanced region capture failed'
      };
    }
  }

  /**
   * Capture base image for region selection
   */
  private async captureBaseImage(): Promise<{
    success: boolean;
    dataUrl?: string;
    filename?: string;
    error?: string;
  }> {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.windowId) {
        return {
          success: false,
          error: 'No active tab with window found'
        };
      }

      // Capture visible area
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 100
      });

      if (!dataUrl) {
        return {
          success: false,
          error: 'Failed to capture visible tab'
        };
      }

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const domain = this.extractDomain(tab.url || 'unknown');
      const filename = `base_${domain}_${timestamp}.png`;

      return {
        success: true,
        dataUrl,
        filename
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Base image capture failed'
      };
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

      // Check for restricted URLs
      const restrictedPatterns = [
        /^chrome:\/\//,
        /^chrome-extension:\/\//,
        /^moz-extension:\/\//,
        /^about:/,
        /^edge:\/\//,
        /^file:\/\//
      ];

      const isRestricted = restrictedPatterns.some(pattern => pattern.test(tab.url!));
      
      if (isRestricted) {
        return {
          canCapture: false,
          error: 'Cannot capture browser internal pages. Please navigate to a regular website.'
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
   * Get selection statistics for UI feedback
   */
  getSelectionStats(selection: RegionSelection): {
    area: number;
    aspectRatio: number;
    isSquare: boolean;
    isLandscape: boolean;
    isPortrait: boolean;
  } {
    const area = selection.width * selection.height;
    const aspectRatio = selection.width / selection.height;
    
    return {
      area,
      aspectRatio,
      isSquare: Math.abs(aspectRatio - 1) < 0.1,
      isLandscape: aspectRatio > 1.2,
      isPortrait: aspectRatio < 0.8
    };
  }

  /**
   * Validate region selection
   */
  validateRegion(selection: RegionSelection): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check minimum size
    if (selection.width < 10 || selection.height < 10) {
      errors.push('Region too small (minimum 10x10 pixels)');
    }

    // Check maximum size (prevent memory issues)
    if (selection.width > 10000 || selection.height > 10000) {
      errors.push('Region too large (maximum 10,000 pixels per dimension)');
    }

    // Check coordinates
    if (selection.x < 0 || selection.y < 0) {
      errors.push('Region coordinates cannot be negative');
    }

    // Warnings for very small regions
    if (selection.width < 50 || selection.height < 50) {
      warnings.push('Very small region may not capture enough detail');
    }

    // Warnings for very large regions
    if (selection.width * selection.height > 4000000) { // 4MP
      warnings.push('Large region may take longer to process');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Cancel active region selection
   */
  async cancelRegionSelection(): Promise<void> {
    try {
      // Send cancellation message to background script
      await chrome.runtime.sendMessage({
        type: 'CANCEL_REGION_SELECTION'
      });

      console.log('✅ Region selection cancelled');
    } catch (error) {
      console.warn('⚠️ Failed to cancel region selection:', error);
    }
  }

  /**
   * Check if region selection is currently active
   */
  async isRegionSelectionActive(): Promise<boolean> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'IS_REGION_SELECTION_ACTIVE'
      });

      return response?.active || false;
    } catch (error) {
      console.warn('⚠️ Failed to check region selection status:', error);
      return false;
    }
  }

  /**
   * Helper: Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/\./g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Legacy method for compatibility
   */
  async selectRegion(options: RegionCaptureOptions = {}): Promise<RegionCaptureResult> {
    return this.startRegionSelection(options);
  }

  /**
   * Create region capture from coordinates (for programmatic use)
   */
  async captureRegionFromCoordinates(
    selection: RegionSelection,
    options: RegionCaptureOptions = {}
  ): Promise<RegionCaptureResult> {
    try {
      console.log('📸 Capturing region from coordinates:', selection);

      // Validate selection
      const validation = this.validateRegion(selection);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Invalid region: ${validation.errors.join(', ')}`
        };
      }

      // Capture base image
      const baseCapture = await this.captureBaseImage();
      if (!baseCapture.success) {
        return {
          success: false,
          error: baseCapture.error || 'Failed to capture base image'
        };
      }

      // Crop to region
      const croppedResult = await this.cropImageToRegion(baseCapture.dataUrl!, selection);
      if (!croppedResult.success) {
        return {
          success: false,
          error: croppedResult.error || 'Failed to crop region'
        };
      }

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `region_${selection.width}x${selection.height}_${timestamp}.png`;

      return {
        success: true,
        dataUrl: croppedResult.dataUrl,
        filename,
        blob: croppedResult.blob,
        selection
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Region capture failed'
      };
    }
  }

  /**
   * Crop image to specified region
   */
  private async cropImageToRegion(
    dataUrl: string,
    selection: RegionSelection
  ): Promise<{
    success: boolean;
    dataUrl?: string;
    blob?: Blob;
    error?: string;
  }> {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              resolve({ success: false, error: 'Canvas context not available' });
              return;
            }

            // Set canvas size to region size
            canvas.width = selection.width;
            canvas.height = selection.height;

            // Fill with white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw the cropped portion
            ctx.drawImage(
              img,
              selection.x, selection.y, selection.width, selection.height,
              0, 0, selection.width, selection.height
            );

            // Convert to blob
            canvas.toBlob((blob) => {
              if (blob) {
                const croppedDataUrl = canvas.toDataURL('image/png');
                resolve({
                  success: true,
                  dataUrl: croppedDataUrl,
                  blob
                });
              } else {
                resolve({ success: false, error: 'Failed to create image blob' });
              }
            }, 'image/png');

          } catch (error) {
            resolve({
              success: false,
              error: error instanceof Error ? error.message : 'Image processing failed'
            });
          }
        };

        img.onerror = () => {
          resolve({ success: false, error: 'Failed to load image' });
        };

        img.src = dataUrl;

      } catch (error) {
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Image cropping failed'
        });
      }
    });
  }
}

export const regionService = RegionService.getInstance();