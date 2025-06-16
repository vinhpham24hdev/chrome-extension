// config/aws.ts - AWS Configuration
export interface AWSConfig {
  bucketName: string;
  region: string;
  apiBaseUrl: string;
  maxFileSize: number;
  enableMockMode: boolean;
  corsOrigins?: string[];
  allowedFileTypes: readonly string[]; // Changed to readonly to match AWS_CONFIGS
  uploadTimeout: number;
  multipartThreshold: number;
}

// Environment-based configuration
export const getAWSConfig = (): AWSConfig => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    bucketName: process.env.AWS_S3_BUCKET_NAME || 'screen-capture-tool-dev',
    region: process.env.AWS_REGION || 'us-east-1',
    apiBaseUrl: process.env.API_BASE_URL || (isDevelopment 
      ? 'http://localhost:3001/api' 
      : 'https://api.your-domain.com/api'
    ),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB
    enableMockMode: process.env.ENABLE_MOCK_MODE === 'true' || isDevelopment,
    corsOrigins: [
      'chrome-extension://*',
      'http://localhost:*',
      'https://your-domain.com'
    ],
    allowedFileTypes: [
      'image/png',
      'image/jpeg', 
      'image/webp',
      'video/webm',
      'video/mp4',
      'video/quicktime'
    ],
    uploadTimeout: 600000, // 10 minutes
    multipartThreshold: 5 * 1024 * 1024 // 5MB
  };
};

// Validation functions
export const validateAWSConfig = (config: AWSConfig): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!config.bucketName) {
    errors.push('Bucket name is required');
  }

  if (!config.region) {
    errors.push('AWS region is required');
  }

  if (!config.apiBaseUrl) {
    errors.push('API base URL is required');
  }

  if (config.maxFileSize <= 0) {
    errors.push('Max file size must be greater than 0');
  }

  if (!config.allowedFileTypes.length) {
    errors.push('At least one file type must be allowed');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Default configurations for different environments
export const AWS_CONFIGS: Record<'development' | 'staging' | 'production', AWSConfig> = {
  development: {
    bucketName: 'screen-capture-tool-dev',
    region: 'us-east-1',
    apiBaseUrl: 'http://localhost:3001/api',
    maxFileSize: 50 * 1024 * 1024, // 50MB for dev
    enableMockMode: true,
    allowedFileTypes: [
      'image/png',
      'image/jpeg',
      'video/webm'
    ] as const,
    uploadTimeout: 300000, // 5 minutes
    multipartThreshold: 10 * 1024 * 1024 // 10MB
  },
  
  staging: {
    bucketName: 'screen-capture-tool-staging',
    region: 'us-east-1', 
    apiBaseUrl: 'https://api-staging.your-domain.com/api',
    maxFileSize: 100 * 1024 * 1024, // 100MB
    enableMockMode: false,
    allowedFileTypes: [
      'image/png',
      'image/jpeg',
      'image/webp',
      'video/webm',
      'video/mp4'
    ] as const,
    uploadTimeout: 600000, // 10 minutes
    multipartThreshold: 5 * 1024 * 1024 // 5MB
  },
  
  production: {
    bucketName: 'screen-capture-tool-prod',
    region: 'us-east-1',
    apiBaseUrl: 'https://api.your-domain.com/api',
    maxFileSize: 100 * 1024 * 1024, // 100MB
    enableMockMode: false,
    allowedFileTypes: [
      'image/png',
      'image/jpeg', 
      'image/webp',
      'video/webm',
      'video/mp4',
      'video/quicktime'
    ] as const,
    uploadTimeout: 600000, // 10 minutes
    multipartThreshold: 5 * 1024 * 1024 // 5MB
  }
};

// Environment detection
export const getCurrentEnvironment = (): keyof typeof AWS_CONFIGS => {
  if (typeof process !== 'undefined' && process.env.NODE_ENV) {
    switch (process.env.NODE_ENV) {
      case 'production':
        return 'production';
      case 'staging':
        return 'staging';
      default:
        return 'development';
    }
  }
  
  // Browser environment detection
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
      return 'development';
    } else if (hostname.includes('staging')) {
      return 'staging';  
    } else {
      return 'production';
    }
  }
  
  return 'development';
};

// Configuration manager
export class AWSConfigManager {
  private static instance: AWSConfigManager;
  private config: AWSConfig | null = null;
  
  private constructor() {}
  
  public static getInstance(): AWSConfigManager {
    if (!AWSConfigManager.instance) {
      AWSConfigManager.instance = new AWSConfigManager();
    }
    return AWSConfigManager.instance;
  }
  
  public initialize(environment?: keyof typeof AWS_CONFIGS): void {
    const env = environment || getCurrentEnvironment();
    this.config = { ...AWS_CONFIGS[env] };
    
    // Override with environment variables if available
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.AWS_S3_BUCKET_NAME) {
        this.config.bucketName = process.env.AWS_S3_BUCKET_NAME;
      }
      if (process.env.AWS_REGION) {
        this.config.region = process.env.AWS_REGION;
      }
      if (process.env.API_BASE_URL) {
        this.config.apiBaseUrl = process.env.API_BASE_URL;
      }
      if (process.env.MAX_FILE_SIZE) {
        this.config.maxFileSize = parseInt(process.env.MAX_FILE_SIZE);
      }
      if (process.env.ENABLE_MOCK_MODE) {
        this.config.enableMockMode = process.env.ENABLE_MOCK_MODE === 'true';
      }
    }
    
    // Validate configuration
    const validation = validateAWSConfig(this.config);
    if (!validation.valid) {
      throw new Error(`Invalid AWS configuration: ${validation.errors.join(', ')}`);
    }
    
    console.log(`AWS Configuration initialized for ${env} environment`);
  }
  
  public getConfig(): AWSConfig {
    if (!this.config) {
      throw new Error('AWS configuration not initialized');
    }
    return { ...this.config };
  }
  
  public updateConfig(updates: Partial<AWSConfig>): void {
    if (!this.config) {
      throw new Error('AWS configuration not initialized');
    }
    
    this.config = { ...this.config, ...updates };
    
    const validation = validateAWSConfig(this.config);
    if (!validation.valid) {
      throw new Error(`Invalid AWS configuration update: ${validation.errors.join(', ')}`);
    }
  }
  
  public isInitialized(): boolean {
    return this.config !== null;
  }
}

// Export singleton instance
export const awsConfigManager = AWSConfigManager.getInstance();