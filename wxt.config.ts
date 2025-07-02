// wxt.config.ts - Updated CSP for region selector
import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Cellebrite Screen Capture Tool",
    description:
      "Chrome extension for capturing screenshots and videos for case documentation with Cellebrite integration",
    version: "1.0.0",
    permissions: [
      "activeTab",
      "storage",
      "tabs",
      "scripting",
      "tabCapture",
      "desktopCapture",
      "system.display", // Add for getting display info
    ],
    host_permissions: ["<all_urls>"],
    action: {
      default_title: "Cellebrite Capture Tool",
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    // Add web accessible resources for region selector
    web_accessible_resources: [
      {
        resources: [
          "region-selector.html",
          "region-selector.js",
          "screenshot-preview.html", 
          "screenshot-preview.js",
          "video-preview.html",
          "video-preview.js",
          "video-recorder.html",
          "video-recorder.js"
        ],
        matches: ["<all_urls>"]
      }
    ]
  },

  webExt: {
    disabled: false,
  },

  // Development settings
  dev: {
    server: {
      port: 3000,
    },
  },
});