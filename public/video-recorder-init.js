// public/video-recorder-init.js - Separate initialization script
(function() {
  'use strict';
  
  console.log('🎬 Video recorder page loaded');
  
  // Page load performance tracking
  const startTime = performance.now();
  
  // Update page title dynamically
  const updateTitle = (status = 'Ready') => {
    document.title = `🎬 Video Recorder - ${status} - Cellebrite`;
  };
  
  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      updateTitle('Active');
    } else {
      updateTitle('Background');
    }
  });
  
  // Check extension context
  window.addEventListener('load', () => {
    const loadTime = performance.now() - startTime;
    console.log(`⚡ Page loaded in ${Math.round(loadTime)}ms`);
    
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      console.log('✅ Chrome extension context available');
      updateTitle('Ready');
    } else {
      console.error('❌ Chrome extension context not available');
      updateTitle('Error');
    }
  });
  
  // Handle keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape to close
    if (e.key === 'Escape') {
      if (confirm('Are you sure you want to close the video recorder?')) {
        window.close();
      }
    }
    
    // Ctrl/Cmd + W to close
    if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
      e.preventDefault();
      if (confirm('Close video recorder?')) {
        window.close();
      }
    }
  });
  
  // Prevent accidental navigation
  window.addEventListener('beforeunload', (e) => {
    // Only show warning if recording might be in progress
    if (document.querySelector('.recording-indicator')) {
      e.preventDefault();
      e.returnValue = 'Recording in progress. Are you sure you want to leave?';
      return e.returnValue;
    }
  });
  
  // Add performance monitoring
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'navigation') {
        console.log(`📊 Navigation: ${Math.round(entry.duration)}ms`);
      }
    }
  });
  
  try {
    observer.observe({ entryTypes: ['navigation'] });
  } catch (e) {
    // Performance API might not be available
    console.log('📊 Performance monitoring not available');
  }
})();