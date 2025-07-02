// entrypoints/region-selector.ts - WXT entry point for region selector
export default defineUnlistedScript(() => {
  // Region selector logic for fullscreen overlay window
  
  // State
  let isSelecting = false;
  let startPoint: { x: number; y: number } | null = null;
  let currentRegion: { x: number; y: number; width: number; height: number } | null = null;
  let screenshotLoaded = false;
  let instructionsVisible = true;

  // DOM elements
  interface Elements {
    loading: HTMLElement | null;
    container: HTMLElement | null;
    screenshot: HTMLImageElement | null;
    crosshairV: HTMLElement | null;
    crosshairH: HTMLElement | null;
    selectionBox: HTMLElement | null;
    sizeDisplay: HTMLElement | null;
    instructions: HTMLElement | null;
    coordinates: HTMLElement | null;
    confirmBtn: HTMLButtonElement | null;
    cancelBtn: HTMLButtonElement | null;
    error: HTMLElement | null;
    errorMessage: HTMLElement | null;
    errorCloseBtn: HTMLButtonElement | null;
  }

  let elements: Elements = {
    loading: null,
    container: null,
    screenshot: null,
    crosshairV: null,
    crosshairH: null,
    selectionBox: null,
    sizeDisplay: null,
    instructions: null,
    coordinates: null,
    confirmBtn: null,
    cancelBtn: null,
    error: null,
    errorMessage: null,
    errorCloseBtn: null
  };

  // Initialize when DOM is ready
  function init() {
    console.log('🎯 Region selector window initializing...');
    
    // Get DOM elements
    elements = {
      loading: document.getElementById('loading'),
      container: document.getElementById('container'),
      screenshot: document.getElementById('screenshot') as HTMLImageElement,
      crosshairV: document.getElementById('crosshair-v'),
      crosshairH: document.getElementById('crosshair-h'),
      selectionBox: document.getElementById('selection-box'),
      sizeDisplay: document.getElementById('size-display'),
      instructions: document.getElementById('instructions'),
      coordinates: document.getElementById('coordinates'),
      confirmBtn: document.getElementById('confirm-btn') as HTMLButtonElement,
      cancelBtn: document.getElementById('cancel-btn') as HTMLButtonElement,
      error: document.getElementById('error'),
      errorMessage: document.getElementById('error-message'),
      errorCloseBtn: document.getElementById('error-close-btn') as HTMLButtonElement
    };
    
    setupEventListeners();
    requestScreenshotData();
    
    // Hide instructions after 4 seconds
    setTimeout(() => {
      hideInstructions();
    }, 4000);
  }

  // Setup event listeners
  function setupEventListeners() {
    // Mouse events
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    // Keyboard events
    document.addEventListener('keydown', handleKeyDown);

    // Button events
    if (elements.confirmBtn) {
      elements.confirmBtn.addEventListener('click', confirmSelection);
    }
    
    if (elements.cancelBtn) {
      elements.cancelBtn.addEventListener('click', cancelSelection);
    }
    
    if (elements.errorCloseBtn) {
      elements.errorCloseBtn.addEventListener('click', cancelSelection);
    }

    // Window events
    window.addEventListener('beforeunload', () => {
      // Notify extension that window is closing
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'REGION_CANCELLED'
        }).catch(() => {
          // Ignore errors if extension context is gone
        });
      }
    });

    // Prevent context menu
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  // Request screenshot data from extension
  function requestScreenshotData() {
    console.log('📡 Requesting screenshot data...');
    
    // Enhanced debugging
    if (typeof chrome === 'undefined') {
      console.error('❌ Chrome API not available');
      showError('Chrome extension API not available');
      return;
    }
    
    if (!chrome.runtime) {
      console.error('❌ Chrome runtime not available');
      showError('Chrome runtime not available');
      return;
    }
    
    console.log('✅ Chrome APIs available, setting up communication...');
    
    // Listen for screenshot data FIRST
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 Received message:', message);
      
      if (message.type === 'REGION_SELECTOR_DATA') {
        console.log('📸 Received screenshot data');
        loadScreenshot(message.data.screenshot);
        sendResponse({ success: true });
        return true; // Keep message channel open
      }
      
      sendResponse({ success: false, error: 'Unknown message type' });
      return true;
    });
    
    // Then notify extension that window is ready
    console.log('📤 Notifying extension window is ready...');
    chrome.runtime.sendMessage({
      type: 'REGION_WINDOW_READY'
    }).then(response => {
      console.log('✅ Extension notified successfully:', response);
    }).catch(error => {
      console.error('❌ Failed to notify extension:', error);
      showError(`Failed to communicate with extension: ${error.message}`);
    });

    // Timeout with more detailed error
    setTimeout(() => {
      if (!screenshotLoaded) {
        console.error('⏰ Timeout - no screenshot data received');
        showError('Timeout waiting for screenshot data.\n\nPossible issues:\n• Extension popup closed\n• Permission denied\n• Tab capture failed');
      }
    }, 5000);
  }

  // Load screenshot into overlay
  function loadScreenshot(dataUrl: string) {
    console.log('🖼️ Loading screenshot...');
    
    if (!elements.screenshot || !elements.loading || !elements.container) return;

    elements.screenshot.onload = () => {
      console.log('✅ Screenshot loaded successfully');
      if (elements.loading) elements.loading.style.display = 'none';
      if (elements.container) elements.container.style.display = 'block';
      screenshotLoaded = true;
    };

    elements.screenshot.onerror = () => {
      console.error('❌ Failed to load screenshot');
      showError('Failed to load screenshot');
    };

    elements.screenshot.src = dataUrl;
  }

  // Mouse move handler
  function handleMouseMove(e: MouseEvent) {
    const x = e.clientX;
    const y = e.clientY;

    // Update coordinates display
    if (elements.coordinates) {
      elements.coordinates.textContent = `${x}, ${y}`;
    }

    // Update crosshair position (only when not selecting)
    if (!isSelecting && elements.crosshairV && elements.crosshairH) {
      elements.crosshairV.style.left = `${x}px`;
      elements.crosshairV.style.display = 'block';
      elements.crosshairH.style.top = `${y}px`;
      elements.crosshairH.style.display = 'block';
    }

    // Handle selection dragging
    if (isSelecting && startPoint) {
      const width = Math.abs(x - startPoint.x);
      const height = Math.abs(y - startPoint.y);
      const left = Math.min(startPoint.x, x);
      const top = Math.min(startPoint.y, y);

      currentRegion = { x: left, y: top, width, height };
      updateSelectionBox();
    }
  }

  // Mouse down handler
  function handleMouseDown(e: MouseEvent) {
    if (!screenshotLoaded) return;
    
    e.preventDefault();
    
    startPoint = { x: e.clientX, y: e.clientY };
    isSelecting = true;

    // Hide crosshair during selection
    if (elements.crosshairV) elements.crosshairV.style.display = 'none';
    if (elements.crosshairH) elements.crosshairH.style.display = 'none';

    // Hide instructions
    hideInstructions();

    console.log('🎯 Starting region selection at:', startPoint);
  }

  // Mouse up handler
  function handleMouseUp(e: MouseEvent) {
    if (!isSelecting || !currentRegion) return;

    isSelecting = false;
    console.log('✅ Region selected:', currentRegion);

    // Auto-confirm if selection is large enough
    if (currentRegion.width > 20 && currentRegion.height > 20) {
      updateConfirmButton(true);
      // Small delay then auto-confirm
      setTimeout(() => {
        confirmSelection();
      }, 300);
    } else {
      // Selection too small
      resetSelection();
    }
  }

  // Keyboard handler
  function handleKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        if (currentRegion) {
          resetSelection();
        } else {
          cancelSelection();
        }
        break;
        
      case 'Enter':
        e.preventDefault();
        if (currentRegion && currentRegion.width > 10 && currentRegion.height > 10) {
          confirmSelection();
        }
        break;
        
      case ' ':
        e.preventDefault();
        toggleInstructions();
        break;
    }
  }

  // Update selection box
  function updateSelectionBox() {
    if (!currentRegion || !elements.selectionBox || !elements.sizeDisplay) return;

    const box = elements.selectionBox;
    box.style.left = `${currentRegion.x}px`;
    box.style.top = `${currentRegion.y}px`;
    box.style.width = `${currentRegion.width}px`;
    box.style.height = `${currentRegion.height}px`;
    box.style.display = 'block';

    // Update size display
    elements.sizeDisplay.textContent = 
      `${Math.round(currentRegion.width)} × ${Math.round(currentRegion.height)}`;

    // Update overlay mask
    updateOverlayMask();

    // Update confirm button
    const isValidSize = currentRegion.width > 10 && currentRegion.height > 10;
    updateConfirmButton(isValidSize);
  }

  // Update overlay mask (darken unselected areas)
  function updateOverlayMask() {
    // Remove existing masks
    document.querySelectorAll('.mask').forEach(mask => mask.remove());

    if (!currentRegion || !elements.container) return;

    const { x, y, width, height } = currentRegion;

    // Create mask elements
    const masks = [
      // Top
      { top: '0', left: '0', width: '100%', height: `${y}px` },
      // Bottom  
      { top: `${y + height}px`, left: '0', width: '100%', height: `calc(100% - ${y + height}px)` },
      // Left
      { top: `${y}px`, left: '0', width: `${x}px`, height: `${height}px` },
      // Right
      { top: `${y}px`, left: `${x + width}px`, width: `calc(100% - ${x + width}px)`, height: `${height}px` }
    ];

    masks.forEach(maskStyle => {
      const widthValue = maskStyle.width.includes('calc') ? 1 : parseInt(maskStyle.width);
      const heightValue = maskStyle.height.includes('calc') ? 1 : parseInt(maskStyle.height);
      
      if (widthValue > 0 && heightValue > 0) {
        const mask = document.createElement('div');
        mask.className = 'mask';
        mask.style.position = 'absolute';
        mask.style.top = maskStyle.top;
        mask.style.left = maskStyle.left;
        mask.style.width = maskStyle.width;
        mask.style.height = maskStyle.height;
        mask.style.background = 'rgba(0, 0, 0, 0.6)';
        mask.style.pointerEvents = 'none';
        mask.style.zIndex = '5';
        if (elements.container) {
            elements.container.appendChild(mask);
        }
      }
    });
  }

  // Update confirm button state
  function updateConfirmButton(enabled: boolean) {
    if (!elements.confirmBtn) return;
    
    elements.confirmBtn.disabled = !enabled;
    elements.confirmBtn.textContent = enabled ? 'Capture Region' : 'Select an area';
  }

  // Reset selection
  function resetSelection() {
    console.log('🔄 Resetting selection');
    
    currentRegion = null;
    startPoint = null;
    isSelecting = false;

    if (elements.selectionBox) {
      elements.selectionBox.style.display = 'none';
    }
    
    // Remove masks
    document.querySelectorAll('.mask').forEach(mask => mask.remove());
    
    // Reset confirm button
    updateConfirmButton(false);
    
    // Show instructions again
    showInstructions();
  }

  // Show/hide instructions
  function showInstructions() {
    if (!elements.instructions) return;
    
    elements.instructions.style.display = 'block';
    elements.instructions.style.opacity = '1';
    instructionsVisible = true;
  }

  function hideInstructions() {
    if (!elements.instructions) return;
    
    elements.instructions.style.opacity = '0';
    setTimeout(() => {
      if (elements.instructions) {
        elements.instructions.style.display = 'none';
      }
    }, 300);
    instructionsVisible = false;
  }

  function toggleInstructions() {
    if (instructionsVisible) {
      hideInstructions();
    } else {
      showInstructions();
    }
  }

  // Show error
  function showError(message: string) {
    console.error('❌ Region selector error:', message);
    
    if (elements.errorMessage) {
      elements.errorMessage.textContent = message;
    }
    if (elements.error) {
      elements.error.style.display = 'block';
    }
    if (elements.loading) {
      elements.loading.style.display = 'none';
    }
    if (elements.container) {
      elements.container.style.display = 'none';
    }
  }

  // Confirm selection
  function confirmSelection() {
    if (!currentRegion || currentRegion.width < 10 || currentRegion.height < 10) {
      console.warn('⚠️ Selection too small');
      return;
    }

    console.log('✅ Confirming region selection:', currentRegion);

    // Send result back to extension
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'REGION_SELECTED',
        data: currentRegion
      }).then(() => {
        console.log('📤 Region data sent to extension');
        window.close();
      }).catch(error => {
        console.error('❌ Failed to send region data:', error);
        showError('Failed to send selection data');
      });
    } else {
      showError('Chrome extension API not available');
    }
  }

  // Cancel selection
  function cancelSelection() {
    console.log('❌ Cancelling region selection');
    
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'REGION_CANCELLED'
      }).finally(() => {
        window.close();
      });
    } else {
      window.close();
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('🚀 Region selector script loaded');
});