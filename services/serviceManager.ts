import { s3Service } from './s3Service';
import { caseService } from './caseService';
import { awsConfigManager } from '../config/aws';

export interface ServiceInitializationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export class ServiceManager {
  private static instance: ServiceManager;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<ServiceInitializationResult> | null = null;

  private constructor() {}

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * Initialize all services
   */
  public async initialize(): Promise<ServiceInitializationResult> {
    // Return existing promise if already initializing
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Return success if already initialized
    if (this.isInitialized) {
      return { success: true, errors: [], warnings: [] };
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<ServiceInitializationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      console.log('🚀 Initializing services...');

      // Initialize AWS configuration
      try {
        awsConfigManager.initialize();
        console.log('✅ AWS configuration initialized');
      } catch (error) {
        const errorMsg = `AWS configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error('❌', errorMsg);
      }

      // Initialize S3 service
      if (awsConfigManager.isInitialized()) {
        try {
          const awsConfig = awsConfigManager.getConfig();
          const s3Result = await s3Service.initialize({
            bucketName: awsConfig.bucketName,
            region: awsConfig.region,
            apiBaseUrl: awsConfig.apiBaseUrl,
            maxFileSize: awsConfig.maxFileSize,
            allowedTypes: awsConfig.allowedFileTypes,
            enableMockMode: awsConfig.enableMockMode
          });

          if (s3Result.success) {
            console.log('✅ S3 service initialized');
            if (awsConfig.enableMockMode) {
              warnings.push('S3 service running in mock mode');
            }
          } else {
            errors.push(`S3 service initialization failed: ${s3Result.error}`);
            console.error('❌ S3 service failed:', s3Result.error);
          }
        } catch (error) {
          const errorMsg = `S3 service initialization error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error('❌', errorMsg);
        }
      }

      // Initialize Case service
      try {
        await caseService.initialize();
        console.log('✅ Case service initialized');
      } catch (error) {
        const errorMsg = `Case service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error('❌', errorMsg);
      }

      const success = errors.length === 0;
      this.isInitialized = success;

      if (success) {
        console.log('🎉 All services initialized successfully');
        if (warnings.length > 0) {
          console.warn('⚠️ Warnings:', warnings);
        }
      } else {
        console.error('💥 Service initialization failed with errors:', errors);
      }

      return { success, errors, warnings };

    } catch (error) {
      const errorMsg = `Service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error('💥', errorMsg);
      
      return { success: false, errors, warnings };
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * Check if services are initialized
   */
  public isServicesInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Reinitialize services (useful for config changes)
   */
  public async reinitialize(): Promise<ServiceInitializationResult> {
    this.isInitialized = false;
    this.initializationPromise = null;
    return this.initialize();
  }

  /**
   * Get service health status
   */
  public getServiceStatus(): {
    awsConfig: boolean;
    s3Service: boolean;
    caseService: boolean;
    overall: boolean;
  } {
    return {
      awsConfig: awsConfigManager.isInitialized(),
      s3Service: this.isInitialized, // TODO: Add specific S3 health check
      caseService: this.isInitialized, // TODO: Add specific case service health check
      overall: this.isInitialized
    };
  }
}

// Export singleton instance
export const serviceManager = ServiceManager.getInstance();
