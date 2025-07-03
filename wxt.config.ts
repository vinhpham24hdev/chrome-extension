// wxt.config.ts - Final Safe Version (No unsafe-inline)
import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Cellebrite Screen Capture Tool",
    description: "Chrome extension for capturing screenshots and videos",
    version: "1.0.0",

    permissions: [
      "activeTab",
      "storage",
      "tabs",
      "scripting",
      "tabCapture",
      "desktopCapture",
      "system.display",
    ],
    commands: {
      "region-capture": {
        suggested_key: {
          default: "Ctrl+Shift+R",
          mac: "Command+Shift+R",
        },
        description: "Chụp vùng màn hình",
      },
    },
    host_permissions: ["<all_urls>"],

    action: {
      default_title: "Cellebrite Capture Tool",
    },

    // SAFE CSP - Remove unsafe-inline
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },

    web_accessible_resources: [
      {
        resources: [
          "entrypoints/region-overlay.js",
          "content-scripts/region-overlay.js",
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
      },
    ],
  },
});
