// config/aws.ts - Real AWS Configuration (No Mock Mode)
export interface AWSConfig {
  bucketName: string;
  region: string;
  apiBaseUrl: string;
  maxFileSize: number;
  allowedFileTypes: readonly string[];
  uploadTimeout: number;
  multipartThreshold: number;
}

// Real environment-based configuration matching backend .env
export const getAWSConfig = (): AWSConfig => {
  // Use same environment variable names as backend
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
  const region = import.meta.env.VITE_AWS_REGION || 'ap-southeast-2'; // Match backend default
  const bucketName = import.meta.env.VITE_AWS_S3_BUCKET_NAME || 'cellebrite-screen-capture-dev'; // Match backend default
  
  // Use same file size limits as backend
  const maxFileSize = parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '104857600'); // 100MB like backend
  
  console.log('🔧 Real AWS Config:', {
    apiBaseUrl,
    region,
    bucketName,
    maxFileSizeMB: Math.round(maxFileSize / (1024 * 1024))
  });
  
  return {
    bucketName,
    region,
    apiBaseUrl,
    maxFileSize,
    allowedFileTypes: [
      'image/png',
      'image/jpeg', 
      'image/webp',
      'image/gif',
      'video/webm',
      'video/mp4',
      'video/quicktime'
    ] as const, // Match backend ALLOWED_FILE_TYPES
    uploadTimeout: parseInt(import.meta.env.VITE_UPLOAD_TIMEOUT || '600000'), // 10 minutes
    multipartThreshold: 5 * 1024 * 1024 // 5MB
  };
};

// Configuration manager for real AWS operations
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
    
    const env = import.meta.env.NODE_ENV || 'development';
    console.log(`✅ Real AWS Configuration initialized for ${env} environment`);
    console.log(`🔗 Backend API: ${this.config.apiBaseUrl}`);
    console.log(`☁️ S3 Bucket: ${this.config.bucketName} (${this.config.region})`);
  }
  
  public getConfig(): AWSConfig {
    if (!this.config) {
      throw new Error('AWS configuration not initialized. Call initialize() first.');
    }
    return { ...this.config };
  }
  
  public isInitialized(): boolean {
    return this.config !== null;
  }

  /**
   * Validate AWS configuration against backend requirements
   */
  public validateConfig(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.config) {
      errors.push('AWS configuration not initialized');
      return { isValid: false, errors, warnings };
    }

    // Check required fields that must match backend
    if (!this.config.bucketName) {
      errors.push('S3 bucket name is required (VITE_AWS_S3_BUCKET_NAME)');
    }

    if (!this.config.apiBaseUrl) {
      errors.push('API base URL is required (VITE_API_BASE_URL)');
    }

    if (!this.config.region) {
      errors.push('AWS region is required (VITE_AWS_REGION)');
    }

    // Validate against backend defaults
    if (this.config.bucketName === 'cellebrite-screen-capture-dev') {
      warnings.push('Using default development bucket name');
    }

    if (this.config.apiBaseUrl.includes('localhost')) {
      warnings.push('Using localhost API - ensure backend is running on the same port');
    }

    // Check file size is reasonable (same as backend MAX_FILE_SIZE)
    const maxSizeMB = this.config.maxFileSize / (1024 * 1024);
    if (maxSizeMB > 100) {
      warnings.push(`Large file size limit (${maxSizeMB}MB) may cause performance issues`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get S3 bucket URL (matches backend S3 URL format)
   */
  public getBucketUrl(): string {
    if (!this.config) {
      throw new Error('AWS configuration not initialized');
    }
    
    return `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com`;
  }

  /**
   * Check if file type is allowed (matches backend ALLOWED_FILE_TYPES)
   */
  public isFileTypeAllowed(fileType: string): boolean {
    if (!this.config) {
      return false;
    }
    
    return this.config.allowedFileTypes.includes(fileType);
  }

  /**
   * Check if file size is within limits (matches backend MAX_FILE_SIZE)
   */
  public isFileSizeAllowed(fileSize: number): boolean {
    if (!this.config) {
      return false;
    }
    
    return fileSize <= this.config.maxFileSize;
  }

  /**
   * Get upload method based on file size
   */
  public getUploadMethod(fileSize: number): 'simple' | 'multipart' {
    if (!this.config) {
      return 'simple';
    }
    
    return fileSize > this.config.multipartThreshold ? 'multipart' : 'simple';
  }
}

// Export singleton instance
export const awsConfigManager = AWSConfigManager.getInstance();

// Validation helper that matches backend file validation
export const validateFileUpload = (file: File): { isValid: boolean; error?: string } => {
  const config = awsConfigManager.getConfig();
  
  if (!awsConfigManager.isFileTypeAllowed(file.type)) {
    return {
      isValid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${config.allowedFileTypes.join(', ')}`
    };
  }
  
  if (!awsConfigManager.isFileSizeAllowed(file.size)) {
    const maxSizeMB = Math.round(config.maxFileSize / (1024 * 1024));
    return {
      isValid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`
    };
  }
  
  if (file.size < 1024) {
    return {
      isValid: false,
      error: 'File is too small (minimum 1KB)'
    };
  }
  
  return { isValid: true };
};

// Utility functions
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export const getUploadEstimatedTime = (fileSize: number, speed: number): number => {
  if (speed <= 0) return 0;
  return Math.round(fileSize / speed);
};

// Development helper to check configuration
export const logAWSConfig = (): void => {
  const config = awsConfigManager.getConfig();
  const validation = awsConfigManager.validateConfig();
  
  console.group('🔧 Real AWS Configuration');
  console.log('API Base URL:', config.apiBaseUrl);
  console.log('S3 Bucket:', config.bucketName);
  console.log('Region:', config.region);
  console.log('Max File Size:', formatFileSize(config.maxFileSize));
  console.log('Upload Timeout:', config.uploadTimeout / 1000 + 's');
  console.log('Allowed Types:', config.allowedFileTypes.join(', '));
  console.log('Bucket URL:', awsConfigManager.getBucketUrl());
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️ Warnings:', validation.warnings);
  }
  
  if (validation.errors.length > 0) {
    console.error('❌ Errors:', validation.errors);
  } else {
    console.log('✅ Configuration is valid');
  }
  
  console.groupEnd();
};