// entrypoints/video-preview.ts - Video preview entry point
export default defineUnlistedScript(() => {
  // This script will be built as video-preview.js and loaded by the HTML page
  
  import('../components/VideoPreviewApp').then(({ initializeVideoPreviewApp }) => {
    initializeVideoPreviewApp();
  }).catch(error => {
    console.error('Failed to load video preview app:', error);
    
    // Show error message
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.innerHTML = `
        <div style="color: #ef4444; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
          <div style="font-size: 1.125rem; margin-bottom: 0.5rem;">Failed to load preview</div>
          <div style="font-size: 0.875rem; opacity: 0.7;">Please close this window and try again</div>
        </div>
      `;
    }
  });
});