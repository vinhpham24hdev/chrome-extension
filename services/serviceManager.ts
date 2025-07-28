// services/serviceManager.ts - Clean Service Manager (No Mock Mode)
import { authService } from "./authService";

// Import only existing services - others will be conditionally imported
let s3Service: any = null;
let caseService: any = null;
let screenshotService: any = null;
let videoService: any = null;
let screenshotWindowService: any = null;
let videoWindowService: any = null;
let videoRecorderWindowService: any = null;

// Conditional imports to prevent errors if services don't exist
try {
  s3Service = require("./s3Service").s3Service;
} catch (error) {
  console.warn("⚠️ S3 service not available:", error);
}

try {
  caseService = require("./caseService").caseService;
} catch (error) {
  console.warn("⚠️ Case service not available:", error);
}

try {
  screenshotService = require("./screenshotService").screenshotService;
} catch (error) {
  console.warn("⚠️ Screenshot service not available:", error);
}

try {
  videoService = require("./videoService").videoService;
} catch (error) {
  console.warn("⚠️ Video service not available:", error);
}

try {
  screenshotWindowService = require("./screenshotWindowService").screenshotWindowService;
} catch (error) {
  console.warn("⚠️ Screenshot window service not available:", error);
}

try {
  videoWindowService = require("./videoWindowService").videoWindowService;
} catch (error) {
  console.warn("⚠️ Video window service not available:", error);
}

try {
  videoRecorderWindowService = require("./videoRecorderWindowService").videoRecorderWindowService;
} catch (error) {
  console.warn("⚠️ Video recorder window service not available:", error);
}

export interface ServiceInitializationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  backendConnected: boolean;
  authReady: boolean;
  s3Ready: boolean;
  casesReady: boolean;
  captureServicesReady: boolean;
}

export interface CaptureServicesStatus {
  screenshot: boolean;
  video: boolean;
  screenshotWindow: boolean;
  videoWindow: boolean;
  videoRecorder: boolean;
  chromeAPIs: boolean;
  activeCaptures: {
    screenshot: boolean;
    video: boolean;
    recording: boolean;
  };
}

export class ServiceManager {
  private static instance: ServiceManager;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<ServiceInitializationResult> | null = null;
  private backendConnected: boolean = false;

  private constructor() {}

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * Initialize all services with real backend only
   */
  public async initialize(): Promise<ServiceInitializationResult> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.isInitialized) {
      return this.getServiceStatus();
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<ServiceInitializationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let backendConnected = false;
    let authReady = false;
    let s3Ready = false;
    let casesReady = false;
    let captureServicesReady = false;

    try {
      console.log("🚀 Initializing services...");

      // Get configuration from environment
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const awsRegion = import.meta.env.VITE_AWS_REGION || "us-east-1";
      const bucketName = import.meta.env.VITE_AWS_S3_BUCKET_NAME;

      console.log("🔧 Configuration:", {
        apiBaseUrl,
        awsRegion,
        bucketName: bucketName ? `${bucketName.substring(0, 20)}...` : "NOT SET",
      });

      if (!apiBaseUrl) {
        errors.push("VITE_API_BASE_URL not configured in environment");
      }

      if (!bucketName) {
        warnings.push("VITE_AWS_S3_BUCKET_NAME not configured - S3 uploads will not work");
      }

      // 1. Initialize Authentication Service
      console.log("🔐 Initializing authentication service...");
      try {
        await authService.initializeAuth();
        authReady = true;
        console.log("✅ Authentication service ready");
      } catch (error) {
        authReady = false;
        const errorMsg = `Authentication service failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        errors.push(errorMsg);
        console.error("❌", errorMsg);
      }

      // 2. Test Backend Connectivity
      console.log("🔍 Testing backend connectivity...");
      try {
        const connectionTest = await authService.testConnection();
        if (connectionTest.connected) {
          backendConnected = true;
          this.backendConnected = true;
          console.log("✅ Backend connectivity verified");
        } else {
          backendConnected = false;
          const errorMsg = `Backend not reachable: ${connectionTest.error || connectionTest.message}`;
          errors.push(errorMsg);
        }
      } catch (error) {
        const errorMsg = `Backend connection test failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        errors.push(errorMsg);
      }

      // 3. Initialize S3 Service
      if (s3Service) {
        console.log("☁️ Initializing S3 service...");
        try {
          const s3Config = {
            bucketName: bucketName || "screen-capture-tool-dev",
            region: awsRegion,
            apiBaseUrl: apiBaseUrl || "http://localhost:3001/api",
            maxFileSize: 100 * 1024 * 1024, // 100MB
            allowedTypes: [
              "image/png",
              "image/jpeg",
              "image/webp",
              "video/webm",
              "video/mp4",
            ],
          };

          // Check if s3Service has initialize method
          if (typeof s3Service.initialize === 'function') {
            const s3Result = await s3Service.initialize(s3Config);
            if (s3Result && s3Result.success) {
              s3Ready = true;
              console.log("✅ S3 service initialized");
            } else {
              s3Ready = false;
              errors.push(`S3 service initialization failed: ${s3Result?.error || 'Unknown error'}`);
            }
          } else {
            // Fallback for different S3 service interface
            s3Ready = true;
            console.log("✅ S3 service available (no initialization required)");
          }
        } catch (error) {
          s3Ready = false;
          const errorMsg = `S3 service error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`;
          errors.push(errorMsg);
          console.error("❌", errorMsg);
        }
      } else {
        warnings.push("S3 service not available");
      }

      // 4. Initialize Case Service
      if (caseService) {
        console.log("📋 Initializing case service...");
        try {
          if (typeof caseService.initialize === 'function') {
            await caseService.initialize();
          }
          
          casesReady = true;
          console.log("✅ Case service initialized");
        } catch (error) {
          casesReady = false;
          const errorMsg = `Case service initialization failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`;
          errors.push(errorMsg);
          console.error("❌", errorMsg);
        }
      } else {
        warnings.push("Case service not available");
        casesReady = true; // Don't fail if not available
      }

      // 5. Initialize Capture Services
      console.log("📸 Initializing capture services...");
      try {
        const captureStatus = this.initializeCaptureServices();
        captureServicesReady = captureStatus.success;
        
        if (captureStatus.warnings.length > 0) {
          warnings.push(...captureStatus.warnings);
        }
        
        if (captureStatus.errors.length > 0) {
          errors.push(...captureStatus.errors);
        }

        console.log("✅ Capture services initialization completed");
      } catch (error) {
        captureServicesReady = false;
        const errorMsg = `Capture services initialization failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        errors.push(errorMsg);
        console.error("❌", errorMsg);
      }

      const success = errors.length === 0;
      this.isInitialized = success || warnings.length > 0; // Initialize even with warnings

      // Final status
      if (success) {
        console.log("🎉 All services initialized successfully");
        if (warnings.length > 0) {
          console.warn("⚠️ Warnings during initialization:", warnings);
        }
      } else {
        console.error("💥 Service initialization failed:", errors);
      }

      return {
        success,
        errors,
        warnings,
        backendConnected,
        authReady,
        s3Ready,
        casesReady,
        captureServicesReady,
      };
    } catch (error) {
      const errorMsg = `Service initialization failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
      errors.push(errorMsg);
      console.error("💥", errorMsg);

      return {
        success: false,
        errors,
        warnings,
        backendConnected: false,
        authReady: false,
        s3Ready: false,
        casesReady: false,
        captureServicesReady: false,
      };
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * Initialize capture services
   */
  private initializeCaptureServices(): { success: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check Chrome APIs availability
    if (typeof chrome === "undefined") {
      warnings.push("Chrome extension APIs not available - capture features may not work");
    } else {
      // Check specific APIs needed for capture
      const chromeAPIs = {
        tabs: !!chrome.tabs,
        windows: !!chrome.windows,
        runtime: !!chrome.runtime,
        storage: !!chrome.storage,
      };

      const missingAPIs = Object.entries(chromeAPIs)
        .filter(([, available]) => !available)
        .map(([api]) => api);

      if (missingAPIs.length > 0) {
        warnings.push(`Chrome APIs missing: ${missingAPIs.join(", ")}`);
      } else {
        console.log("✅ All required Chrome APIs available");
      }
    }

    // Check individual capture services
    const services = {
      screenshot: screenshotService,
      video: videoService,
      screenshotWindow: screenshotWindowService,
      videoWindow: videoWindowService,
      videoRecorder: videoRecorderWindowService,
    };

    Object.entries(services).forEach(([name, service]) => {
      if (!service) {
        warnings.push(`${name} service not available`);
      } else {
        console.log(`✅ ${name} service available`);
      }
    });

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Test authenticated endpoints after login
   */
  public async testAuthenticatedEndpoints(): Promise<{
    success: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    if (!this.backendConnected) {
      errors.push("Backend not connected");
      return { success: false, errors };
    }

    if (!authService.isAuthenticated()) {
      errors.push("User not authenticated");
      return { success: false, errors };
    }

    try {
      console.log("🧪 Testing authenticated endpoints...");

      // Test cases endpoint
      const casesResponse = await authService.authenticatedRequest("/cases?limit=1");
      if (!casesResponse.success) {
        errors.push(`Cases endpoint failed: ${casesResponse.error}`);
      } else {
        console.log("✅ Cases endpoint working");
      }

      // Test upload endpoint
      const uploadTestResponse = await authService.authenticatedRequest("/upload/stats");
      if (!uploadTestResponse.success) {
        errors.push(`Upload endpoint failed: ${uploadTestResponse.error}`);
      } else {
        console.log("✅ Upload endpoint working");
      }

      // Test user endpoint
      const userResponse = await authService.authenticatedRequest("/auth/me");
      if (!userResponse.success) {
        errors.push(`User endpoint failed: ${userResponse.error}`);
      } else {
        console.log("✅ User endpoint working");
      }

      const success = errors.length === 0;
      if (success) {
        console.log("🎉 All authenticated endpoints working correctly");
      }

      return { success, errors };
    } catch (error) {
      const errorMsg = `Authenticated endpoint test failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
      errors.push(errorMsg);
      return { success: false, errors };
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
  public getServiceStatus(): ServiceInitializationResult {
    return {
      success: this.isInitialized,
      errors: [],
      warnings: [],
      backendConnected: this.backendConnected,
      authReady: true,
      s3Ready: this.isInitialized,
      casesReady: this.isInitialized,
      captureServicesReady: this.isInitialized,
    };
  }

  /**
   * Get capture services status
   */
  public getCaptureServicesStatus(): CaptureServicesStatus {
    return {
      screenshot: !!screenshotService,
      video: !!videoService,
      screenshotWindow: !!screenshotWindowService,
      videoWindow: !!videoWindowService,
      videoRecorder: !!videoRecorderWindowService,
      chromeAPIs: typeof chrome !== "undefined",
      activeCaptures: {
        screenshot: this.isServiceActive(screenshotWindowService, 'isPreviewWindowOpen'),
        video: this.isServiceActive(videoWindowService, 'isPreviewWindowOpen'),
        recording: this.isServiceActive(videoRecorderWindowService, 'isRecorderOpen'),
      },
    };
  }

  /**
   * Helper to check if a service is active
   */
  private isServiceActive(service: any, methodName: string): boolean {
    try {
      if (service && typeof service[methodName] === 'function') {
        return service[methodName]();
      }
    } catch (error) {
      console.warn(`⚠️ Error checking service status:`, error);
    }
    return false;
  }

  /**
   * Check if backend is connected
   */
  public isBackendConnected(): boolean {
    return this.backendConnected;
  }

  /**
   * Get API base URL
   */
  public getApiBaseUrl(): string {
    return import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
  }

  /**
   * Reinitialize services (useful for config changes)
   */
  public async reinitialize(): Promise<ServiceInitializationResult> {
    console.log("🔄 Reinitializing services...");
    
    this.isInitialized = false;
    this.backendConnected = false;
    this.initializationPromise = null;
    
    // Close any active captures before reinitializing
    await this.closeAllCaptureServices();
    
    return this.initialize();
  }

  /**
   * Update services after successful login
   */
  public async onLoginSuccess(): Promise<void> {
    try {
      console.log("🔄 Updating services after login...");

      // Test authenticated endpoints
      const testResult = await this.testAuthenticatedEndpoints();
      if (!testResult.success) {
        console.warn("⚠️ Some authenticated endpoints failed:", testResult.errors);
      }

      // Update S3 service with auth token
      if (this.backendConnected && s3Service) {
        try {
          if (typeof s3Service.setAuthToken === 'function') {
            const token = authService.getCurrentToken();
            if (token) {
              s3Service.setAuthToken(token);
            }
          }
          console.log("✅ S3 service auth updated");
        } catch (error) {
          console.warn("⚠️ Failed to update S3 service auth:", error);
        }
      }

      console.log("✅ Services updated after login");
    } catch (error) {
      console.error("❌ Failed to update services after login:", error);
    }
  }

  /**
   * Update services after logout
   */
  public async onLogout(): Promise<void> {
    try {
      console.log("🔄 Updating services after logout...");

      // Close all active captures
      await this.closeAllCaptureServices();

      // Clear S3 service auth
      if (s3Service && typeof s3Service.clearAuth === 'function') {
        try {
          s3Service.clearAuth();
          console.log("✅ S3 service auth cleared");
        } catch (error) {
          console.warn("⚠️ Failed to clear S3 service auth:", error);
        }
      }

      console.log("✅ Services updated after logout");
    } catch (error) {
      console.error("❌ Failed to update services after logout:", error);
    }
  }

  /**
   * Force close all capture services
   */
  public async closeAllCaptureServices(): Promise<void> {
    try {
      console.log('🔄 Closing all capture services...');
      
      const closePromises: Promise<void>[] = [];

      // Close screenshot services
      if (screenshotWindowService) {
        try {
          if (typeof screenshotWindowService.isPreviewWindowOpen === 'function' && 
              screenshotWindowService.isPreviewWindowOpen()) {
            if (typeof screenshotWindowService.closePreviewWindow === 'function') {
              closePromises.push(screenshotWindowService.closePreviewWindow());
            }
          }
        } catch (error) {
          console.warn('⚠️ Error closing screenshot window service:', error);
        }
      }
      
      // Close video services
      if (videoWindowService) {
        try {
          if (typeof videoWindowService.isPreviewWindowOpen === 'function' && 
              videoWindowService.isPreviewWindowOpen()) {
            if (typeof videoWindowService.closePreviewWindow === 'function') {
              closePromises.push(videoWindowService.closePreviewWindow());
            }
          }
        } catch (error) {
          console.warn('⚠️ Error closing video window service:', error);
        }
      }
      
      // Close recorder
      if (videoRecorderWindowService) {
        try {
          if (typeof videoRecorderWindowService.isRecorderOpen === 'function' && 
              videoRecorderWindowService.isRecorderOpen()) {
            if (typeof videoRecorderWindowService.closeRecorder === 'function') {
              closePromises.push(videoRecorderWindowService.closeRecorder());
            }
          }
        } catch (error) {
          console.warn('⚠️ Error closing video recorder service:', error);
        }
      }

      // Stop any ongoing captures
      if (screenshotService && typeof screenshotService.stopCapture === 'function') {
        try {
          closePromises.push(screenshotService.stopCapture());
        } catch (error) {
          console.warn('⚠️ Error stopping screenshot capture:', error);
        }
      }

      if (videoService && typeof videoService.stopRecording === 'function') {
        try {
          closePromises.push(videoService.stopRecording());
        } catch (error) {
          console.warn('⚠️ Error stopping video recording:', error);
        }
      }

      // Wait for all close operations to complete
      await Promise.allSettled(closePromises);
      
      console.log('✅ All capture services closed');
    } catch (error) {
      console.error('❌ Error closing capture services:', error);
    }
  }

  /**
   * Get detailed system status
   */
  public async getSystemStatus(): Promise<{
    services: ServiceInitializationResult;
    capture: CaptureServicesStatus;
    auth: {
      isAuthenticated: boolean;
      user: any;
      tokenExpired: boolean;
    };
    backend: {
      connected: boolean;
      apiUrl: string;
    };
  }> {
    const services = this.getServiceStatus();
    const capture = this.getCaptureServicesStatus();
    
    const auth = {
      isAuthenticated: authService.isAuthenticated(),
      user: authService.getCurrentUser(),
      tokenExpired: authService.isTokenExpired(),
    };

    const backend = {
      connected: this.backendConnected,
      apiUrl: this.getApiBaseUrl(),
    };

    return {
      services,
      capture,
      auth,
      backend,
    };
  }

  /**
   * Health check - test all services
   */
  public async healthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const details: Record<string, any> = {};
    let healthyCount = 0;
    let totalChecks = 0;

    try {
      // Check auth service
      totalChecks++;
      const authHealthy = authService.isAuthenticated();
      details.auth = { healthy: authHealthy, authenticated: authHealthy };
      if (authHealthy) healthyCount++;

      // Check backend connection
      totalChecks++;
      const backendTest = await authService.testConnection();
      details.backend = { 
        healthy: backendTest.connected, 
        connected: backendTest.connected,
        message: backendTest.message 
      };
      if (backendTest.connected) healthyCount++;

      // Check capture services
      totalChecks++;
      const captureStatus = this.getCaptureServicesStatus();
      const captureHealthy = captureStatus.chromeAPIs && (
        captureStatus.screenshot || 
        captureStatus.video || 
        captureStatus.screenshotWindow ||
        captureStatus.videoWindow ||
        captureStatus.videoRecorder
      );
      details.capture = { healthy: captureHealthy, ...captureStatus };
      if (captureHealthy) healthyCount++;

      // Determine overall health
      let overall: 'healthy' | 'degraded' | 'unhealthy';
      const healthRatio = healthyCount / totalChecks;
      
      if (healthRatio >= 0.8) {
        overall = 'healthy';
      } else if (healthRatio >= 0.5) {
        overall = 'degraded';
      } else {
        overall = 'unhealthy';
      }

      details.summary = {
        healthyServices: healthyCount,
        totalServices: totalChecks,
        healthRatio: Math.round(healthRatio * 100),
      };

      return { overall, details };
    } catch (error) {
      details.error = error instanceof Error ? error.message : 'Unknown error';
      return { overall: 'unhealthy', details };
    }
  }
}

// Create singleton instance
export const serviceManager = ServiceManager.getInstance();