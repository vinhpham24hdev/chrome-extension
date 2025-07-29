// wxt.config.ts - UPDATED to handle conditional popup behavior
import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Cellebrite Screen Capture Tool",
    description: "Chrome extension for capturing screenshots and videos with region selection and full page capture",
    version: "1.0.0",

    oauth2: {
      "client_id": "your-client-id",
      "scopes": ["openid", "profile", "email"]
    },

    permissions: [
      "activeTab",
      "tabs",
      "scripting",
      "storage",
      "tabCapture",
      "desktopCapture",
      "system.display",
      "identity"
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
      // 🔥 NEW: Stop recording hotkey
      "stop-recording": {
        suggested_key: { default: "Ctrl+Shift+Q", mac: "Command+Shift+Q" },
        description: "Stop video recording",
      },
    },

    // 🔥 UPDATED: Remove default_popup to handle conditionally via background script
    action: { 
      default_title: "Cellebrite Capture Tool"
      // Note: No default_popup - will be handled programmatically in background script
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
          "case-report.html",
          "case-report.js",
          "assets/*",
        ],
        matches: ["<all_urls>"],
        // @ts-expect-error
        use_dynamic_url: true,
      },
    ],

    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["content-scripts/content.js"],
        run_at: "document_idle",
        all_frames: false,
      },
    ],
  },

  // Build configuration to handle MUI warnings
  vite: () => ({
    // Suppress "use client" directive warnings
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          // Skip "use client" directive warnings from MUI
          if (
            warning.code === 'MODULE_LEVEL_DIRECTIVE' && 
            warning.message.includes('"use client"')
          ) {
            return;
          }
          
          // Skip sourcemap resolution errors for MUI
          if (
            warning.code === 'SOURCEMAP_ERROR' &&
            warning.message.includes('@mui/material')
          ) {
            return;
          }
          
          // Show other warnings
          warn(warning);
        },
        
        external: (id) => {
          // Don't externalize anything - we want everything bundled
          return false;
        }
      },
      
      // Optimize chunk splitting for better performance
      chunkSizeWarningLimit: 1000,
      
      // Source map configuration
      sourcemap: false, // Disable sourcemaps in production to avoid MUI sourcemap issues
    },
    
    // Define configuration for Node.js environment variables
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    },
    
    // Optimize dependencies
    optimizeDeps: {
      include: [
        '@mui/material',
        '@emotion/react',
        '@emotion/styled',
        'react',
        'react-dom'
      ],
      exclude: [
        // Exclude problematic packages if any
      ]
    },
    
    // ESBuild configuration
    esbuild: {
      // Drop console.log in production
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
      
      // Handle JSX properly
      jsx: 'automatic',
      
      // Suppress "use client" directive warnings
      logOverride: {
        'this-is-undefined-in-esm': 'silent',
        'commonjs-variable-in-esm': 'silent'
      }
    }
  }),

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