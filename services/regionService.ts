// services/regionService.ts - FIXED Region Capture Service with accurate coordinates

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
  highDPI?: boolean;
  respectZoom?: boolean;
}

export interface RegionCaptureResult {
  success: boolean;
  dataUrl?: string;
  filename?: string;
  blob?: Blob;
  selection?: RegionSelection;
  sourceUrl?: string;
  captureInfo?: any;
  error?: string;
}

export interface CaptureEnvironmentInfo {
  devicePixelRatio: number;
  zoomLevel: number;
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  scrollX: number;
  scrollY: number;
  documentWidth: number;
  documentHeight: number;
  timestamp: number;
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
    console.log('✅ Region service initialized with accurate coordinate support');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 🔥 FIXED: Start region selection process with accurate coordinate handling
   */
  async startRegionSelection(options: RegionCaptureOptions = {}): Promise<RegionCaptureResult> {
    try {
      console.log('🎯 Starting accurate region selection process...');

      // Check if we can access the current tab
      const permissionCheck = await this.checkTabPermissions();
      if (!permissionCheck.canCapture) {
        return {
          success: false,
          error: permissionCheck.error || 'Cannot access current tab'
        };
      }

      // 🔥 FIXED: Use the enhanced region capture workflow with coordinate accuracy
      return await this.startAccurateRegionCapture(options);

    } catch (error) {
      console.error('❌ Region selection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Region selection failed'
      };
    }
  }

  /**
   * 🔥 FIXED: Enhanced region capture with accurate coordinate transformation
   */
  private async startAccurateRegionCapture(options: RegionCaptureOptions): Promise<RegionCaptureResult> {
    try {
      console.log('🎯 Starting accurate region capture with coordinate precision...');

      // Step 1: Get current tab info
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab || !currentTab.id) {
        throw new Error('No active tab found');
      }

      // Step 2: Collect capture environment information
      const captureInfo = await this.collectCaptureEnvironmentInfo(currentTab.id);
      console.log('📊 Capture environment collected:', captureInfo);

      // Step 3: Capture base image from visible area with proper DPI handling
      const baseCapture = await this.captureAccurateBaseImage(currentTab);
      if (!baseCapture.success) {
        throw new Error(baseCapture.error || 'Failed to capture base image');
      }

      console.log('✅ Accurate base image captured for region selection');

      // Step 4: Create session and start region selector
      const sessionId = `region_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store session data with capture environment info
      await chrome.storage.local.set({
        [`region_session_${sessionId}`]: {
          dataUrl: baseCapture.dataUrl,
          filename: baseCapture.filename,
          sourceUrl: currentTab.url,
          timestamp: new Date().toISOString(),
          type: 'region-base',
          captureInfo: captureInfo,
          options: options
        }
      });

      console.log('💾 Session data with capture info stored with ID:', sessionId);

      // Step 5: Start accurate region selector via background script
      const bgResponse = await chrome.runtime.sendMessage({
        type: 'START_REGION_CAPTURE',
        sessionId: sessionId,
        options: options,
        captureInfo: captureInfo
      });

      if (!bgResponse || !bgResponse.success) {
        throw new Error(bgResponse?.error || 'Failed to start accurate region selector');
      }

      console.log('✅ Accurate region selector started successfully');

      // 🔥 FIXED: Return success immediately - result will be handled by background script
      return {
        success: true,
        sourceUrl: currentTab.url,
        captureInfo: captureInfo
      };

    } catch (error) {
      console.error('❌ Accurate region capture failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Accurate region capture failed'
      };
    }
  }

  /**
   * 🔥 NEW: Collect accurate capture environment information
   */
  private async collectCaptureEnvironmentInfo(tabId: number): Promise<CaptureEnvironmentInfo> {
    try {
      // Execute script to collect environment info
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          return {
            devicePixelRatio: window.devicePixelRatio,
            zoomLevel: window.outerWidth / window.innerWidth,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            scrollX: window.pageXOffset || document.documentElement.scrollLeft,
            scrollY: window.pageYOffset || document.documentElement.scrollTop,
            documentWidth: document.documentElement.scrollWidth,
            documentHeight: document.documentElement.scrollHeight,
            timestamp: Date.now(),
          };
        },
      });

      if (results && results[0] && results[0].result) {
        return results[0].result as CaptureEnvironmentInfo;
      }

      // Fallback values
      return {
        devicePixelRatio: 1,
        zoomLevel: 1,
        viewportWidth: 1920,
        viewportHeight: 1080,
        screenWidth: 1920,
        screenHeight: 1080,
        scrollX: 0,
        scrollY: 0,
        documentWidth: 1920,
        documentHeight: 1080,
        timestamp: Date.now(),
      };

    } catch (error) {
      console.warn('⚠️ Failed to collect capture environment info, using defaults:', error);
      return {
        devicePixelRatio: 1,
        zoomLevel: 1,
        viewportWidth: 1920,
        viewportHeight: 1080,
        screenWidth: 1920,
        screenHeight: 1080,
        scrollX: 0,
        scrollY: 0,
        documentWidth: 1920,
        documentHeight: 1080,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 🔥 FIXED: Capture base image with proper DPI and zoom handling
   */
  private async captureAccurateBaseImage(tab: chrome.tabs.Tab): Promise<{
    success: boolean;
    dataUrl?: string;
    filename?: string;
    error?: string;
  }> {
    try {
      if (!tab || !tab.windowId) {
        return {
          success: false,
          error: 'No active tab with window found'
        };
      }

      // Capture visible area with maximum quality for accurate pixel representation
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

      // Generate filename with accuracy indicator
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const domain = this.extractDomain(tab.url || 'unknown');
      const filename = `accurate_base_${domain}_${timestamp}.png`;

      console.log('✅ Accurate base image captured:', {
        filename,
        dataUrlLength: dataUrl.length,
        format: 'PNG',
        quality: 100
      });

      return {
        success: true,
        dataUrl,
        filename
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Accurate base image capture failed'
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
   * 🔥 FIXED: Get accurate selection statistics with DPI consideration
   */
  getAccurateSelectionStats(
    selection: RegionSelection, 
    captureInfo?: CaptureEnvironmentInfo
  ): {
    cssPixels: RegionSelection;
    devicePixels: RegionSelection;
    area: number;
    deviceArea: number;
    aspectRatio: number;
    isSquare: boolean;
    isLandscape: boolean;
    isPortrait: boolean;
    scale: number;
  } {
    const scale = captureInfo ? (captureInfo.devicePixelRatio * captureInfo.zoomLevel) : 1;
    
    const devicePixels = {
      x: Math.round(selection.x * scale),
      y: Math.round(selection.y * scale),
      width: Math.round(selection.width * scale),
      height: Math.round(selection.height * scale),
    };

    const area = selection.width * selection.height;
    const deviceArea = devicePixels.width * devicePixels.height;
    const aspectRatio = selection.width / selection.height;
    
    return {
      cssPixels: selection,
      devicePixels,
      area,
      deviceArea,
      aspectRatio,
      scale,
      isSquare: Math.abs(aspectRatio - 1) < 0.1,
      isLandscape: aspectRatio > 1.2,
      isPortrait: aspectRatio < 0.8
    };
  }

  /**
   * 🔥 FIXED: Validate region selection with DPI awareness
   */
  validateAccurateRegion(
    selection: RegionSelection, 
    captureInfo?: CaptureEnvironmentInfo
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    stats: any;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const stats = this.getAccurateSelectionStats(selection, captureInfo);

    // Check minimum size (CSS pixels)
    if (selection.width < 10 || selection.height < 10) {
      errors.push('Region too small (minimum 10x10 CSS pixels)');
    }

    // Check maximum size (prevent memory issues)
    if (selection.width > 10000 || selection.height > 10000) {
      errors.push('Region too large (maximum 10,000 CSS pixels per dimension)');
    }

    // Check device pixel limits
    if (stats.devicePixels.width > 20000 || stats.devicePixels.height > 20000) {
      errors.push('Device pixel dimensions too large for processing');
    }

    // Check coordinates
    if (selection.x < 0 || selection.y < 0) {
      errors.push('Region coordinates cannot be negative');
    }

    // Warnings for very small regions
    if (selection.width < 50 || selection.height < 50) {
      warnings.push('Very small region may not capture enough detail');
    }

    // Warnings for very large device pixel regions
    if (stats.deviceArea > 16000000) { // 16MP device pixels
      warnings.push('Large device pixel region may take longer to process');
    }

    // High DPI specific warnings
    if (stats.scale > 2) {
      warnings.push(`High DPI display detected (${stats.scale}x). Region will be captured at ${stats.devicePixels.width}x${stats.devicePixels.height} device pixels.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      stats
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
   * 🔥 FIXED: Create region capture from coordinates with accurate transformation
   */
  async captureRegionFromAccurateCoordinates(
    selection: RegionSelection,
    captureInfo: CaptureEnvironmentInfo,
    options: RegionCaptureOptions = {}
  ): Promise<RegionCaptureResult> {
    try {
      console.log('📸 Capturing region from accurate coordinates:', { selection, captureInfo });

      // Validate selection with DPI awareness
      const validation = this.validateAccurateRegion(selection, captureInfo);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Invalid region: ${validation.errors.join(', ')}`
        };
      }

      // Log validation stats
      console.log('📊 Region validation stats:', validation.stats);

      // Capture base image
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab) {
        return {
          success: false,
          error: 'No active tab found'
        };
      }

      const baseCapture = await this.captureAccurateBaseImage(currentTab);
      if (!baseCapture.success) {
        return {
          success: false,
          error: baseCapture.error || 'Failed to capture base image'
        };
      }

      // Crop to region with accurate coordinate transformation
      const croppedResult = await this.cropImageToAccurateRegion(
        baseCapture.dataUrl!, 
        selection, 
        captureInfo
      );
      if (!croppedResult.success) {
        return {
          success: false,
          error: croppedResult.error || 'Failed to crop region'
        };
      }

      // Generate filename with accuracy info
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const scale = captureInfo.devicePixelRatio * captureInfo.zoomLevel;
      const filename = `accurate_region_${selection.width}x${selection.height}_${scale.toFixed(1)}x_${timestamp}.png`;

      return {
        success: true,
        dataUrl: croppedResult.dataUrl,
        filename,
        blob: croppedResult.blob,
        selection,
        captureInfo
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Accurate region capture failed'
      };
    }
  }

  /**
   * 🔥 FIXED: Crop image to region with accurate coordinate transformation
   */
  private async cropImageToAccurateRegion(
    dataUrl: string,
    selection: RegionSelection,
    captureInfo: CaptureEnvironmentInfo
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

            // Calculate accurate scaling
            const scale = captureInfo.devicePixelRatio * captureInfo.zoomLevel;
            
            // Transform CSS pixels to device pixels
            const deviceSelection = {
              x: Math.round(selection.x * scale),
              y: Math.round(selection.y * scale),
              width: Math.round(selection.width * scale),
              height: Math.round(selection.height * scale)
            };

            // Ensure region is within image bounds
            const boundedSelection = {
              x: Math.max(0, Math.min(deviceSelection.x, img.width - 1)),
              y: Math.max(0, Math.min(deviceSelection.y, img.height - 1)),
              width: Math.max(1, Math.min(deviceSelection.width, img.width - deviceSelection.x)),
              height: Math.max(1, Math.min(deviceSelection.height, img.height - deviceSelection.y))
            };

            console.log('🖼️ Accurate crop transformation:', {
              cssSelection: selection,
              deviceSelection: deviceSelection,
              boundedSelection: boundedSelection,
              scale: scale,
              imageSize: { width: img.width, height: img.height }
            });

            // Set canvas size to original CSS pixel dimensions
            canvas.width = selection.width;
            canvas.height = selection.height;

            // Fill with white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw the accurate region
            ctx.drawImage(
              img,
              boundedSelection.x,      // Source X (device pixels)
              boundedSelection.y,      // Source Y (device pixels)
              boundedSelection.width,  // Source Width (device pixels)
              boundedSelection.height, // Source Height (device pixels)
              0,                       // Destination X (canvas origin)
              0,                       // Destination Y (canvas origin)
              selection.width,         // Destination Width (CSS pixels)
              selection.height         // Destination Height (CSS pixels)
            );

            // Convert to blob with high quality
            canvas.toBlob((blob) => {
              if (blob) {
                const croppedDataUrl = canvas.toDataURL('image/png', 1.0);
                console.log('✅ Accurate region crop completed:', {
                  outputSize: `${selection.width}x${selection.height}`,
                  fileSize: blob.size,
                  scale: scale
                });
                resolve({
                  success: true,
                  dataUrl: croppedDataUrl,
                  blob
                });
              } else {
                resolve({ success: false, error: 'Failed to create image blob' });
              }
            }, 'image/png', 1.0);

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

        img.crossOrigin = 'anonymous';
        img.src = dataUrl;

      } catch (error) {
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Image cropping failed'
        });
      }
    });
  }

  /**
   * 🔥 NEW: Get capture environment info for current tab
   */
  async getCurrentCaptureInfo(): Promise<CaptureEnvironmentInfo | null> {
    try {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab || !currentTab.id) {
        return null;
      }

      return await this.collectCaptureEnvironmentInfo(currentTab.id);
    } catch (error) {
      console.warn('⚠️ Failed to get current capture info:', error);
      return null;
    }
  }

  /**
   * 🔥 NEW: Estimate file size based on region and capture info
   */
  estimateRegionFileSize(
    selection: RegionSelection,
    captureInfo: CaptureEnvironmentInfo,
    format: 'png' | 'jpg' = 'png'
  ): {
    estimatedSizeKB: number;
    estimatedSizeMB: number;
    isLarge: boolean;
    recommendation: string;
  } {
    const stats = this.getAccurateSelectionStats(selection, captureInfo);
    
    // Rough estimation based on device pixels
    const pixelCount = stats.deviceArea;
    
    // PNG: ~4 bytes per pixel (RGBA), JPG: ~1-2 bytes per pixel
    const bytesPerPixel = format === 'png' ? 4 : 1.5;
    const estimatedBytes = pixelCount * bytesPerPixel;
    
    const estimatedSizeKB = Math.round(estimatedBytes / 1024);
    const estimatedSizeMB = estimatedSizeKB / 1024;
    
    const isLarge = estimatedSizeMB > 5; // Consider >5MB as large
    
    let recommendation = 'Good size for sharing';
    if (estimatedSizeMB > 10) {
      recommendation = 'Very large - consider using JPG or smaller region';
    } else if (estimatedSizeMB > 5) {
      recommendation = 'Large file - may be slow to upload';
    } else if (estimatedSizeKB < 50) {
      recommendation = 'Small region - may lack detail';
    }

    return {
      estimatedSizeKB,
      estimatedSizeMB,
      isLarge,
      recommendation
    };
  }

  /**
   * 🔥 NEW: Debug region capture accuracy
   */
  async debugRegionAccuracy(
    selection: RegionSelection,
    captureInfo: CaptureEnvironmentInfo
  ): Promise<{
    cssPixels: RegionSelection;
    devicePixels: RegionSelection;
    scale: number;
    environment: CaptureEnvironmentInfo;
    validation: any;
    fileEstimate: any;
  }> {
    const stats = this.getAccurateSelectionStats(selection, captureInfo);
    const validation = this.validateAccurateRegion(selection, captureInfo);
    const fileEstimate = this.estimateRegionFileSize(selection, captureInfo);

    return {
      cssPixels: selection,
      devicePixels: stats.devicePixels,
      scale: stats.scale,
      environment: captureInfo,
      validation,
      fileEstimate
    };
  }
}

export const regionService = RegionService.getInstance();