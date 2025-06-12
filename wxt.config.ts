// wxt.config.ts
import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Screen Capture Tool",
    description:
      "Chrome extension for capturing screenshots and videos for case documentation",
    version: "1.0.0",
    permissions: ["activeTab", "storage", "tabs", "scripting"],
    host_permissions: ["<all_urls>"],
    action: {
      default_title: "Screen Capture Tool",
    },
  },

  runner: {
    disabled: false,
  },
});
