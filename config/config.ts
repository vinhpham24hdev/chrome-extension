// config/config.ts - Real Configuration Service (Updated)
export interface AppConfig {
  apiBaseUrl: string;
  enableMockMode: boolean;
  awsRegion: string;
  awsS3BucketName: string;
  debugMode: boolean;
  extensionMode: string;
  environment: string;
  maxFileSize: number;
  allowedFileTypes: string[];
  uploadTimeout: number;
}

export interface ApiEndpoints {
  auth: {
    login: string;
    logout: string;
    me: string;
    refresh: string;
  };
  cases: {
    list: string;
    create: string;
    get: (id: string) => string;
    update: (id: string) => string;
    delete: (id: string) => string;
    stats: string;
    tags: string;
    export: string;
    bulkUpdate: string;
    metadata: (id: string) => string;
  };
  upload: {
    presignedUrl: string;
    confirm: string;
    delete: string;
    bulkDelete: string;
    caseFiles: (caseId: string) => string;
    download: (fileKey: string) => string;
    fileDetails: (fileKey: string) => string;
    stats: string;
    costs: string;
    checkExists: (fileKey: string) => string;
  };
  health: {
    basic: string;
    detailed: string;
  };
}

class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig | null = null;
  private endpoints: ApiEndpoints | null = null;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private initialize(): void {
    // Load configuration from environment variables
    this.config = {
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
      enableMockMode: import.meta.env.VITE_ENABLE_MOCK_MODE === 'true',
      awsRegion: import.meta.env.VITE_AWS_REGION || 'us-east-1',
      awsS3BucketName: import.meta.env.VITE_AWS_S3_BUCKET_NAME || 'screen-capture-tool-dev',
      debugMode: import.meta.env.VITE_DEBUG_MODE === 'true',
      extensionMode: import.meta.env.VITE_EXTENSION_MODE || 'development',
      environment: import.meta.env.VITE_NODE_ENV || 'development',
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedFileTypes: [
        'image/png',
        'image/jpeg', 
        'image/webp',
        'image/gif',
        'video/webm',
        'video/mp4',
        'video/quicktime'
      ],
      uploadTimeout: 600000, // 10 minutes
    };

    // Initialize API endpoints
    this.endpoints = {
      auth: {
        login: '/auth/login',
        logout: '/auth/logout',
        me: '/auth/me',
        refresh: '/auth/refresh',
      },
      cases: {
        list: '/cases',
        create: '/cases',
        get: (id: string) => `/cases/${id}`,
        update: (id: string) => `/cases/${id}`,
        delete: (id: string) => `/cases/${id}`,
        stats: '/cases/stats',
        tags: '/cases/tags',
        export: '/cases/export',
        bulkUpdate: '/cases/bulk-update',
        metadata: (id: string) => `/cases/${id}/metadata`,
      },
      upload: {
        presignedUrl: '/upload/presigned-url',
        confirm: '/upload/confirm',
        delete: '/upload/file',
        bulkDelete: '/upload/files/bulk',
        caseFiles: (caseId: string) => `/upload/cases/${caseId}/files`,
        download: (fileKey: string) => `/upload/download/${encodeURIComponent(fileKey)}`,
        fileDetails: (fileKey: string) => `/upload/file/${encodeURIComponent(fileKey)}`,
        stats: '/upload/stats',
        costs: '/upload/costs',
        checkExists: (fileKey: string) => `/upload/file/${encodeURIComponent(fileKey)}`,
      },
      health: {
        basic: '/health',
        detailed: '/health/detailed',
      },
    };

    console.log('🔧 Configuration initialized:', {
      environment: this.config.environment,
      apiBaseUrl: this.config.apiBaseUrl,
      mockMode: this.config.enableMockMode,
      debugMode: this.config.debugMode,
    });
  }

  public getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }
    return { ...this.config };
  }

  public getEndpoints(): ApiEndpoints {
    if (!this.endpoints) {
      throw new Error('Endpoints not initialized');
    }
    return this.endpoints;
  }

  public getApiUrl(endpoint: string): string {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }
    return `${this.config.apiBaseUrl}${endpoint}`;
  }

  public isProduction(): boolean {
    return this.config?.environment === 'production';
  }

  public isDevelopment(): boolean {
    return this.config?.environment === 'development';
  }

  public isMockMode(): boolean {
    return this.config?.enableMockMode || false;
  }

  public isDebugMode(): boolean {
    return this.config?.debugMode || false;
  }

  public getMaxFileSize(): number {
    return this.config?.maxFileSize || 100 * 1024 * 1024;
  }

  public getAllowedFileTypes(): string[] {
    return this.config?.allowedFileTypes || [];
  }

  public getUploadTimeout(): number {
    return this.config?.uploadTimeout || 600000;
  }

  public validateFileType(fileType: string): boolean {
    return this.getAllowedFileTypes().includes(fileType);
  }

  public validateFileSize(fileSize: number): boolean {
    return fileSize <= this.getMaxFileSize();
  }

  public getFileValidationError(file: File): string | null {
    if (!this.validateFileType(file.type)) {
      return `File type ${file.type} is not allowed. Allowed types: ${this.getAllowedFileTypes().join(', ')}`;
    }

    if (!this.validateFileSize(file.size)) {
      const maxSizeMB = this.getMaxFileSize() / (1024 * 1024);
      return `File size ${(file.size / (1024 * 1024)).toFixed(2)}MB exceeds limit of ${maxSizeMB}MB`;
    }

    return null;
  }

  // Dynamic configuration updates
  public updateConfig(updates: Partial<AppConfig>): void {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }

    this.config = {
      ...this.config,
      ...updates,
    };

    console.log('🔧 Configuration updated:', updates);
  }

  // Environment-specific settings
  public getEnvironmentConfig(): Record<string, any> {
    const config = this.getConfig();
    
    return {
      // Common settings
      apiBaseUrl: config.apiBaseUrl,
      maxFileSize: config.maxFileSize,
      allowedFileTypes: config.allowedFileTypes,
      
      // Environment-specific
      ...(config.environment === 'development' && {
        debugMode: true,
        mockMode: config.enableMockMode,
        hotReload: true,
        verboseLogging: true,
      }),
      
      ...(config.environment === 'production' && {
        debugMode: false,
        mockMode: false,
        hotReload: false,
        verboseLogging: false,
        minifyAssets: true,
        enableCaching: true,
      }),
    };
  }

  // Logging configuration
  public shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    if (!this.config) return false;

    if (level === 'debug') {
      return this.config.debugMode;
    }

    return true; // Always log info, warn, error
  }

  // Feature flags
  public isFeatureEnabled(feature: string): boolean {
    const config = this.getConfig();
    
    switch (feature) {
      case 'realBackend':
        return !config.enableMockMode;
      case 'mockMode':
        return config.enableMockMode;
      case 'debugMode':
        return config.debugMode;
      case 'hotReload':
        return config.environment === 'development';
      case 'analytics':
        return config.environment === 'production';
      default:
        return false;
    }
  }

  // Storage configuration
  public getStorageConfig(): {
    useChrome: boolean;
    useLocalStorage: boolean;
    keyPrefix: string;
  } {
    return {
      useChrome: typeof chrome !== 'undefined' && !!chrome.storage,
      useLocalStorage: true,
      keyPrefix: this.config?.environment === 'production' ? 'sct_prod_' : 'sct_dev_',
    };
  }

  // Network configuration
  public getNetworkConfig(): {
    timeout: number;
    retries: number;
    retryDelay: number;
  } {
    const config = this.getConfig();
    
    return {
      timeout: config.environment === 'development' ? 30000 : 15000, // 30s dev, 15s prod
      retries: 3,
      retryDelay: 1000, // 1 second
    };
  }

  // Extension-specific configuration
  public getExtensionConfig(): {
    manifestVersion: number;
    permissions: string[];
    contentScripts: boolean;
    background: boolean;
  } {
    return {
      manifestVersion: 3,
      permissions: [
        'activeTab',
        'tabs',
        'storage',
        'scripting',
        'tabCapture',
        'desktopCapture',
      ],
      contentScripts: true,
      background: true,
    };
  }
}

// Create singleton instance
export const configService = ConfigService.getInstance();

// Export convenience functions
export function getConfig(): AppConfig {
  return configService.getConfig();
}

export function getEndpoints(): ApiEndpoints {
  return configService.getEndpoints();
}

export function getApiUrl(endpoint: string): string {
  return configService.getApiUrl(endpoint);
}

export function isProduction(): boolean {
  return configService.isProduction();
}

export function isDevelopment(): boolean {
  return configService.isDevelopment();
}

export function isMockMode(): boolean {
  return configService.isMockMode();
}

export function isDebugMode(): boolean {
  return configService.isDebugMode();
}

export function isFeatureEnabled(feature: string): boolean {
  return configService.isFeatureEnabled(feature);
}

export default configService;