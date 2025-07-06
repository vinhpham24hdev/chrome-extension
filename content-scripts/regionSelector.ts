// content-scripts/regionSelector.ts - Advanced Region Selector
export interface RegionSelection {
  x: number;
  y: number;
  width: number;
  height: number;
  devicePixelRatio: number;
  timestamp: number;
}

export interface RegionSelectorOptions {
  onRegionSelected?: (selection: RegionSelection) => void;
  onCancelled?: () => void;
  showGuides?: boolean;
  showDimensions?: boolean;
  overlayColor?: string;
  borderColor?: string;
  handleSize?: number;
}

class RegionSelector {
  private isActive = false;
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

  private options: RegionSelectorOptions;
  private originalBodyStyle: string = "";
  private originalDocumentStyle: string = "";

  constructor(options: RegionSelectorOptions = {}) {
    this.options = {
      showGuides: true,
      showDimensions: true,
      overlayColor: "rgba(0, 0, 0, 0.3)",
      borderColor: "#4285f4",
      handleSize: 8,
      ...options,
    };
  }

  public start(): Promise<RegionSelection | null> {
    return new Promise((resolve, reject) => {
      if (this.isActive) {
        reject(new Error("Region selector is already active"));
        return;
      }

      this.options.onRegionSelected = (selection) => {
        resolve(selection);
        this.cleanup();
      };

      this.options.onCancelled = () => {
        resolve(null);
        this.cleanup();
      };

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

    // Add body class for styling
    document.body.classList.add("region-selector-active");

    console.log("🎯 Region selector activated");
  }

  private preserveOriginalStyles(): void {
    this.originalBodyStyle = document.body.style.cssText;
    this.originalDocumentStyle = document.documentElement.style.cssText;
  }

  private createOverlay(): void {
    // Main overlay that covers the entire viewport
    this.overlay = document.createElement("div");
    this.overlay.id = "region-selector-overlay";
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
      -webkit-user-select: none !important;
      pointer-events: auto !important;
    `;

    // Selection box
    this.selectionBox = document.createElement("div");
    this.selectionBox.id = "region-selector-box";
    this.selectionBox.style.cssText = `
      position: absolute !important;
      border: 2px solid ${this.options.borderColor} !important;
      background: transparent !important;
      pointer-events: none !important;
      display: none !important;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5) !important;
    `;

    // Dimensions display
    if (this.options.showDimensions) {
      this.dimensionsDisplay = document.createElement("div");
      this.dimensionsDisplay.id = "region-selector-dimensions";
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
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
      `;
    }

    // Crosshair guides
    if (this.options.showGuides) {
      this.crosshairX = document.createElement("div");
      this.crosshairX.style.cssText = `
        position: absolute !important;
        width: 100vw !important;
        height: 1px !important;
        background: ${this.options.borderColor} !important;
        pointer-events: none !important;
        display: none !important;
        opacity: 0.6 !important;
        z-index: 2147483646 !important;
      `;

      this.crosshairY = document.createElement("div");
      this.crosshairY.style.cssText = `
        position: absolute !important;
        width: 1px !important;
        height: 100vh !important;
        background: ${this.options.borderColor} !important;
        pointer-events: none !important;
        display: none !important;
        opacity: 0.6 !important;
        z-index: 2147483646 !important;
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
    this.instructionsPanel = document.createElement("div");
    this.instructionsPanel.id = "region-selector-instructions";
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
      backdrop-filter: blur(8px) !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
      animation: fadeInDown 0.3s ease-out !important;
    `;

    this.instructionsPanel.innerHTML = `
      <div style="text-align: center;">
        <div style="font-weight: 600; margin-bottom: 4px;">📸 Select Region to Capture</div>
        <div style="font-size: 12px; opacity: 0.8;">
          Drag to select • Press <strong>ESC</strong> to cancel
        </div>
      </div>
    `;

    // Add CSS animation
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeInDown {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(this.instructionsPanel);
  }

  private attachEventListeners(): void {
    if (!this.overlay) return;

    // Mouse events
    this.overlay.addEventListener("mousedown", this.handleMouseDown.bind(this));
    document.addEventListener("mousemove", this.handleMouseMove.bind(this));
    document.addEventListener("mouseup", this.handleMouseUp.bind(this));

    // Keyboard events
    document.addEventListener("keydown", this.handleKeyDown.bind(this));

    // Prevent context menu
    this.overlay.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return; // Only left click

    e.preventDefault();
    e.stopPropagation();

    this.isDragging = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.currentX = e.clientX;
    this.currentY = e.clientY;

    if (this.selectionBox) {
      this.selectionBox.style.display = "block";
      this.updateSelectionBox();
    }

    // Hide instructions
    if (this.instructionsPanel) {
      this.instructionsPanel.style.opacity = "0.3";
    }

    console.log("🎯 Selection started:", { x: this.startX, y: this.startY });
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isActive) return;

    this.currentX = e.clientX;
    this.currentY = e.clientY;

    // Update crosshairs
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

    // Only proceed if selection has meaningful size
    if (selection.width > 5 && selection.height > 5) {
      console.log("✅ Region selected:", selection);

      // Visual feedback before completion
      this.showCompletionFeedback(() => {
        if (this.options.onRegionSelected) {
          this.options.onRegionSelected(selection);
        }
      });
    } else {
      // Selection too small, reset
      this.resetSelection();
      if (this.instructionsPanel) {
        this.instructionsPanel.style.opacity = "1";
        this.instructionsPanel.innerHTML = `
          <div style="text-align: center;">
            <div style="font-weight: 600; margin-bottom: 4px;">⚠️ Selection too small</div>
            <div style="font-size: 12px; opacity: 0.8;">
              Drag to select a larger area • Press <strong>ESC</strong> to cancel
            </div>
          </div>
        `;
      }
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isActive) return;

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      console.log("❌ Region selection cancelled");

      if (this.options.onCancelled) {
        this.options.onCancelled();
      }
    }
  }

  private updateCrosshairs(): void {
    if (!this.crosshairX || !this.crosshairY) return;

    this.crosshairX.style.display = "block";
    this.crosshairX.style.top = `${this.currentY}px`;

    this.crosshairY.style.display = "block";
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

    // Hide crosshairs when dragging
    if (this.crosshairX) this.crosshairX.style.display = "none";
    if (this.crosshairY) this.crosshairY.style.display = "none";
  }

  private updateDimensions(): void {
    if (!this.dimensionsDisplay || !this.options.showDimensions) return;

    const width = Math.abs(this.currentX - this.startX);
    const height = Math.abs(this.currentY - this.startY);

    this.dimensionsDisplay.textContent = `${width} × ${height}`;
    this.dimensionsDisplay.style.display = "block";

    // Position dimensions display
    const x = Math.min(this.startX, this.currentX);
    const y = Math.min(this.startY, this.currentY);

    // Position above the selection box, or below if near top
    const displayY = y > 30 ? y - 30 : y + height + 10;

    this.dimensionsDisplay.style.left = `${x}px`;
    this.dimensionsDisplay.style.top = `${displayY}px`;
  }

  private getSelectionData(): RegionSelection {
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
      timestamp: Date.now(),
    };
  }

  private showCompletionFeedback(callback: () => void): void {
    if (!this.selectionBox) {
      callback();
      return;
    }

    // Add success animation
    this.selectionBox.style.transition = "all 0.2s ease-out";
    this.selectionBox.style.background = "rgba(66, 133, 244, 0.2)";
    this.selectionBox.style.transform = "scale(1.02)";

    // Show checkmark
    const checkmark = document.createElement("div");
    checkmark.style.cssText = `
      position: absolute !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      width: 40px !important;
      height: 40px !important;
      background: ${this.options.borderColor} !important;
      border-radius: 50% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: white !important;
      font-size: 20px !important;
      animation: checkmarkPop 0.3s ease-out !important;
    `;
    checkmark.textContent = "✓";

    // Add animation CSS
    const style = document.createElement("style");
    style.textContent = `
      @keyframes checkmarkPop {
        0% { transform: translate(-50%, -50%) scale(0); }
        70% { transform: translate(-50%, -50%) scale(1.1); }
        100% { transform: translate(-50%, -50%) scale(1); }
      }
    `;
    document.head.appendChild(style);

    this.selectionBox.appendChild(checkmark);

    setTimeout(() => {
      callback();
    }, 500);
  }

  private resetSelection(): void {
    if (this.selectionBox) {
      this.selectionBox.style.display = "none";
    }

    if (this.dimensionsDisplay) {
      this.dimensionsDisplay.style.display = "none";
    }

    this.isDragging = false;
  }

  private preventScrolling(): void {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }

  private restoreScrolling(): void {
    document.body.style.cssText = this.originalBodyStyle;
    document.documentElement.style.cssText = this.originalDocumentStyle;
  }

  public cleanup(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.isDragging = false;

    // Remove event listeners
    document.removeEventListener("mousemove", this.handleMouseMove.bind(this));
    document.removeEventListener("mouseup", this.handleMouseUp.bind(this));
    document.removeEventListener("keydown", this.handleKeyDown.bind(this));

    // Remove DOM elements
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }

    if (this.instructionsPanel && this.instructionsPanel.parentNode) {
      this.instructionsPanel.parentNode.removeChild(this.instructionsPanel);
    }

    // Restore styles
    this.restoreScrolling();
    document.body.classList.remove("region-selector-active");

    // Clean up references
    this.overlay = null;
    this.selectionBox = null;
    this.dimensionsDisplay = null;
    this.instructionsPanel = null;
    this.crosshairX = null;
    this.crosshairY = null;

    console.log("🧹 Region selector cleaned up");
  }

  public isSelecting(): boolean {
    return this.isActive;
  }
}

// Export for use in other modules
export { RegionSelector };

// Global region selector instance
let globalRegionSelector: RegionSelector | null = null;

// Public API functions
export function startRegionSelection(
  options?: RegionSelectorOptions
): Promise<RegionSelection | null> {
  // Cleanup any existing selector
  if (globalRegionSelector) {
    globalRegionSelector.cleanup();
  }

  globalRegionSelector = new RegionSelector(options);
  return globalRegionSelector.start();
}

export function cancelRegionSelection(): void {
  if (globalRegionSelector) {
    globalRegionSelector.cleanup();
    globalRegionSelector = null;
  }
}

export function isRegionSelectionActive(): boolean {
  return globalRegionSelector?.isSelecting() ?? false;
}

// Auto-cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (globalRegionSelector) {
    globalRegionSelector.cleanup();
  }
});

// Message listener for chrome extension communication
if (typeof chrome !== "undefined" && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "START_REGION_SELECTION") {
      startRegionSelection(message.options)
        .then((selection) => {
          sendResponse({ success: true, selection });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep message channel open
    }

    if (message.type === "CANCEL_REGION_SELECTION") {
      cancelRegionSelection();
      sendResponse({ success: true });
    }

    if (message.type === "IS_REGION_SELECTION_ACTIVE") {
      sendResponse({ active: isRegionSelectionActive() });
    }
  });
}

console.log("🎯 Region Selector module loaded");
