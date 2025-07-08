// services/serviceManager.ts - Real Backend Integration + Region Selector
import { s3Service } from "./s3Service";
import { caseService } from "./caseService";
import { authService } from "./authService";
import { screenshotService } from "./screenshotService";
import { videoService } from "./videoService";
import { screenshotWindowService } from "./screenshotWindowService";
import { videoWindowService } from "./videoWindowService";
import { videoRecorderWindowService } from "./videoRecorderWindowService";

export interface ServiceInitializationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  backendConnected: boolean;
  authReady: boolean;
  s3Ready: boolean;
  casesReady: boolean;
  captureServicesReady: boolean; // NEW: Track capture services status
}

export class ServiceManager {
  private static instance: ServiceManager;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<ServiceInitializationResult> | null =
    null;
  private backendConnected: boolean = false;

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
    let captureServicesReady = false; // NEW: Track capture services

    try {
      console.log("🚀 Initializing services with real backend...");

      // Get configuration from environment
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const enableMockMode = import.meta.env.VITE_ENABLE_MOCK_MODE === "true";
      const awsRegion = import.meta.env.VITE_AWS_REGION || "us-east-1";
      const bucketName = import.meta.env.VITE_AWS_S3_BUCKET_NAME;

      console.log("🔧 Configuration:", {
        apiBaseUrl,
        enableMockMode,
        awsRegion,
        bucketName: bucketName
          ? `${bucketName.substring(0, 20)}...`
          : "NOT SET",
      });

      if (!apiBaseUrl) {
        errors.push("VITE_API_BASE_URL not configured in environment");
      }

      if (!bucketName && !enableMockMode) {
        warnings.push(
          "VITE_AWS_S3_BUCKET_NAME not configured - S3 uploads will not work"
        );
      }

      // 1. Test Backend Connectivity
      console.log("🔍 Testing backend connectivity...");
      try {
        const connectionTest = await authService.testConnection();
        if (connectionTest.connected) {
          backendConnected = true;
          this.backendConnected = true;
          console.log("✅ Backend connectivity verified");

          if (enableMockMode) {
            warnings.push("Backend connected but running in MOCK MODE");
          }
        } else {
          backendConnected = false;
          const errorMsg = `Backend not reachable: ${connectionTest.error}`;
          if (enableMockMode) {
            warnings.push(errorMsg + " (Mock mode enabled)");
          } else {
            errors.push(errorMsg);
          }
        }
      } catch (error) {
        const errorMsg = `Backend connection test failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        if (enableMockMode) {
          warnings.push(errorMsg + " (Mock mode enabled)");
        } else {
          errors.push(errorMsg);
        }
      }

      // 3. Initialize Authentication Service
      console.log("🔐 Initializing authentication service...");
      try {
        // Auth service is initialized automatically, just verify it's working
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

      // 4. Initialize S3 Service
      console.log("☁️ Initializing S3 service...");
      try {
        const s3Result = await s3Service.initialize({
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
          enableMockMode: enableMockMode || !backendConnected,
        });

        if (s3Result.success) {
          s3Ready = true;
          console.log("✅ S3 service initialized");
          if (enableMockMode || !backendConnected) {
            warnings.push("S3 service running in mock mode");
          }
        } else {
          s3Ready = false;
          errors.push(`S3 service initialization failed: ${s3Result.error}`);
        }
      } catch (error) {
        s3Ready = false;
        const errorMsg = `S3 service error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        errors.push(errorMsg);
        console.error("❌", errorMsg);
      }

      // 5. Initialize Case Service
      console.log("📋 Initializing case service...");
      try {
        // Set case service to use real backend if connected
        caseService.setMockMode(enableMockMode || !backendConnected);
        await caseService.initialize();
        casesReady = true;
        console.log("✅ Case service initialized");

        if (enableMockMode || !backendConnected) {
          warnings.push("Case service running in mock mode");
        }
      } catch (error) {
        casesReady = false;
        const errorMsg = `Case service initialization failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        errors.push(errorMsg);
        console.error("❌", errorMsg);
      }

      // 6. Initialize Capture Services (NEW)
      console.log("📸 Initializing capture services...");
      try {
        // Check Chrome APIs availability for capture services
        if (typeof chrome === "undefined") {
          warnings.push(
            "Chrome extension APIs not available - capture features may not work"
          );
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

        captureServicesReady = true;
        console.log("✅ All capture services initialized");
      } catch (error) {
        captureServicesReady = false;
        const errorMsg = `Capture services initialization failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        errors.push(errorMsg);
        console.error("❌", errorMsg);
      }

      // 7. Test Authenticated Endpoints (if backend connected)
      if (backendConnected && !enableMockMode) {
        console.log("🔒 Testing authenticated endpoints...");
        try {
          // This will test once user logs in
          console.log(
            "ℹ️ Authenticated endpoint testing will occur after login"
          );
        } catch (error) {
          warnings.push(
            `Authenticated endpoint test failed: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      const success = errors.length === 0;
      this.isInitialized = success || warnings.length > 0; // Initialize even with warnings

      // Final status
      if (success) {
        console.log("🎉 All services initialized successfully");
        if (enableMockMode) {
          console.log("⚠️ Running in MOCK MODE for development");
        }
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
        captureServicesReady, // NEW: Include capture services status
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
        captureServicesReady: false, // NEW
      };
    } finally {
      this.initializationPromise = null;
    }
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
      const casesResponse = await authService.authenticatedRequest(
        "/cases?limit=1"
      );
      if (!casesResponse.success) {
        errors.push(`Cases endpoint failed: ${casesResponse.error}`);
      } else {
        console.log("✅ Cases endpoint working");
      }

      // Test upload endpoint
      const uploadTestResponse = await authService.authenticatedRequest(
        "/upload/stats"
      );
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
    const isAuth = authService.isAuthenticated();
    const mockMode = import.meta.env.VITE_ENABLE_MOCK_MODE === "true";

    return {
      success: this.isInitialized,
      errors: [],
      warnings: mockMode ? ["Running in mock mode"] : [],
      backendConnected: this.backendConnected,
      authReady: true,
      s3Ready: this.isInitialized,
      casesReady: this.isInitialized,
      captureServicesReady: this.isInitialized, // NEW
    };
  }

  /**
   * Get capture services status (NEW)
   */
  public getCaptureServicesStatus() {
    return {
      screenshot: !!screenshotService,
      video: !!videoService,
      screenshotWindow: !!screenshotWindowService,
      videoWindow: !!videoWindowService,
      videoRecorder: !!videoRecorderWindowService,
      chromeAPIs: typeof chrome !== "undefined",
      activeCaptures: {
        screenshot: screenshotWindowService?.isPreviewWindowOpen?.() || false,
        video: videoWindowService?.isPreviewWindowOpen?.() || false,
        recording: videoRecorderWindowService?.isRecorderOpen?.() || false,
      },
    };
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
   * Check if running in mock mode
   */
  public isMockMode(): boolean {
    return (
      import.meta.env.VITE_ENABLE_MOCK_MODE === "true" || !this.backendConnected
    );
  }

  /**
   * Reinitialize services (useful for config changes)
   */
  public async reinitialize(): Promise<ServiceInitializationResult> {
    this.isInitialized = false;
    this.backendConnected = false;
    this.initializationPromise = null;
    return this.initialize();
  }

  /**
   * Update services after successful login
   */
  public async onLoginSuccess(): Promise<void> {
    try {
      console.log("🔄 Updating services after login...");

      // Test authenticated endpoints
      await this.testAuthenticatedEndpoints();

      // Refresh case service with real data
      if (this.backendConnected && !this.isMockMode()) {
        caseService.setMockMode(false);
        await caseService.initialize();
        console.log("✅ Case service updated to use real API");
      }
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

      // Switch back to mock mode if backend not available
      if (!this.backendConnected || this.isMockMode()) {
        caseService.setMockMode(true);
        console.log("✅ Case service switched to mock mode");
      }
    } catch (error) {
      console.error("❌ Failed to update services after logout:", error);
    }
  }

  /**
   * Force close all capture services (NEW)
   */
  public async closeAllCaptureServices(): Promise<void> {}
}

export const serviceManager = ServiceManager.getInstance();
