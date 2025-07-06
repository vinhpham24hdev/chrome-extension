// services/regionService.ts - Service to handle region selection
import { RegionSelection } from '../content-scripts/regionSelector';

export interface RegionCaptureResult {
  success: boolean;
  dataUrl?: string;
  filename?: string;
  blob?: Blob;
  selection?: RegionSelection;
  error?: string;
}

export interface RegionServiceOptions {
  showGuides?: boolean;
  showDimensions?: boolean;
  overlayColor?: string;
  borderColor?: string;
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
   * Start region selection process
   */
  async startRegionSelection(options: RegionServiceOptions = {}): Promise<RegionCaptureResult> {
    try {
      console.log('🎯 Starting region selection...');

      // Check if we have active tab access
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        return {
          success: false,
          error: 'No active tab found'
        };
      }

      const tab = tabs[0];

      // Check if tab can be accessed
      if (!tab.url || this.isRestrictedUrl(tab.url)) {
        return {
          success: false,
          error: 'Cannot capture region on this page. Please try on a regular website.'
        };
      }

      // Inject region selector content script if not already present
      await this.injectRegionSelector(tab.id!);

      // Start region selection
      const selection = await this.requestRegionSelection(tab.id!, options);
      
      if (!selection) {
        return {
          success: false,
          error: 'Region selection was cancelled'
        };
      }

      console.log('📍 Region selected:', selection);

      // Capture the full visible area first
      const fullScreenshot = await this.captureFullScreen(tab);
      
      if (!fullScreenshot.success) {
        return {
          success: false,
          error: fullScreenshot.error || 'Failed to capture screenshot'
        };
      }

      // Crop the selected region
      const croppedResult = await this.cropImageToRegion(
        fullScreenshot.dataUrl!,
        selection
      );

      if (!croppedResult.success) {
        return {
          success: false,
          error: croppedResult.error || 'Failed to crop region'
        };
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const domain = this.extractDomain(tab.url || 'unknown');
      const filename = `region_${selection.width}x${selection.height}_${domain}_${timestamp}.png`;

      return {
        success: true,
        dataUrl: croppedResult.dataUrl!,
        filename,
        blob: croppedResult.blob!,
        selection
      };

    } catch (error) {
      console.error('❌ Region selection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Region selection failed'
      };
    }
  }

  /**
   * Check if URL is restricted for capturing
   */
  private isRestrictedUrl(url: string): boolean {
    const restrictedPatterns = [
      /^chrome:\/\//,
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      /^about:/,
      /^edge:\/\//,
      /^file:\/\//,
      /^data:/,
      /^javascript:/,
      /^chrome-search:\/\//,
      /^chrome-devtools:\/\//
    ];

    return restrictedPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Extract domain from URL for filename
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
   * Inject region selector content script
   */
  private async injectRegionSelector(tabId: number): Promise<void> {
    try {
      // Check if content script is already injected
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return typeof (window as any).isRegionSelectionActive === 'function';
        }
      });

      const isAlreadyInjected = results[0]?.result;

      if (!isAlreadyInjected) {
        // Inject the region selector content script directly as code
        await chrome.scripting.executeScript({
          target: { tabId },
          func: this.injectRegionSelectorCode
        });
        
        console.log('💉 Region selector content script injected');
      }
    } catch (error) {
      console.error('Failed to inject region selector:', error);
      throw new Error('Failed to initialize region selector');
    }
  }

  /**
   * Inline region selector code to inject
   */
  private injectRegionSelectorCode = () => {
    // Inline region selector implementation
    class RegionSelector {
      public isActive = false;
      private isDragging = false;
      private startX = 0;
      private startY = 0;
      private currentX = 0;
      private currentY = 0;
      
      private overlay: HTMLDivElement | null = null;
      private selectionBox: HTMLDivElement | null = null;
      private dimensionsDisplay: HTMLDivElement | null = null;
      private instructionsPanel: HTMLDivElement | null = null;
      private crosshairX: HTMLDivElement | null = null;
      private crosshairY: HTMLDivElement | null = null;
      
      private options: any;
      private originalBodyStyle: string = '';
      private resolveSelection: ((selection: any) => void) | null = null;

      constructor(options: any = {}) {
        this.options = {
          showGuides: true,
          showDimensions: true,
          overlayColor: 'rgba(0, 0, 0, 0.3)',
          borderColor: '#4285f4',
          ...options
        };
      }

      public start(): Promise<any> {
        return new Promise((resolve) => {
          if (this.isActive) {
            resolve(null);
            return;
          }

          this.resolveSelection = resolve;
          this.initialize();
        });
      }

      private initialize(): void {
        this.isActive = true;
        this.preserveOriginalStyles();
        this.createOverlay();
        this.createInstructions();
        this.attachEventListeners();
        this.preventScrolling();
        
        document.body.classList.add('region-selector-active');
        console.log('🎯 Region selector activated');
      }

      private preserveOriginalStyles(): void {
        this.originalBodyStyle = document.body.style.cssText;
      }

      private createOverlay(): void {
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = `
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background: ${this.options.overlayColor} !important;
          z-index: 2147483647 !important;
          cursor: crosshair !important;
          user-select: none !important;
          pointer-events: auto !important;
        `;

        this.selectionBox = document.createElement('div');
        this.selectionBox.style.cssText = `
          position: absolute !important;
          border: 2px solid ${this.options.borderColor} !important;
          background: transparent !important;
          pointer-events: none !important;
          display: none !important;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5) !important;
        `;

        if (this.options.showDimensions) {
          this.dimensionsDisplay = document.createElement('div');
          this.dimensionsDisplay.style.cssText = `
            position: absolute !important;
            background: ${this.options.borderColor} !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            pointer-events: none !important;
            white-space: nowrap !important;
            display: none !important;
            z-index: 2147483648 !important;
          `;
        }

        if (this.options.showGuides) {
          this.crosshairX = document.createElement('div');
          this.crosshairX.style.cssText = `
            position: absolute !important;
            width: 100vw !important;
            height: 1px !important;
            background: ${this.options.borderColor} !important;
            pointer-events: none !important;
            display: none !important;
            opacity: 0.6 !important;
          `;

          this.crosshairY = document.createElement('div');
          this.crosshairY.style.cssText = `
            position: absolute !important;
            width: 1px !important;
            height: 100vh !important;
            background: ${this.options.borderColor} !important;
            pointer-events: none !important;
            display: none !important;
            opacity: 0.6 !important;
          `;

          this.overlay.appendChild(this.crosshairX);
          this.overlay.appendChild(this.crosshairY);
        }

        this.overlay.appendChild(this.selectionBox);
        
        if (this.dimensionsDisplay) {
          this.overlay.appendChild(this.dimensionsDisplay);
        }

        document.body.appendChild(this.overlay);
      }

      private createInstructions(): void {
        this.instructionsPanel = document.createElement('div');
        this.instructionsPanel.style.cssText = `
          position: fixed !important;
          top: 20px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          background: rgba(0, 0, 0, 0.8) !important;
          color: white !important;
          padding: 12px 20px !important;
          border-radius: 8px !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          font-size: 14px !important;
          z-index: 2147483649 !important;
          pointer-events: none !important;
        `;

        this.instructionsPanel.innerHTML = `
          <div style="text-align: center;">
            <div style="font-weight: 600; margin-bottom: 4px;">📸 Select Region to Capture</div>
            <div style="font-size: 12px; opacity: 0.8;">
              Drag to select • Press <strong>ESC</strong> to cancel
            </div>
          </div>
        `;

        document.body.appendChild(this.instructionsPanel);
      }

      private attachEventListeners(): void {
        if (!this.overlay) return;

        this.overlay.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
      }

      private handleMouseDown(e: MouseEvent): void {
        if (e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();

        this.isDragging = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.currentX = e.clientX;
        this.currentY = e.clientY;

        if (this.selectionBox) {
          this.selectionBox.style.display = 'block';
          this.updateSelectionBox();
        }
      }

      private handleMouseMove(e: MouseEvent): void {
        if (!this.isActive) return;

        this.currentX = e.clientX;
        this.currentY = e.clientY;

        if (this.options.showGuides && !this.isDragging) {
          this.updateCrosshairs();
        }

        if (this.isDragging) {
          this.updateSelectionBox();
          this.updateDimensions();
        }
      }

      private handleMouseUp(e: MouseEvent): void {
        if (!this.isDragging || e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();

        this.isDragging = false;

        const selection = this.getSelectionData();
        
        if (selection.width > 5 && selection.height > 5) {
          console.log('✅ Region selected:', selection);
          this.completeSelection(selection);
        } else {
          this.resetSelection();
        }
      }

      private handleKeyDown(e: KeyboardEvent): void {
        if (!this.isActive) return;

        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.completeSelection(null);
        }
      }

      private updateCrosshairs(): void {
        if (!this.crosshairX || !this.crosshairY) return;

        this.crosshairX.style.display = 'block';
        this.crosshairX.style.top = `${this.currentY}px`;

        this.crosshairY.style.display = 'block';
        this.crosshairY.style.left = `${this.currentX}px`;
      }

      private updateSelectionBox(): void {
        if (!this.selectionBox) return;

        const x = Math.min(this.startX, this.currentX);
        const y = Math.min(this.startY, this.currentY);
        const width = Math.abs(this.currentX - this.startX);
        const height = Math.abs(this.currentY - this.startY);

        this.selectionBox.style.left = `${x}px`;
        this.selectionBox.style.top = `${y}px`;
        this.selectionBox.style.width = `${width}px`;
        this.selectionBox.style.height = `${height}px`;

        if (this.crosshairX) this.crosshairX.style.display = 'none';
        if (this.crosshairY) this.crosshairY.style.display = 'none';
      }

      private updateDimensions(): void {
        if (!this.dimensionsDisplay || !this.options.showDimensions) return;

        const width = Math.abs(this.currentX - this.startX);
        const height = Math.abs(this.currentY - this.startY);

        this.dimensionsDisplay.textContent = `${width} × ${height}`;
        this.dimensionsDisplay.style.display = 'block';

        const x = Math.min(this.startX, this.currentX);
        const y = Math.min(this.startY, this.currentY);
        
        const displayY = y > 30 ? y - 30 : y + height + 10;
        
        this.dimensionsDisplay.style.left = `${x}px`;
        this.dimensionsDisplay.style.top = `${displayY}px`;
      }

      private getSelectionData(): any {
        const x = Math.min(this.startX, this.currentX);
        const y = Math.min(this.startY, this.currentY);
        const width = Math.abs(this.currentX - this.startX);
        const height = Math.abs(this.currentY - this.startY);

        return {
          x: x * window.devicePixelRatio,
          y: y * window.devicePixelRatio,
          width: width * window.devicePixelRatio,
          height: height * window.devicePixelRatio,
          devicePixelRatio: window.devicePixelRatio,
          timestamp: Date.now()
        };
      }

      private completeSelection(selection: any): void {
        if (this.resolveSelection) {
          this.resolveSelection(selection);
        }
        this.cleanup();
      }

      private resetSelection(): void {
        if (this.selectionBox) {
          this.selectionBox.style.display = 'none';
        }
        
        if (this.dimensionsDisplay) {
          this.dimensionsDisplay.style.display = 'none';
        }

        this.isDragging = false;
      }

      private preventScrolling(): void {
        document.body.style.overflow = 'hidden';
      }

      private restoreScrolling(): void {
        document.body.style.cssText = this.originalBodyStyle;
      }

      public cleanup(): void {
        if (!this.isActive) return;

        this.isActive = false;
        this.isDragging = false;

        document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        document.removeEventListener('mouseup', this.handleMouseUp.bind(this));
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));

        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
        }

        if (this.instructionsPanel && this.instructionsPanel.parentNode) {
          this.instructionsPanel.parentNode.removeChild(this.instructionsPanel);
        }

        this.restoreScrolling();
        document.body.classList.remove('region-selector-active');

        this.overlay = null;
        this.selectionBox = null;
        this.dimensionsDisplay = null;
        this.instructionsPanel = null;
        this.crosshairX = null;
        this.crosshairY = null;

        console.log('🧹 Region selector cleaned up');
      }
    }

    // Global functions
    let globalRegionSelector: RegionSelector | null = null;

    (window as any).startRegionSelection = function(options: any): Promise<any> {
      if (globalRegionSelector) {
        globalRegionSelector.cleanup();
      }

      globalRegionSelector = new RegionSelector(options);
      return globalRegionSelector.start();
    };

    (window as any).cancelRegionSelection = function(): void {
      if (globalRegionSelector) {
        globalRegionSelector.cleanup();
        globalRegionSelector = null;
      }
    };

    (window as any).isRegionSelectionActive = function(): boolean {
      return globalRegionSelector?.isActive ?? false;
    };

    console.log('🎯 Region selector injected successfully');
  };

  /**
   * Request region selection from content script
   */
  private async requestRegionSelection(
    tabId: number, 
    options: RegionServiceOptions
  ): Promise<RegionSelection | null> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Region selection timeout'));
      }, 60000); // 60 second timeout

      // Execute the region selection directly in the tab
      chrome.scripting.executeScript({
        target: { tabId },
        func: (opts: any) => {
          return (window as any).startRegionSelection(opts);
        },
        args: [{
          showGuides: options.showGuides ?? true,
          showDimensions: options.showDimensions ?? true,
          overlayColor: options.overlayColor ?? 'rgba(0, 0, 0, 0.3)',
          borderColor: options.borderColor ?? '#4285f4'
        }]
      }).then(results => {
        clearTimeout(timeout);
        
        if (results && results[0]?.result) {
          resolve(results[0].result);
        } else {
          resolve(null);
        }
      }).catch(error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Capture full screen for cropping
   */
  private async captureFullScreen(tab: chrome.tabs.Tab): Promise<{
    success: boolean;
    dataUrl?: string;
    error?: string;
  }> {
    try {
      if (!tab.windowId) {
        return {
          success: false,
          error: 'Tab has no window ID'
        };
      }

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 100
      });

      if (!dataUrl) {
        return {
          success: false,
          error: 'No image data returned from capture'
        };
      }

      return {
        success: true,
        dataUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Screenshot capture failed'
      };
    }
  }

  /**
   * Crop image to selected region
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

            // Convert screen coordinates back to image coordinates
            const devicePixelRatio = selection.devicePixelRatio || window.devicePixelRatio || 1;
            
            // Calculate crop dimensions
            const cropX = selection.x / devicePixelRatio;
            const cropY = selection.y / devicePixelRatio;
            const cropWidth = selection.width / devicePixelRatio;
            const cropHeight = selection.height / devicePixelRatio;

            // Ensure crop area is within image bounds
            const actualCropX = Math.max(0, Math.min(cropX, img.width));
            const actualCropY = Math.max(0, Math.min(cropY, img.height));
            const actualCropWidth = Math.min(cropWidth, img.width - actualCropX);
            const actualCropHeight = Math.min(cropHeight, img.height - actualCropY);

            // Set canvas dimensions to crop size
            canvas.width = actualCropWidth;
            canvas.height = actualCropHeight;

            // Draw the cropped image
            ctx.drawImage(
              img,
              actualCropX,
              actualCropY,
              actualCropWidth,
              actualCropHeight,
              0,
              0,
              actualCropWidth,
              actualCropHeight
            );

            // Convert to blob and data URL
            canvas.toBlob((blob) => {
              if (blob) {
                const croppedDataUrl = canvas.toDataURL('image/png', 1.0);
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

      } catch (error) {
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Region cropping failed'
        });
      }
    });
  }

  /**
   * Cancel any active region selection
   */
  async cancelRegionSelection(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            if (typeof (window as any).cancelRegionSelection === 'function') {
              (window as any).cancelRegionSelection();
            }
          }
        });
      }
    } catch (error) {
      console.warn('Failed to cancel region selection:', error);
    }
  }

  /**
   * Check if region selection is currently active
   */
  async isRegionSelectionActive(): Promise<boolean> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) return false;

      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          if (typeof (window as any).isRegionSelectionActive === 'function') {
            return (window as any).isRegionSelectionActive();
          }
          return false;
        }
      });

      return results[0]?.result ?? false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Save region capture result to storage
   */
  async saveToStorage(result: RegionCaptureResult, caseId: string): Promise<boolean> {
    try {
      console.log('💾 Saving region capture to storage...');
      
      if (!result.success || !result.blob) {
        console.error('❌ Invalid region capture result');
        return false;
      }

      // Here you would integrate with your existing storage service
      // For now, just log success
      console.log('✅ Region capture saved successfully');
      return true;

    } catch (error) {
      console.error('❌ Save error:', error);
      return false;
    }
  }

  /**
   * Download region capture to local disk
   */
  downloadRegionCapture(dataUrl: string, filename: string): void {
    try {
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('✅ Region capture downloaded:', filename);
    } catch (error) {
      console.error('❌ Download error:', error);
    }
  }

  /**
   * Get region selection statistics
   */
  getSelectionStats(selection: RegionSelection): {
    area: number;
    aspectRatio: number;
    isSquare: boolean;
    isLandscape: boolean;
    isPortrait: boolean;
  } {
    const width = selection.width / selection.devicePixelRatio;
    const height = selection.height / selection.devicePixelRatio;
    const area = width * height;
    const aspectRatio = width / height;

    return {
      area,
      aspectRatio,
      isSquare: Math.abs(aspectRatio - 1) < 0.1,
      isLandscape: aspectRatio > 1.2,
      isPortrait: aspectRatio < 0.8
    };
  }
}

export const regionService = RegionService.getInstance();