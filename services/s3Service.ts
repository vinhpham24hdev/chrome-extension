// services/s3Service.ts
export interface UploadConfig {
  bucketName: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
}

export interface PresignedUrlRequest {
  fileName: string;
  fileType: string;
  caseId: string;
  captureType: 'screenshot' | 'video';
  fileSize?: number;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  fileName: string;
  expiresIn: number;
  uploadId?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed?: number; // bytes per second
  timeRemaining?: number; // seconds
}

export interface UploadResult {
  success: boolean;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  uploadTime?: number;
  error?: string;
}

export interface FileMetadata {
  id: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  caseId: string;
  captureType: 'screenshot' | 'video';
  uploadedAt: string;
  uploadedBy: string;
  checksum?: string;
  thumbnailUrl?: string;
}

export interface UploadStats {
  totalFiles: number;
  totalSize: number;
  byType: Record<string, number>;
  byCase: Record<string, number>;
  successRate: number;
  averageUploadTime: number;
  recentUploads: FileMetadata[];
}

export class S3Service {
  private static instance: S3Service;
  private config: UploadConfig | null = null;
  private apiBaseUrl: string = 'https://api.example.com/v1';
  private mockMode: boolean = true; // Set to false when real API is ready
  private uploadQueue: Map<string, UploadProgress> = new Map();
  private uploadHistory: FileMetadata[] = [];
  private maxRetries: number = 3;
  private chunkSize: number = 5 * 1024 * 1024; // 5MB chunks for multipart upload

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
  initialize(config: UploadConfig): void {
    this.config = config;
    console.log(`S3 Service initialized for bucket: ${config.bucketName}`);
  }

  /**
   * Get presigned URL for file upload
   */
  async getPresignedUrl(request: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    if (this.mockMode) {
      return this.getMockPresignedUrl(request);
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/upload/presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get presigned URL:', error);
      throw error;
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
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const startTime = Date.now();
    const uploadId = this.generateUploadId();

    try {
      // Validate file
      const validation = this.validateFile(file, captureType);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      // Get presigned URL
      const presignedRequest: PresignedUrlRequest = {
        fileName,
        fileType: file.type,
        caseId,
        captureType,
        fileSize: file.size
      };

      const presignedResponse = await this.getPresignedUrl(presignedRequest);

      // Upload file
      const uploadResult = await this.performUpload(
        file,
        presignedResponse,
        uploadId,
        onProgress
      );

      if (uploadResult.success) {
        // Save metadata
        const metadata: FileMetadata = {
          id: uploadId,
          fileName: presignedResponse.fileName,
          originalName: fileName,
          fileUrl: presignedResponse.fileUrl,
          fileSize: file.size,
          fileType: file.type,
          caseId,
          captureType,
          uploadedAt: new Date().toISOString(),
          uploadedBy: this.getCurrentUser(),
          checksum: await this.calculateChecksum(file)
        };

        await this.saveFileMetadata(metadata);

        return {
          success: true,
          fileUrl: presignedResponse.fileUrl,
          fileName: presignedResponse.fileName,
          fileSize: file.size,
          uploadTime: Date.now() - startTime
        };
      }

      return uploadResult;
    } catch (error) {
      return {
        success: false,
        error: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    } finally {
      this.uploadQueue.delete(uploadId);
    }
  }

  /**
   * Upload multiple files with concurrent processing
   */
  async uploadMultipleFiles(
    files: Array<{
      file: Blob;
      fileName: string;
      caseId: string;
      captureType: 'screenshot' | 'video';
    }>,
    options: {
      concurrency?: number;
      onProgress?: (fileIndex: number, progress: UploadProgress) => void;
      onFileComplete?: (fileIndex: number, result: UploadResult) => void;
      onAllComplete?: (results: UploadResult[]) => void;
    } = {}
  ): Promise<UploadResult[]> {
    const { concurrency = 3 } = options;
    const results: UploadResult[] = new Array(files.length);
    const queue = [...files.map((file, index) => ({ ...file, index }))];
    const activeUploads = new Set<Promise<void>>();

    const processUpload = async (fileData: typeof queue[0]) => {
      const { file, fileName, caseId, captureType, index } = fileData;

      const result = await this.uploadFile(
        file,
        fileName,
        caseId,
        captureType,
        (progress) => options.onProgress?.(index, progress)
      );

      results[index] = result;
      options.onFileComplete?.(index, result);
    };

    while (queue.length > 0 || activeUploads.size > 0) {
      // Start new uploads if under concurrency limit
      while (queue.length > 0 && activeUploads.size < concurrency) {
        const fileData = queue.shift()!;
        const uploadPromise = processUpload(fileData).finally(() => {
          activeUploads.delete(uploadPromise);
        });
        activeUploads.add(uploadPromise);
      }

      // Wait for at least one upload to complete
      if (activeUploads.size > 0) {
        await Promise.race(activeUploads);
      }
    }

    options.onAllComplete?.(results);
    return results;
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
        if (this.mockMode) {
          return await this.mockUpload(file, uploadId, onProgress);
        }

        // Determine upload method based on file size
        if (file.size > this.chunkSize) {
          return await this.multipartUpload(file, presignedResponse, uploadId, onProgress);
        } else {
          return await this.simpleUpload(file, presignedResponse, uploadId, onProgress);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Upload attempt ${attempt} failed:`, lastError.message);

        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: `Upload failed after ${this.maxRetries} attempts: ${lastError?.message}`
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
            timeRemaining
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
            fileSize: file.size,
            uploadTime: Date.now() - startTime
          });
        } else {
          resolve({
            success: false,
            error: `Upload failed with status: ${xhr.status}`
          });
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        resolve({
          success: false,
          error: 'Network error during upload'
        });
      });

      // Handle timeout
      xhr.addEventListener('timeout', () => {
        resolve({
          success: false,
          error: 'Upload timeout'
        });
      });

      // Configure and start upload
      xhr.open('PUT', presignedResponse.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.timeout = 5 * 60 * 1000; // 5 minutes timeout
      xhr.send(file);
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
    // For mock mode, fall back to simple upload
    if (this.mockMode) {
      return this.simpleUpload(file, presignedResponse, uploadId, onProgress);
    }

    const chunks = Math.ceil(file.size / this.chunkSize);
    const uploadParts: Array<{ partNumber: number; etag: string }> = [];
    let totalUploaded = 0;
    const startTime = Date.now();

    try {
      // Initialize multipart upload
      const initResponse = await fetch(`${this.apiBaseUrl}/upload/multipart/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          fileName: presignedResponse.fileName,
          fileType: file.type,
          uploadId: presignedResponse.uploadId
        })
      });

      if (!initResponse.ok) {
        throw new Error('Failed to initialize multipart upload');
      }

      const { multipartUploadId } = await initResponse.json();

      // Upload each chunk
      for (let i = 0; i < chunks; i++) {
        const start = i * this.chunkSize;
        const end = Math.min(start + this.chunkSize, file.size);
        const chunk = file.slice(start, end);
        const partNumber = i + 1;

        // Get presigned URL for this part
        const partUrlResponse = await fetch(`${this.apiBaseUrl}/upload/multipart/part`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getAuthToken()}`
          },
          body: JSON.stringify({
            multipartUploadId,
            partNumber
          })
        });

        if (!partUrlResponse.ok) {
          throw new Error(`Failed to get presigned URL for part ${partNumber}`);
        }

        const { uploadUrl } = await partUrlResponse.json();

        // Upload the chunk
        const partResult = await this.uploadChunk(chunk, uploadUrl);
        if (!partResult.success) {
          throw new Error(`Failed to upload part ${partNumber}: ${partResult.error}`);
        }

        uploadParts.push({
          partNumber,
          etag: partResult.etag!
        });

        totalUploaded += chunk.size;

        // Update progress
        if (onProgress) {
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = elapsed > 0 ? totalUploaded / elapsed : 0;
          const timeRemaining = speed > 0 ? (file.size - totalUploaded) / speed : 0;

          const progress: UploadProgress = {
            loaded: totalUploaded,
            total: file.size,
            percentage: Math.round((totalUploaded / file.size) * 100),
            speed,
            timeRemaining
          };

          this.uploadQueue.set(uploadId, progress);
          onProgress(progress);
        }
      }

      // Complete multipart upload
      const completeResponse = await fetch(`${this.apiBaseUrl}/upload/multipart/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          multipartUploadId,
          parts: uploadParts
        })
      });

      if (!completeResponse.ok) {
        throw new Error('Failed to complete multipart upload');
      }

      return {
        success: true,
        fileUrl: presignedResponse.fileUrl,
        fileName: presignedResponse.fileName,
        fileSize: file.size,
        uploadTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Multipart upload failed'
      };
    }
  }

  /**
   * Upload individual chunk
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
    const stepDelay = 100;
    const startTime = Date.now();

    for (let i = 0; i <= steps; i++) {
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
          timeRemaining
        };

        this.uploadQueue.set(uploadId, progress);
        onProgress(progress);
      }
    }

    return {
      success: true,
      fileUrl: `https://mock-bucket.s3.amazonaws.com/mock-file-${uploadId}.png`,
      fileName: `mock-file-${uploadId}.png`,
      fileSize: file.size,
      uploadTime: Date.now() - startTime
    };
  }

  /**
   * Delete file from S3
   */
  async deleteFile(fileUrl: string, caseId: string): Promise<boolean> {
    if (this.mockMode) {
      console.log(`Mock: Deleted file ${fileUrl} from case ${caseId}`);
      return true;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/upload/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ fileUrl, caseId })
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
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
      successRate: 100, // Mock data - in real app calculate from actual success/failure rates
      averageUploadTime: 2500, // Mock data - 2.5 seconds average
      recentUploads: relevantFiles
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
        .slice(0, 10)
    };

    // Calculate by case
    relevantFiles.forEach(file => {
      stats.byCase[file.caseId] = (stats.byCase[file.caseId] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get file metadata by URL or ID
   */
  async getFileMetadata(identifier: string): Promise<FileMetadata | null> {
    return this.uploadHistory.find(f => f.id === identifier || f.fileUrl === identifier) || null;
  }

  /**
   * Get files for a specific case
   */
  async getCaseFiles(caseId: string): Promise<FileMetadata[]> {
    return this.uploadHistory.filter(f => f.caseId === caseId);
  }

  /**
   * Generate thumbnail for image files
   */
  async generateThumbnail(file: Blob, maxSize: number = 200): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('File is not an image'));
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Validate file before upload
   */
  validateFile(file: Blob, captureType: 'screenshot' | 'video'): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    const maxSizes = {
      screenshot: 10 * 1024 * 1024, // 10MB
      video: 100 * 1024 * 1024 // 100MB
    };

    const allowedTypes = {
      screenshot: ['image/png', 'image/jpeg', 'image/webp'],
      video: ['video/webm', 'video/mp4', 'video/mov', 'video/avi']
    };

    // Check file size
    if (file.size > maxSizes[captureType]) {
      const maxSizeMB = maxSizes[captureType] / (1024 * 1024);
      errors.push(`File size exceeds ${maxSizeMB}MB limit`);
    }

    // Check file type
    if (!allowedTypes[captureType].includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed for ${captureType}`);
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

  /**
   * Get current upload queue status
   */
  getUploadQueue(): Map<string, UploadProgress> {
    return new Map(this.uploadQueue);
  }

  /**
   * Cancel upload by ID
   */
  cancelUpload(uploadId: string): boolean {
    if (this.uploadQueue.has(uploadId)) {
      this.uploadQueue.delete(uploadId);
      return true;
    }
    return false;
  }

  /**
   * Private helper methods
   */
  private generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFileName(originalName: string, caseId: string, captureType: 'screenshot' | 'video'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = originalName.split('.').pop() || (captureType === 'screenshot' ? 'png' : 'webm');
    return `${captureType}-${caseId}-${timestamp}.${extension}`;
  }

  private getMockPresignedUrl(request: PresignedUrlRequest): PresignedUrlResponse {
    const fileName = this.generateFileName(request.fileName, request.caseId, request.captureType);
    const uploadId = this.generateUploadId();

    return {
      uploadUrl: `https://mock-bucket.s3.amazonaws.com/upload/${fileName}?signature=mock-signature`,
      fileUrl: `https://mock-bucket.s3.amazonaws.com/cases/${request.caseId}/${fileName}`,
      fileName,
      expiresIn: 3600, // 1 hour
      uploadId
    };
  }

  private async calculateChecksum(file: Blob): Promise<string> {
    // Simple mock checksum - in real app use crypto.subtle.digest
    return `md5_${file.size}_${Date.now()}`;
  }

  private async saveFileMetadata(metadata: FileMetadata): Promise<void> {
    this.uploadHistory.unshift(metadata);
    
    // Keep only last 100 files in memory
    if (this.uploadHistory.length > 100) {
      this.uploadHistory = this.uploadHistory.slice(0, 100);
    }

    // Save to storage
    try {
      const data = { uploadHistory: this.uploadHistory, lastUpdated: new Date().toISOString() };
      
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
    // In real app, get from auth service
    return 'demo';
  }

  private getAuthToken(): string {
    // In real app, get from auth service
    return 'mock-auth-token';
  }

  /**
   * Set mock mode
   */
  setMockMode(enabled: boolean): void {
    this.mockMode = enabled;
    console.log(`S3 Service mock mode: ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Export singleton instance
export const s3Service = S3Service.getInstance();