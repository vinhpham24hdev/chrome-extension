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
   * Initialize all services with real backend
   */
  public async initialize(): Promise<ServiceInitializationResult> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

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
      console.log('🚀 Initializing services with real backend...');

      // Get configuration from environment
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const enableMockMode = import.meta.env.VITE_ENABLE_MOCK_MODE === 'true';
      const awsRegion = import.meta.env.VITE_AWS_REGION || 'us-east-1';
      const bucketName = import.meta.env.VITE_AWS_S3_BUCKET_NAME;

      if (!apiBaseUrl) {
        errors.push('VITE_API_BASE_URL not configured');
      }

      if (!bucketName) {
        warnings.push('VITE_AWS_S3_BUCKET_NAME not configured');
      }

      // Initialize AWS configuration
      try {
        awsConfigManager.initialize();
        console.log('✅ AWS configuration initialized');
      } catch (error) {
        const errorMsg = `AWS configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        warnings.push(errorMsg);
        console.warn('⚠️', errorMsg);
      }

      // Initialize S3 service
      try {
        const s3Result = await s3Service.initialize({
          bucketName: bucketName || 'screen-capture-tool-dev',
          region: awsRegion,
          apiBaseUrl: apiBaseUrl || 'http://localhost:3001/api',
          maxFileSize: 100 * 1024 * 1024, // 100MB
          allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'video/webm', 'video/mp4'],
          enableMockMode: enableMockMode
        });

        if (s3Result.success) {
          console.log('✅ S3 service initialized');
          if (enableMockMode) {
            warnings.push('S3 service running in mock mode');
          }
        } else {
          errors.push(`S3 service initialization failed: ${s3Result.error}`);
        }
      } catch (error) {
        const errorMsg = `S3 service error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error('❌', errorMsg);
      }

      // Initialize Case service
      try {
        // Set case service to use real backend
        caseService.setMockMode(enableMockMode);
        await caseService.initialize();
        console.log('✅ Case service initialized');
        if (enableMockMode) {
          warnings.push('Case service running in mock mode');
        }
      } catch (error) {
        const errorMsg = `Case service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error('❌', errorMsg);
      }

      // Test backend connectivity
      if (!enableMockMode && apiBaseUrl) {
        try {
          const response = await fetch(`${apiBaseUrl}/health`);
          if (response.ok) {
            const healthData = await response.json();
            console.log('✅ Backend connectivity verified');
            console.log(`   Backend status: ${healthData.status}`);
            console.log(`   SDK version: ${healthData.sdkVersion || 'unknown'}`);
          } else {
            warnings.push(`Backend health check failed: ${response.status}`);
          }
        } catch (error) {
          warnings.push(`Backend not reachable: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const success = errors.length === 0;
      this.isInitialized = success || warnings.length > 0; // Initialize even with warnings

      if (success) {
        console.log('🎉 All services initialized successfully');
        if (warnings.length > 0) {
          console.warn('⚠️ Warnings:', warnings);
        }
      } else {
        console.error('💥 Service initialization failed:', errors);
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
   * Get service health status
   */
  public getServiceStatus(): {
    awsConfig: boolean;
    s3Service: boolean;
    caseService: boolean;
    overall: boolean;
    backendConnected: boolean;
  } {
    return {
      awsConfig: awsConfigManager.isInitialized(),
      s3Service: this.isInitialized,
      caseService: this.isInitialized,
      overall: this.isInitialized,
      backendConnected: !import.meta.env.VITE_ENABLE_MOCK_MODE
    };
  }

  /**
   * Reinitialize services (useful for config changes)
   */
  public async reinitialize(): Promise<ServiceInitializationResult> {
    this.isInitialized = false;
    this.initializationPromise = null;
    return this.initialize();
  }
}

export const serviceManager = ServiceManager.getInstance();
