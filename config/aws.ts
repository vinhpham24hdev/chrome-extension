// config/aws.ts - AWS Configuration for Real Backend
export interface AWSConfig {
  bucketName: string;
  region: string;
  apiBaseUrl: string;
  maxFileSize: number;
  enableMockMode: boolean;
  corsOrigins?: string[];
  allowedFileTypes: readonly string[];
  uploadTimeout: number;
  multipartThreshold: number;
}

// Environment-based configuration
export const getAWSConfig = (): AWSConfig => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
  const enableMockMode = import.meta.env.VITE_ENABLE_MOCK_MODE === 'true';
  const region = import.meta.env.VITE_AWS_REGION || 'us-east-1';
  const bucketName = import.meta.env.VITE_AWS_S3_BUCKET_NAME || 'screen-capture-tool-dev';
  
  console.log('🔧 AWS Config:', {
    apiBaseUrl,
    enableMockMode,
    region,
    bucketName: bucketName.substring(0, 20) + '...'
  });
  
  return {
    bucketName,
    region,
    apiBaseUrl,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    enableMockMode,
    corsOrigins: [
      'chrome-extension://*',
      'http://localhost:*',
      'https://localhost:*'
    ],
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
  };
};

// Configuration manager with real backend support
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
  
  public initialize(): void {
    this.config = getAWSConfig();
    
    const env = import.meta.env.VITE_NODE_ENV || 'development';
    console.log(`AWS Configuration initialized for ${env} environment`);
    
    if (this.config.enableMockMode) {
      console.warn('⚠️ Running in MOCK MODE - using simulated S3 operations');
    } else {
      console.log('🔗 Connected to REAL BACKEND:', this.config.apiBaseUrl);
    }
  }
  
  public getConfig(): AWSConfig {
    if (!this.config) {
      throw new Error('AWS configuration not initialized');
    }
    return { ...this.config };
  }
  
  public isInitialized(): boolean {
    return this.config !== null;
  }
}

export const awsConfigManager = AWSConfigManager.getInstance();
