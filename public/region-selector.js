// region-selector.js - macOS style region selector in fullscreen window
(function() {
  'use strict';

  // State
  let isSelecting = false;
  let startPoint = null;
  let currentRegion = null;
  let screenshotLoaded = false;
  let instructionsVisible = true; // Renamed to avoid conflict with function

  // DOM elements
  const elements = {
    loading: document.getElementById('loading'),
    container: document.getElementById('container'),
    screenshot: document.getElementById('screenshot'),
    crosshairV: document.getElementById('crosshair-v'),
    crosshairH: document.getElementById('crosshair-h'),
    selectionBox: document.getElementById('selection-box'),
    sizeDisplay: document.getElementById('size-display'),
    instructions: document.getElementById('instructions'),
    coordinates: document.getElementById('coordinates'),
    confirmBtn: document.getElementById('confirm-btn'),
    error: document.getElementById('error'),
    errorMessage: document.getElementById('error-message')
  };

  // Initialize
  function init() {
    console.log('🎯 Region selector window initializing...');
    
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

    // Window events
    window.addEventListener('beforeunload', () => {
      // Notify extension that window is closing
      chrome.runtime.sendMessage({
        type: 'REGION_CANCELLED'
      }).catch(() => {
        // Ignore errors if extension context is gone
      });
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
  function loadScreenshot(dataUrl) {
    console.log('🖼️ Loading screenshot...');
    
    elements.screenshot.onload = () => {
      console.log('✅ Screenshot loaded successfully');
      elements.loading.style.display = 'none';
      elements.container.style.display = 'block';
      screenshotLoaded = true;
    };

    elements.screenshot.onerror = () => {
      console.error('❌ Failed to load screenshot');
      showError('Failed to load screenshot');
    };

    elements.screenshot.src = dataUrl;
  }

  // Mouse move handler
  function handleMouseMove(e) {
    const x = e.clientX;
    const y = e.clientY;

    // Update coordinates display
    elements.coordinates.textContent = `${x}, ${y}`;

    // Update crosshair position (only when not selecting)
    if (!isSelecting) {
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
  function handleMouseDown(e) {
    if (!screenshotLoaded) return;
    
    e.preventDefault();
    
    startPoint = { x: e.clientX, y: e.clientY };
    isSelecting = true;

    // Hide crosshair during selection
    elements.crosshairV.style.display = 'none';
    elements.crosshairH.style.display = 'none';

    // Hide instructions
    hideInstructions();

    console.log('🎯 Starting region selection at:', startPoint);
  }

  // Mouse up handler
  function handleMouseUp(e) {
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
  function handleKeyDown(e) {
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
    if (!currentRegion) return;

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

    if (!currentRegion) return;

    const { x, y, width, height } = currentRegion;

    // Create mask elements
    const masks = [
      // Top
      { top: 0, left: 0, width: '100%', height: `${y}px` },
      // Bottom  
      { top: `${y + height}px`, left: 0, width: '100%', height: `calc(100% - ${y + height}px)` },
      // Left
      { top: `${y}px`, left: 0, width: `${x}px`, height: `${height}px` },
      // Right
      { top: `${y}px`, left: `${x + width}px`, width: `calc(100% - ${x + width}px)`, height: `${height}px` }
    ];

    masks.forEach(maskStyle => {
      if (parseInt(maskStyle.width) > 0 && parseInt(maskStyle.height) > 0) {
        const mask = document.createElement('div');
        mask.className = 'mask';
        Object.assign(mask.style, maskStyle);
        mask.style.position = 'absolute';
        elements.container.appendChild(mask);
      }
    });
  }

  // Update confirm button state
  function updateConfirmButton(enabled) {
    elements.confirmBtn.disabled = !enabled;
    elements.confirmBtn.textContent = enabled ? 'Capture Region' : 'Select an area';
  }

  // Reset selection
  function resetSelection() {
    console.log('🔄 Resetting selection');
    
    currentRegion = null;
    startPoint = null;
    isSelecting = false;

    elements.selectionBox.style.display = 'none';
    
    // Remove masks
    document.querySelectorAll('.mask').forEach(mask => mask.remove());
    
    // Reset confirm button
    updateConfirmButton(false);
    
    // Show instructions again
    showInstructions();
  }

  // Show/hide instructions
  function showInstructions() {
    elements.instructions.style.display = 'block';
    elements.instructions.style.opacity = '1';
    showInstructions = true;
  }

  function hideInstructions() {
    elements.instructions.style.opacity = '0';
    setTimeout(() => {
      elements.instructions.style.display = 'none';
    }, 300);
    showInstructions = false;
  }

  function toggleInstructions() {
    if (showInstructions) {
      hideInstructions();
    } else {
      showInstructions();
    }
  }

  // Show error
  function showError(message) {
    console.error('❌ Region selector error:', message);
    elements.errorMessage.textContent = message;
    elements.error.style.display = 'block';
    elements.loading.style.display = 'none';
    elements.container.style.display = 'none';
  }

  // Confirm selection
  window.confirmSelection = function() {
    if (!currentRegion || currentRegion.width < 10 || currentRegion.height < 10) {
      console.warn('⚠️ Selection too small');
      return;
    }

    console.log('✅ Confirming region selection:', currentRegion);

    // Send result back to extension
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
  };

  // Cancel selection
  window.cancelSelection = function() {
    console.log('❌ Cancelling region selection');
    
    chrome.runtime.sendMessage({
      type: 'REGION_CANCELLED'
    }).finally(() => {
      window.close();
    });
  };

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('🚀 Region selector script loaded');
})();