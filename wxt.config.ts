// wxt.config.ts
import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Cellebrite Screen Capture Tool",
    description: "Chrome extension for capturing screenshots and videos",
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
    },

    action: { default_title: "Cellebrite Capture Tool" },

    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    web_accessible_resources: [
      {
        resources: [
          "content-scripts/content.js",
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
  },
});
