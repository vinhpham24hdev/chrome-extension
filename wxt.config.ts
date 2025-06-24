// wxt.config.ts
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
    // Content Security Policy for login page
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  },

  // WXT will auto-discover entrypoints in entrypoints/ directory
  // No need to manually define them

  webExt: {
    disabled: false,
  },

  // Development settings (fixed)
  dev: {
    server: {
      port: 3000,
    },
  },
});
