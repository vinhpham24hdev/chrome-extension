// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Screen Capture Tool',
    description: 'Chrome extension for capturing screenshots and videos for case documentation',
    version: '1.0.0',
    permissions: [
      'activeTab',
      'storage',
      'tabs',
      'scripting',
      'desktopCapture',
      '<all_urls>' 
    ],
    host_permissions: [
      '*://*/*',
      'http://*/*',
      'https://*/*'
    ],
    action: {
      default_title: 'Screen Capture Tool'
    }
  },
  
  runner: {
    disabled: false
  }
});