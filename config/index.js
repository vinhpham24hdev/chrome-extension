// src/config/index.js - Frontend Configuration Helper
// ===================================================

/**
 * Environment configuration helper for frontend
 * Provides type-safe access to environment variables
 */

class Config {
  constructor() {
    this.env = import.meta.env.VITE_NODE_ENV || 'development';
    this.isDev = this.env === 'development';
    this.isProd = this.env === 'production';
    this.isStaging = this.env === 'staging';
  }

  // API Configuration
  get api() {
    return {
      baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
      timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000,
      uploadTimeout: parseInt(import.meta.env.VITE_UPLOAD_TIMEOUT) || 600000,
    };
  }

  // Authentication
  get auth() {
    return {
      storageKey: import.meta.env.VITE_JWT_STORAGE_KEY || 'screen_capture_auth_token',
      expiresCheck: import.meta.env.VITE_JWT_EXPIRES_CHECK === 'true',
    };
  }

  // File Upload Settings
  get upload() {
    return {
      maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE) || 104857600, // 100MB
      allowedImageTypes: (import.meta.env.VITE_ALLOWED_IMAGE_TYPES || 'image/png,image/jpeg,image/webp,image/gif').split(','),
      allowedVideoTypes: (import.meta.env.VITE_ALLOWED_VIDEO_TYPES || 'video/webm,video/mp4,video/quicktime').split(','),
      chunkSize: parseInt(import.meta.env.VITE_UPLOAD_CHUNK_SIZE) || 5242880, // 5MB
    };
  }

  // Development Settings
  get dev() {
    return {
      debugMode: import.meta.env.VITE_DEBUG_MODE === 'true',
      enableLogs: import.meta.env.VITE_ENABLE_CONSOLE_LOGS === 'true',
      mockApiDelay: parseInt(import.meta.env.VITE_MOCK_API_DELAY) || 0,
      enableMockMode: import.meta.env.VITE_ENABLE_MOCK_MODE === 'true',
      mockUserData: import.meta.env.VITE_MOCK_USER_DATA === 'true',
    };
  }

  // Storage & Cache
  get storage() {
    return {
      enableCache: import.meta.env.VITE_ENABLE_LOCAL_CACHE === 'true',
      cacheDuration: parseInt(import.meta.env.VITE_CACHE_DURATION) || 3600000,
      offlineLimit: parseInt(import.meta.env.VITE_OFFLINE_STORAGE_LIMIT) || 50,
    };
  }

  // Error Tracking
  get errorTracking() {
    return {
      sentryDsn: import.meta.env.VITE_SENTRY_DSN,
      enabled: import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true',
    };
  }

  // Helper methods
  isValidFileType(file) {
    const allAllowedTypes = [...this.upload.allowedImageTypes, ...this.upload.allowedVideoTypes];
    return allAllowedTypes.includes(file.type);
  }

  isValidFileSize(file) {
    return file.size <= this.upload.maxFileSize;
  }

  validateFile(file) {
    const errors = [];
    
    if (!this.isValidFileType(file)) {
      errors.push(`File type ${file.type} is not allowed`);
    }
    
    if (!this.isValidFileSize(file)) {
      const maxSizeMB = (this.upload.maxFileSize / (1024 * 1024)).toFixed(0);
      errors.push(`File size exceeds ${maxSizeMB}MB limit`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  getApiUrl(endpoint) {
    return `${this.api.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  }

  log(...args) {
    if (this.dev.enableLogs) {
      console.log('[Config]', ...args);
    }
  }

  debug(...args) {
    if (this.dev.debugMode) {
      console.debug('[Debug]', ...args);
    }
  }

  // Format file size
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Check if feature is enabled
  isFeatureEnabled(feature) {
    return this.features[feature] === true;
  }

  // Get environment-specific settings
  getEnvironmentConfig() {
    return {
      environment: this.env,
      isDevelopment: this.isDev,
      isProduction: this.isProd,
      isStaging: this.isStaging,
      apiBaseUrl: this.api.baseUrl,
      debugMode: this.dev.debugMode,
      version: this.extension.version,
    };
  }
}

// Create singleton instance
const config = new Config();

// Export for use in app
export default config;
