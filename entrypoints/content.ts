// entrypoints/content.ts - Simplified content script
export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('📄 Content script loaded for region selector support');

    // No need for complex message handling since we're using direct script injection
    // The region selector will be injected dynamically when needed

    console.log('✅ Content script ready');
  },
});