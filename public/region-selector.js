// region-selector.js - Loom-style region selector
class RegionSelector {
  constructor() {
    this.isSelecting = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.selectionMade = false;
    this.backgroundImage = null;
    this.caseId = null;
    this.isResizing = false;
    this.resizeHandle = null;
    this.originalBounds = {};

    this.initializeElements();
    this.setupEventListeners();
    this.loadBackgroundImage();
  }

  initializeElements() {
    this.elements = {
      loading: document.getElementById('loading'),
      overlay: document.getElementById('region-overlay'),
      selectionBox: document.getElementById('selection-box'),
      instructions: document.getElementById('instructions'),
      dimensions: document.getElementById('dimensions'),
      controls: document.getElementById('controls'),
      captureBtn: document.getElementById('capture-btn'),
      cancelBtn: document.getElementById('cancel-btn'),
      backgroundImg: document.getElementById('background-image'),
      masks: {
        top: document.getElementById('mask-top'),
        bottom: document.getElementById('mask-bottom'),
        left: document.getElementById('mask-left'),
        right: document.getElementById('mask-right')
      }
    };

    this.resizeHandles = document.querySelectorAll('.resize-handle');
  }

  setupEventListeners() {
    // Main overlay events
    this.elements.overlay.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.elements.overlay.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.elements.overlay.addEventListener('mouseup', this.onMouseUp.bind(this));

    // Resize handle events
    this.resizeHandles.forEach(handle => {
      handle.addEventListener('mousedown', this.onResizeStart.bind(this));
    });

    // Button events
    this.elements.captureBtn.addEventListener('click', this.captureSelection.bind(this));
    this.elements.cancelBtn.addEventListener('click', this.cancelSelection.bind(this));

    // Keyboard events
    document.addEventListener('keydown', this.onKeyDown.bind(this));

    // Prevent context menu
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  async loadBackgroundImage() {
    try {
      console.log('📸 Capturing background screenshot...');

      // Get case ID from URL
      const params = new URLSearchParams(window.location.search);
      this.caseId = params.get('caseId') || 'default-case';

      // Capture the current tab
      const result = await this.captureCurrentTab();
      
      if (result.success && result.dataUrl) {
        this.backgroundImage = result.dataUrl;
        this.elements.backgroundImg.src = result.dataUrl;
        
        // Wait for image to load
        this.elements.backgroundImg.onload = () => {
          this.hideLoading();
          this.showRegionSelector();
        };
      } else {
        throw new Error(result.error || 'Failed to capture screenshot');
      }

    } catch (error) {
      console.error('❌ Failed to load background:', error);
      this.showError('Failed to capture screen. Please try again.');
    }
  }

  async captureCurrentTab() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].windowId) {
            chrome.tabs.captureVisibleTab(tabs[0].windowId, {
              format: 'png',
              quality: 100
            }, (dataUrl) => {
              if (chrome.runtime.lastError) {
                resolve({
                  success: false,
                  error: chrome.runtime.lastError.message
                });
              } else {
                resolve({
                  success: true,
                  dataUrl: dataUrl
                });
              }
            });
          } else {
            resolve({
              success: false,
              error: 'No active tab found'
            });
          }
        });
      } else {
        resolve({
          success: false,
          error: 'Chrome tabs API not available'
        });
      }
    });
  }

  hideLoading() {
    this.elements.loading.style.display = 'none';
  }

  showRegionSelector() {
    this.elements.overlay.style.display = 'block';
    this.elements.instructions.style.display = 'block';
    this.elements.controls.style.display = 'flex';
  }

  showError(message) {
    this.elements.loading.innerHTML = `
      <div style="text-align: center; color: #ef4444;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <div style="font-size: 1.125rem; margin-bottom: 0.5rem;">Error</div>
        <div style="font-size: 0.875rem; margin-bottom: 1rem;">${message}</div>
        <button onclick="window.close()" style="
          background: #ef4444;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        ">Close</button>
      </div>
    `;
  }

  onMouseDown(e) {
    if (this.isResizing) return;

    // Clear any existing selection
    this.clearSelection();

    this.isSelecting = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.currentX = e.clientX;
    this.currentY = e.clientY;

    this.elements.selectionBox.style.display = 'block';
    this.updateSelection();
    
    e.preventDefault();
  }

  onMouseMove(e) {
    if (this.isResizing) {
      this.onResizeMove(e);
      return;
    }

    if (!this.isSelecting) return;

    this.currentX = e.clientX;
    this.currentY = e.clientY;

    this.updateSelection();
    this.updateDimensions();
  }

  onMouseUp(e) {
    if (this.isResizing) {
      this.onResizeEnd(e);
      return;
    }

    if (!this.isSelecting) return;

    this.isSelecting = false;
    
    const width = Math.abs(this.currentX - this.startX);
    const height = Math.abs(this.currentY - this.startY);

    // Minimum selection size
    if (width > 10 && height > 10) {
      this.selectionMade = true;
      this.elements.captureBtn.disabled = false;
      this.showResizeHandles();
      this.elements.instructions.textContent = 'Selection made! Click "Capture" or press Enter';
    } else {
      this.clearSelection();
    }
  }

  onResizeStart(e) {
    if (!this.selectionMade) return;

    this.isResizing = true;
    this.resizeHandle = e.target.className.split(' ').find(c => c !== 'resize-handle');
    
    // Store original bounds
    const rect = this.elements.selectionBox.getBoundingClientRect();
    this.originalBounds = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };

    document.body.style.cursor = e.target.style.cursor;
    e.stopPropagation();
    e.preventDefault();
  }

  onResizeMove(e) {
    if (!this.isResizing || !this.resizeHandle) return;

    const deltaX = e.clientX - (this.originalBounds.left + this.originalBounds.width / 2);
    const deltaY = e.clientY - (this.originalBounds.top + this.originalBounds.height / 2);

    let newBounds = { ...this.originalBounds };

    // Calculate new bounds based on resize handle
    switch (this.resizeHandle) {
      case 'nw':
        newBounds.left = Math.min(e.clientX, this.originalBounds.right - 10);
        newBounds.top = Math.min(e.clientY, this.originalBounds.bottom - 10);
        break;
      case 'ne':
        newBounds.right = Math.max(e.clientX, this.originalBounds.left + 10);
        newBounds.top = Math.min(e.clientY, this.originalBounds.bottom - 10);
        break;
      case 'sw':
        newBounds.left = Math.min(e.clientX, this.originalBounds.right - 10);
        newBounds.bottom = Math.max(e.clientY, this.originalBounds.top + 10);
        break;
      case 'se':
        newBounds.right = Math.max(e.clientX, this.originalBounds.left + 10);
        newBounds.bottom = Math.max(e.clientY, this.originalBounds.top + 10);
        break;
      case 'n':
        newBounds.top = Math.min(e.clientY, this.originalBounds.bottom - 10);
        break;
      case 's':
        newBounds.bottom = Math.max(e.clientY, this.originalBounds.top + 10);
        break;
      case 'w':
        newBounds.left = Math.min(e.clientX, this.originalBounds.right - 10);
        break;
      case 'e':
        newBounds.right = Math.max(e.clientX, this.originalBounds.left + 10);
        break;
    }

    // Apply bounds to selection
    this.applyBounds(newBounds);
    this.updateMasks();
    this.updateDimensions();

    e.preventDefault();
  }

  onResizeEnd(e) {
    this.isResizing = false;
    this.resizeHandle = null;
    document.body.style.cursor = 'crosshair';
    
    // Update internal coordinates
    const rect = this.elements.selectionBox.getBoundingClientRect();
    this.startX = rect.left;
    this.startY = rect.top;
    this.currentX = rect.right;
    this.currentY = rect.bottom;

    e.preventDefault();
  }

  applyBounds(bounds) {
    // Ensure bounds are within window
    bounds.left = Math.max(0, bounds.left);
    bounds.top = Math.max(0, bounds.top);
    bounds.right = Math.min(window.innerWidth, bounds.right);
    bounds.bottom = Math.min(window.innerHeight, bounds.bottom);

    const width = bounds.right - bounds.left;
    const height = bounds.bottom - bounds.top;

    this.elements.selectionBox.style.left = bounds.left + 'px';
    this.elements.selectionBox.style.top = bounds.top + 'px';
    this.elements.selectionBox.style.width = width + 'px';
    this.elements.selectionBox.style.height = height + 'px';
  }

  updateSelection() {
    const left = Math.min(this.startX, this.currentX);
    const top = Math.min(this.startY, this.currentY);
    const width = Math.abs(this.currentX - this.startX);
    const height = Math.abs(this.currentY - this.startY);

    this.elements.selectionBox.style.left = left + 'px';
    this.elements.selectionBox.style.top = top + 'px';
    this.elements.selectionBox.style.width = width + 'px';
    this.elements.selectionBox.style.height = height + 'px';

    this.updateMasks();
  }

  updateMasks() {
    const box = this.elements.selectionBox.getBoundingClientRect();

    // Top mask
    this.elements.masks.top.style.display = 'block';
    this.elements.masks.top.style.left = '0';
    this.elements.masks.top.style.top = '0';
    this.elements.masks.top.style.width = '100vw';
    this.elements.masks.top.style.height = box.top + 'px';

    // Bottom mask
    this.elements.masks.bottom.style.display = 'block';
    this.elements.masks.bottom.style.left = '0';
    this.elements.masks.bottom.style.top = box.bottom + 'px';
    this.elements.masks.bottom.style.width = '100vw';
    this.elements.masks.bottom.style.height = (window.innerHeight - box.bottom) + 'px';

    // Left mask
    this.elements.masks.left.style.display = 'block';
    this.elements.masks.left.style.left = '0';
    this.elements.masks.left.style.top = box.top + 'px';
    this.elements.masks.left.style.width = box.left + 'px';
    this.elements.masks.left.style.height = (box.bottom - box.top) + 'px';

    // Right mask
    this.elements.masks.right.style.display = 'block';
    this.elements.masks.right.style.left = box.right + 'px';
    this.elements.masks.right.style.top = box.top + 'px';
    this.elements.masks.right.style.width = (window.innerWidth - box.right) + 'px';
    this.elements.masks.right.style.height = (box.bottom - box.top) + 'px';
  }

  updateDimensions() {
    if (!this.isSelecting && !this.isResizing) return;

    const box = this.elements.selectionBox.getBoundingClientRect();
    const width = Math.round(box.width);
    const height = Math.round(box.height);

    this.elements.dimensions.textContent = `${width} × ${height}`;
    this.elements.dimensions.style.display = 'block';
    this.elements.dimensions.style.left = (box.right + 10) + 'px';
    this.elements.dimensions.style.top = (box.top - 25) + 'px';

    // Keep dimensions in view
    if (box.right + 100 > window.innerWidth) {
      this.elements.dimensions.style.left = (box.left - 80) + 'px';
    }
    if (box.top < 30) {
      this.elements.dimensions.style.top = (box.bottom + 10) + 'px';
    }
  }

  showResizeHandles() {
    this.resizeHandles.forEach(handle => {
      handle.style.display = 'block';
    });
  }

  hideResizeHandles() {
    this.resizeHandles.forEach(handle => {
      handle.style.display = 'none';
    });
  }

  clearSelection() {
    this.elements.selectionBox.style.display = 'none';
    this.elements.dimensions.style.display = 'none';
    this.hideResizeHandles();

    // Hide masks
    Object.values(this.elements.masks).forEach(mask => {
      mask.style.display = 'none';
    });

    this.selectionMade = false;
    this.elements.captureBtn.disabled = true;
    this.elements.instructions.textContent = 'Click and drag to select an area, then click "Capture" or press Enter';
  }

  async captureSelection() {
    if (!this.selectionMade || !this.backgroundImage) return;

    try {
      // Add capture flash effect
      document.body.classList.add('capture-flash');

      const box = this.elements.selectionBox.getBoundingClientRect();
      
      // Calculate region coordinates relative to the background image
      const region = {
        x: Math.round(box.left),
        y: Math.round(box.top),
        width: Math.round(box.width),
        height: Math.round(box.height)
      };

      console.log('📸 Capturing region:', region);

      // Crop the background image
      const croppedDataUrl = await this.cropImage(this.backgroundImage, region);

      if (croppedDataUrl) {
        // Send result back to popup
        const result = {
          success: true,
          dataUrl: croppedDataUrl,
          filename: `region_${region.width}x${region.height}_${Date.now()}.png`,
          region: region,
          caseId: this.caseId
        };

        this.sendResultToPopup(result);
        
        // Close window after short delay
        setTimeout(() => {
          window.close();
        }, 500);
      } else {
        throw new Error('Failed to crop image');
      }

    } catch (error) {
      console.error('❌ Capture failed:', error);
      alert('Failed to capture region. Please try again.');
    } finally {
      document.body.classList.remove('capture-flash');
    }
  }

  async cropImage(dataUrl, region) {
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve(null);
            return;
          }

          canvas.width = region.width;
          canvas.height = region.height;

          // Draw the cropped region
          ctx.drawImage(
            img,
            region.x, region.y, region.width, region.height,
            0, 0, region.width, region.height
          );

          resolve(canvas.toDataURL('image/png'));
        } catch (error) {
          console.error('Crop error:', error);
          resolve(null);
        }
      };

      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  sendResultToPopup(result) {
    // Send message to background script which will forward to popup
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'REGION_DONE',
        ...result
      }).catch(error => {
        console.warn('Failed to send result to popup:', error);
      });
    }
  }

  cancelSelection() {
    window.close();
  }

  onKeyDown(e) {
    switch (e.key) {
      case 'Escape':
        this.cancelSelection();
        break;
      case 'Enter':
        if (this.selectionMade) {
          this.captureSelection();
        }
        break;
      case 'Backspace':
      case 'Delete':
        this.clearSelection();
        break;
    }
  }

  onWindowResize() {
    if (this.selectionMade) {
      this.updateMasks();
      this.updateDimensions();
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new RegionSelector();
  });
} else {
  new RegionSelector();
}