// services/s3Service.ts - Updated with Real AWS Integration
export interface UploadConfig {
  bucketName: string;
  region: string;
  apiBaseUrl: string;
  maxFileSize?: number;
  allowedTypes?: string[];
  enableMockMode?: boolean;
}

export interface PresignedUrlRequest {
  fileName: string;
  fileType: string;
  caseId: string;
  captureType: 'screenshot' | 'video';
  fileSize?: number;
  userId?: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  fileName: string;
  key: string;
  expiresIn: number;
  uploadId?: string;
  fields?: Record<string, string>; // For POST uploads
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed?: number; // bytes per second
  timeRemaining?: number; // seconds
  status: 'uploading' | 'completed' | 'failed' | 'cancelled';
}

export interface UploadResult {
  success: boolean;
  fileUrl?: string;
  fileName?: string;
  fileKey?: string;
  fileSize?: number;
  uploadTime?: number;
  uploadId?: string;
  error?: string;
}

export interface FileMetadata {
  id: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  fileKey: string;
  fileSize: number;
  fileType: string;
  caseId: string;
  captureType: 'screenshot' | 'video';
  uploadedAt: string;
  uploadedBy: string;
  checksum?: string;
  thumbnailUrl?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UploadStats {
  totalFiles: number;
  totalSize: number;
  byType: Record<string, number>;
  byCase: Record<string, number>;
  successRate: number;
  averageUploadTime: number;
  recentUploads: FileMetadata[];
  quotaUsed: number;
  quotaLimit: number;
}

export class S3Service {
  private static instance: S3Service;
  private config: UploadConfig | null = null;
  private uploadQueue: Map<string, UploadProgress> = new Map();
  private uploadHistory: FileMetadata[] = [];
  private maxRetries: number = 3;
  private chunkSize: number = 5 * 1024 * 1024; // 5MB chunks for multipart upload
  private isInitialized: boolean = false;

  private constructor() {
    this.loadUploadHistory();
  }

  public static getInstance(): S3Service {
    if (!S3Service.instance) {
      S3Service.instance = new S3Service();
    }
    return S3Service.instance;
  }

  /**
   * Initialize S3 service with configuration
   */
  async initialize(config: UploadConfig): Promise<{ success: boolean; error?: string }> {
    try {
      this.config = {
        maxFileSize: 100 * 1024 * 1024, // 100MB default
        allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'video/webm', 'video/mp4'],
        enableMockMode: false,
        ...config
      };

      // Test connection if not in mock mode
      if (!this.config.enableMockMode) {
        const testResult = await this.testConnection();
        if (!testResult.success) {
          return { success: false, error: testResult.error };
        }
      }

      this.isInitialized = true;
      console.log(`S3 Service initialized for bucket: ${config.bucketName} (Mock: ${this.config.enableMockMode})`);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to initialize S3 Service: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Test connection to backend API
   */
  private async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.config!.apiBaseUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data = await response.json();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: `Backend connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Get presigned URL for file upload
   */
  async getPresignedUrl(request: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    this.ensureInitialized();

    if (this.config!.enableMockMode) {
      return this.getMockPresignedUrl(request);
    }

    try {
      const requestBody = {
        ...request,
        userId: this.getCurrentUser(),
        bucketName: this.config!.bucketName,
        region: this.config!.region
      };

      const response = await fetch(`${this.config!.apiBaseUrl}/upload/presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get presigned URL:', error);
      throw new Error(`Failed to get upload URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload single file with progress tracking
   */
  async uploadFile(
    file: Blob,
    fileName: string,
    caseId: string,
    captureType: 'screenshot' | 'video',
    options: {
      onProgress?: (progress: UploadProgress) => void;
      onSuccess?: (result: UploadResult) => void;
      onError?: (error: string) => void;
      tags?: string[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<UploadResult> {
    const startTime = Date.now();
    const uploadId = this.generateUploadId();

    try {
      // Validate file
      const validation = this.validateFile(file, captureType);
      if (!validation.isValid) {
        const error = validation.errors.join(', ');
        options.onError?.(error);
        return { success: false, error, uploadId };
      }

      // Initialize progress
      const initialProgress: UploadProgress = {
        loaded: 0,
        total: file.size,
        percentage: 0,
        status: 'uploading'
      };
      this.uploadQueue.set(uploadId, initialProgress);
      options.onProgress?.(initialProgress);

      // Get presigned URL
      const presignedRequest: PresignedUrlRequest = {
        fileName: this.sanitizeFileName(fileName),
        fileType: file.type,
        caseId,
        captureType,
        fileSize: file.size,
        userId: this.getCurrentUser()
      };

      const presignedResponse = await this.getPresignedUrl(presignedRequest);

      // Upload file
      const uploadResult = await this.performUpload(
        file,
        presignedResponse,
        uploadId,
        options.onProgress
      );

      if (uploadResult.success) {
        // Save metadata
        const metadata: FileMetadata = {
          id: uploadId,
          fileName: presignedResponse.fileName,
          originalName: fileName,
          fileUrl: presignedResponse.fileUrl,
          fileKey: presignedResponse.key,
          fileSize: file.size,
          fileType: file.type,
          caseId,
          captureType,
          uploadedAt: new Date().toISOString(),
          uploadedBy: this.getCurrentUser(),
          checksum: await this.calculateChecksum(file),
          tags: options.tags,
          metadata: options.metadata
        };

        await this.saveFileMetadata(metadata);

        // Update progress to completed
        const completedProgress: UploadProgress = {
          loaded: file.size,
          total: file.size,
          percentage: 100,
          status: 'completed'
        };
        this.uploadQueue.set(uploadId, completedProgress);
        options.onProgress?.(completedProgress);

        const finalResult = {
          success: true,
          fileUrl: presignedResponse.fileUrl,
          fileName: presignedResponse.fileName,
          fileKey: presignedResponse.key,
          fileSize: file.size,
          uploadTime: Date.now() - startTime,
          uploadId
        };

        options.onSuccess?.(finalResult);
        return finalResult;
      }

      // Update progress to failed
      const failedProgress: UploadProgress = {
        loaded: 0,
        total: file.size,
        percentage: 0,
        status: 'failed'
      };
      this.uploadQueue.set(uploadId, failedProgress);
      options.onProgress?.(failedProgress);

      options.onError?.(uploadResult.error || 'Upload failed');
      return uploadResult;

    } catch (error) {
      const errorMessage = `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      // Update progress to failed
      const failedProgress: UploadProgress = {
        loaded: 0,
        total: file.size,
        percentage: 0,
        status: 'failed'
      };
      this.uploadQueue.set(uploadId, failedProgress);
      options.onProgress?.(failedProgress);

      options.onError?.(errorMessage);
      return { success: false, error: errorMessage, uploadId };
    } finally {
      // Keep progress for 5 seconds then remove
      setTimeout(() => {
        this.uploadQueue.delete(uploadId);
      }, 5000);
    }
  }

  /**
   * Perform actual file upload with retry logic
   */
  private async performUpload(
    file: Blob,
    presignedResponse: PresignedUrlResponse,
    uploadId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (this.config!.enableMockMode) {
          return await this.mockUpload(file, uploadId, onProgress);
        }

        // Determine upload method based on file size
        if (file.size > this.chunkSize && presignedResponse.uploadId) {
          return await this.multipartUpload(file, presignedResponse, uploadId, onProgress);
        } else {
          return await this.simpleUpload(file, presignedResponse, uploadId, onProgress);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Upload attempt ${attempt} failed:`, lastError.message);

        if (attempt < this.maxRetries) {
          // Exponential backoff with jitter
          const baseDelay = Math.pow(2, attempt - 1) * 1000;
          const jitter = Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
        }
      }
    }

    return {
      success: false,
      error: `Upload failed after ${this.maxRetries} attempts: ${lastError?.message}`,
      uploadId
    };
  }

  /**
   * Simple upload for smaller files
   */
  private async simpleUpload(
    file: Blob,
    presignedResponse: PresignedUrlResponse,
    uploadId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = elapsed > 0 ? event.loaded / elapsed : 0;
          const timeRemaining = speed > 0 ? (event.total - event.loaded) / speed : 0;

          const progress: UploadProgress = {
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
            speed,
            timeRemaining,
            status: 'uploading'
          };

          this.uploadQueue.set(uploadId, progress);
          onProgress(progress);
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            success: true,
            fileUrl: presignedResponse.fileUrl,
            fileName: presignedResponse.fileName,
            fileKey: presignedResponse.key,
            fileSize: file.size,
            uploadTime: Date.now() - startTime,
            uploadId
          });
        } else {
          resolve({
            success: false,
            error: `Upload failed with status: ${xhr.status}`,
            uploadId
          });
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        resolve({
          success: false,
          error: 'Network error during upload',
          uploadId
        });
      });

      // Handle timeout
      xhr.addEventListener('timeout', () => {
        resolve({
          success: false,
          error: 'Upload timeout',
          uploadId
        });
      });

      // Handle abort
      xhr.addEventListener('abort', () => {
        resolve({
          success: false,
          error: 'Upload cancelled',
          uploadId
        });
      });

      // Configure upload
      if (presignedResponse.fields) {
        // POST upload with form data
        const formData = new FormData();
        Object.entries(presignedResponse.fields).forEach(([key, value]) => {
          formData.append(key, value);
        });
        formData.append('file', file);

        xhr.open('POST', presignedResponse.uploadUrl);
        xhr.timeout = 10 * 60 * 1000; // 10 minutes timeout
        xhr.send(formData);
      } else {
        // PUT upload
        xhr.open('PUT', presignedResponse.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.timeout = 10 * 60 * 1000; // 10 minutes timeout
        xhr.send(file);
      }

      // Store xhr reference for potential cancellation
      (this.uploadQueue.get(uploadId) as any)._xhr = xhr;
    });
  }

  /**
   * Multipart upload for larger files
   */
  private async multipartUpload(
    file: Blob,
    presignedResponse: PresignedUrlResponse,
    uploadId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    // For now, fall back to simple upload as multipart requires more complex backend setup
    // TODO: Implement full multipart upload with backend support
    console.log('Multipart upload requested, falling back to simple upload for now');
    return this.simpleUpload(file, presignedResponse, uploadId, onProgress);
  }

  /**
   * Upload individual chunk (for future multipart implementation)
   */
  private async uploadChunk(chunk: Blob, uploadUrl: string): Promise<{ success: boolean; etag?: string; error?: string }> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader('ETag');
          resolve({
            success: true,
            etag: etag || undefined
          });
        } else {
          resolve({
            success: false,
            error: `Chunk upload failed with status: ${xhr.status}`
          });
        }
      });

      xhr.addEventListener('error', () => {
        resolve({
          success: false,
          error: 'Network error during chunk upload'
        });
      });

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', chunk.type);
      xhr.send(chunk);
    });
  }

  /**
   * Mock upload for development
   */
  private async mockUpload(
    file: Blob,
    uploadId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const steps = 20;
    const stepDelay = 50 + Math.random() * 100; // 50-150ms per step
    const startTime = Date.now();

    for (let i = 0; i <= steps; i++) {
      // Check if upload was cancelled
      const currentProgress = this.uploadQueue.get(uploadId);
      if (currentProgress?.status === 'cancelled') {
        return {
          success: false,
          error: 'Upload cancelled',
          uploadId
        };
      }

      await new Promise(resolve => setTimeout(resolve, stepDelay));

      if (onProgress) {
        const elapsed = (Date.now() - startTime) / 1000;
        const loaded = (file.size * i) / steps;
        const speed = elapsed > 0 ? loaded / elapsed : 0;
        const timeRemaining = speed > 0 ? (file.size - loaded) / speed : 0;

        const progress: UploadProgress = {
          loaded,
          total: file.size,
          percentage: Math.round((i / steps) * 100),
          speed,
          timeRemaining,
          status: 'uploading'
        };

        this.uploadQueue.set(uploadId, progress);
        onProgress(progress);
      }
    }

    return {
      success: true,
      fileUrl: `https://mock-bucket.s3.amazonaws.com/cases/${Date.now()}/mock-file-${uploadId}.png`,
      fileName: `mock-file-${uploadId}.png`,
      fileKey: `cases/${Date.now()}/mock-file-${uploadId}.png`,
      fileSize: file.size,
      uploadTime: Date.now() - startTime,
      uploadId
    };
  }

  /**
   * Cancel upload by ID
   */
  cancelUpload(uploadId: string): boolean {
    const progress = this.uploadQueue.get(uploadId);
    if (progress && progress.status === 'uploading') {
      // Cancel XHR if available
      const xhr = (progress as any)._xhr;
      if (xhr) {
        xhr.abort();
      }

      // Update status
      this.uploadQueue.set(uploadId, {
        ...progress,
        status: 'cancelled'
      });

      return true;
    }
    return false;
  }

  /**
   * Delete file from S3
   */
  async deleteFile(fileKey: string, caseId: string): Promise<{ success: boolean; error?: string }> {
    this.ensureInitialized();

    if (this.config!.enableMockMode) {
      console.log(`Mock: Deleted file ${fileKey} from case ${caseId}`);
      return { success: true };
    }

    try {
      const response = await fetch(`${this.config!.apiBaseUrl}/upload/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ fileKey, caseId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Delete failed: ${response.status}`);
      }

      // Remove from local history
      this.uploadHistory = this.uploadHistory.filter(f => f.fileKey !== fileKey);
      await this.saveUploadHistory();

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Get upload statistics
   */
  async getUploadStats(caseId?: string): Promise<UploadStats> {
    const relevantFiles = caseId 
      ? this.uploadHistory.filter(f => f.caseId === caseId)
      : this.uploadHistory;

    const stats: UploadStats = {
      totalFiles: relevantFiles.length,
      totalSize: relevantFiles.reduce((sum, f) => sum + f.fileSize, 0),
      byType: {
        screenshot: relevantFiles.filter(f => f.captureType === 'screenshot').length,
        video: relevantFiles.filter(f => f.captureType === 'video').length
      },
      byCase: {},
      successRate: 100, // TODO: Calculate from actual success/failure rates
      averageUploadTime: 2500, // TODO: Calculate from actual upload times
      recentUploads: relevantFiles
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
        .slice(0, 10),
      quotaUsed: relevantFiles.reduce((sum, f) => sum + f.fileSize, 0),
      quotaLimit: this.config?.maxFileSize ? this.config.maxFileSize * 1000 : 0 // Rough quota estimate
    };

    // Calculate by case
    relevantFiles.forEach(file => {
      stats.byCase[file.caseId] = (stats.byCase[file.caseId] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get current upload queue status
   */
  getUploadQueue(): Map<string, UploadProgress> {
    return new Map(this.uploadQueue);
  }

  /**
   * Utility methods
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.config) {
      throw new Error('S3 Service not initialized. Call initialize() first.');
    }
  }

  private generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }

  private validateFile(file: Blob, captureType: 'screenshot' | 'video'): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config) {
      errors.push('Service not initialized');
      return { isValid: false, errors };
    }

    // Check file size
    if (file.size > this.config.maxFileSize!) {
      const maxSizeMB = this.config.maxFileSize! / (1024 * 1024);
      errors.push(`File size exceeds ${maxSizeMB}MB limit`);
    }

    // Check file type
    if (!this.config.allowedTypes!.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`);
    }

    // Check minimum size
    if (file.size < 1024) {
      errors.push('File is too small (minimum 1KB)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private getMockPresignedUrl(request: PresignedUrlRequest): PresignedUrlResponse {
    const fileName = this.sanitizeFileName(request.fileName);
    const key = `cases/${request.caseId}/${request.captureType}/${fileName}`;
    
    return {
      uploadUrl: `https://mock-bucket.s3.amazonaws.com/upload`,
      fileUrl: `https://mock-bucket.s3.amazonaws.com/${key}`,
      fileName,
      key,
      expiresIn: 3600, // 1 hour
      fields: {
        key,
        'Content-Type': request.fileType,
        policy: 'mock-policy',
        'x-amz-signature': 'mock-signature'
      }
    };
  }

  private async calculateChecksum(file: Blob): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      // Fallback for older browsers
      return `fallback_${file.size}_${Date.now()}`;
    }
  }

  private async saveFileMetadata(metadata: FileMetadata): Promise<void> {
    this.uploadHistory.unshift(metadata);
    
    // Keep only last 100 files in memory
    if (this.uploadHistory.length > 100) {
      this.uploadHistory = this.uploadHistory.slice(0, 100);
    }

    await this.saveUploadHistory();
  }

  private async saveUploadHistory(): Promise<void> {
    try {
      const data = { 
        uploadHistory: this.uploadHistory, 
        lastUpdated: new Date().toISOString() 
      };
      
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        await chrome.storage.local.set({ s3UploadHistory: data });
      } else {
        localStorage.setItem('s3UploadHistory', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Failed to save upload history:', error);
    }
  }

  private async loadUploadHistory(): Promise<void> {
    try {
      let data = null;

      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        const result = await chrome.storage.local.get(['s3UploadHistory']);
        data = result.s3UploadHistory;
      } else {
        const stored = localStorage.getItem('s3UploadHistory');
        if (stored) {
          data = JSON.parse(stored);
        }
      }

      if (data && Array.isArray(data.uploadHistory)) {
        this.uploadHistory = data.uploadHistory;
      }
    } catch (error) {
      console.error('Failed to load upload history:', error);
    }
  }

  private getCurrentUser(): string {
    // TODO: Get from auth service
    return 'demo';
  }

  private getAuthToken(): string {
    // TODO: Get from auth service
    return 'mock-auth-token';
  }

  /**
   * Set mock mode (for testing)
   */
  setMockMode(enabled: boolean): void {
    if (this.config) {
      this.config.enableMockMode = enabled;
      console.log(`S3 Service mock mode: ${enabled ? 'enabled' : 'disabled'}`);
    }
  }
}

// Export singleton instance
export const s3Service = S3Service.getInstance();