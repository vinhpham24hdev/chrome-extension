// wxt.config.ts - Updated configuration for WXT with Region Selector
import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Cellebrite Screen Capture Tool",
    description: "Chrome extension for capturing screenshots and videos with region selection and full page capture",
    version: "1.0.0",

    permissions: [
      "activeTab",
      "tabs",
      "scripting",
      "storage",
      "tabCapture",
      "desktopCapture",
      "system.display",
    ],
    host_permissions: ["<all_urls>"],

    commands: {
      "region-capture": {
        suggested_key: { default: "Ctrl+Shift+R", mac: "Command+Shift+R" },
        description: "Start region capture",
      },
      "screen-capture": {
        suggested_key: { default: "Ctrl+Shift+S", mac: "Command+Shift+S" },
        description: "Take screenshot",
      },
      "full-page-capture": {
        suggested_key: { default: "Ctrl+Shift+F", mac: "Command+Shift+F" },
        description: "Take full page screenshot",
      },
    },

    action: { 
      default_title: "Cellebrite Capture Tool",
      default_popup: "popup.html"
    },

    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    
    web_accessible_resources: [
      {
        resources: [
          "content-scripts/regionSelector.js",
          "region-selector.html",
          "region-selector.js",
          "screenshot-preview.html",
          "screenshot-preview.js",
          "video-preview.html",
          "video-preview.js",
          "video-recorder.html",
          "video-recorder.js",
          "video-recorder-init.js",
          "assets/*",
        ],
        matches: ["<all_urls>"],
        // @ts-expect-error
        use_dynamic_url: true,
      },
    ],

    // Content scripts for region selector
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["content-scripts/content.js"],
        run_at: "document_idle",
        all_frames: false,
      },
    ],
  },

  // Additional build configuration
  runner: {
    disabled: false,
  },

  // Development server configuration
  dev: {
    server: {
      port: 3000,
    },
  },

  // Build optimization
  build: {
    target: "chrome110",
  },
});