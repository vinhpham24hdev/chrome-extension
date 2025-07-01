// wxt.config.ts - Revert CSP to secure settings
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
    ],
    host_permissions: ["<all_urls>"],
    action: {
      default_title: "Cellebrite Capture Tool",
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
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