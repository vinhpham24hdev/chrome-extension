export default defineUnlistedScript(() => {
  import('../components/CaseReportApp')
    .then(({ initializeCaseReportApp }) => {
      initializeCaseReportApp();
    })
    .catch((error) => {
      console.error('Failed to load app:', error);

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
