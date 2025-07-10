// services/s3Service.ts - Real S3 Upload Service
export interface UploadProgress {
  percentage: number;
  loaded: number;
  total: number;
  speed?: number; // bytes per second
  timeRemaining?: number; // seconds
}

export interface UploadResult {
  success: boolean;
  fileUrl?: string;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
  uploadTime?: number;
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  onSuccess?: (result: UploadResult) => void;
  onError?: (error: string) => void;
  tags?: string[];
  metadata?: Record<string, any>;
  timeout?: number;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  fileName: string;
  key: string;
  expiresIn: number;
  method: 'PUT' | 'POST';
  fields?: Record<string, string>;
  headers?: Record<string, string>;
  fileId: string;
  metadata: {
    caseId: string;
    captureType: string;
    userId: string;
  };
}

class S3Service {
  private apiBaseUrl: string;
  private authToken: string | null = null;

  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    this.loadAuthToken();
  }

  // Load auth token from storage
  private loadAuthToken(): void {
    try {
      // Try Chrome storage first
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['authState'], (result) => {
          if (result.authState?.token) {
            this.authToken = result.authState.token;
          }
        });
      } else {
        // Fallback to localStorage
        const authState = localStorage.getItem('authState');
        if (authState) {
          const parsed = JSON.parse(authState);
          this.authToken = parsed.token;
        }
      }
    } catch (error) {
      console.warn('Failed to load auth token:', error);
    }
  }

  // Set auth token
  public setAuthToken(token: string): void {
    this.authToken = token;
  }

  // API request helper with auth
  private async apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  // Get presigned URL from backend
  private async getPresignedUrl(
    fileName: string,
    fileType: string,
    caseId: string,
    captureType: 'screenshot' | 'video',
    fileSize?: number
  ): Promise<PresignedUrlResponse> {
    console.log('🔗 Getting presigned URL from backend...');

    const response = await this.apiRequest('/upload/presigned-url', {
      method: 'POST',
      body: JSON.stringify({
        fileName,
        fileType,
        caseId,
        captureType,
        fileSize,
        uploadMethod: 'PUT' // Use PUT method for direct upload
      }),
    });

    const result = await response.json();
    console.log('✅ Presigned URL received:', {
      key: result.key,
      expiresIn: result.expiresIn,
      method: result.method
    });

    return result;
  }

  // Confirm upload completion to backend
  private async confirmUpload(
    fileId: string,
    fileKey: string,
    actualFileSize: number,
    checksum?: string
  ): Promise<void> {
    console.log('✅ Confirming upload with backend...');

    await this.apiRequest('/upload/confirm', {
      method: 'POST',
      body: JSON.stringify({
        fileId,
        fileKey,
        actualFileSize,
        checksum,
        uploadMethod: 'PUT'
      }),
    });

    console.log('✅ Upload confirmed with backend');
  }

  // Upload file to S3 using presigned URL
  public async uploadFile(
    file: Blob,
    fileName: string,
    caseId: string,
    captureType: 'screenshot' | 'video',
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const startTime = Date.now();
    let lastProgressTime = startTime;
    let lastLoaded = 0;

    try {
      console.log('🚀 Starting S3 upload:', {
        fileName,
        fileSize: file.size,
        fileType: file.type,
        caseId,
        captureType
      });

      // Step 1: Get presigned URL from backend
      const presignedData = await this.getPresignedUrl(
        fileName,
        file.type,
        caseId,
        captureType,
        file.size
      );

      // Step 2: Upload to S3 using presigned URL
      console.log('📤 Uploading to S3...');

      const uploadPromise = new Promise<UploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && options.onProgress) {
            const currentTime = Date.now();
            const timeDiff = (currentTime - lastProgressTime) / 1000; // seconds
            const bytesDiff = event.loaded - lastLoaded;
            
            let speed = 0;
            let timeRemaining = 0;
            
            if (timeDiff > 0) {
              speed = bytesDiff / timeDiff; // bytes per second
              if (speed > 0) {
                timeRemaining = (event.total - event.loaded) / speed;
              }
            }

            const progress: UploadProgress = {
              percentage: Math.round((event.loaded / event.total) * 100),
              loaded: event.loaded,
              total: event.total,
              speed: speed > 0 ? speed : undefined,
              timeRemaining: timeRemaining > 0 ? timeRemaining : undefined,
            };

            options.onProgress(progress);

            lastProgressTime = currentTime;
            lastLoaded = event.loaded;
          }
        });

        // Handle upload completion
        xhr.addEventListener('load', async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              // Step 3: Confirm upload with backend
              await this.confirmUpload(
                presignedData.fileId,
                presignedData.key,
                file.size
              );

              const uploadTime = Date.now() - startTime;
              const result: UploadResult = {
                success: true,
                fileUrl: presignedData.fileUrl,
                fileKey: presignedData.key,
                fileName: fileName,
                fileSize: file.size,
                uploadTime,
              };

              console.log('🎉 Upload completed successfully:', {
                fileKey: result.fileKey,
                uploadTime: `${uploadTime}ms`,
                fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`
              });

              options.onSuccess?.(result);
              resolve(result);
            } catch (confirmError) {
              console.error('❌ Upload confirmation failed:', confirmError);
              const errorMessage = confirmError instanceof Error ? confirmError.message : 'Upload confirmation failed';
              options.onError?.(errorMessage);
              reject(new Error(errorMessage));
            }
          } else {
            const errorMessage = `Upload failed with status ${xhr.status}: ${xhr.statusText}`;
            console.error('❌ S3 upload failed:', errorMessage);
            options.onError?.(errorMessage);
            reject(new Error(errorMessage));
          }
        });

        // Handle upload error
        xhr.addEventListener('error', () => {
          const errorMessage = 'Network error during upload';
          console.error('❌ Upload network error');
          options.onError?.(errorMessage);
          reject(new Error(errorMessage));
        });

        // Handle upload timeout
        xhr.addEventListener('timeout', () => {
          const errorMessage = 'Upload timeout';
          console.error('❌ Upload timeout');
          options.onError?.(errorMessage);
          reject(new Error(errorMessage));
        });

        // Configure request
        xhr.open('PUT', presignedData.uploadUrl);
        xhr.timeout = options.timeout || 300000; // 5 minutes default

        // Set headers
        if (presignedData.headers) {
          Object.entries(presignedData.headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        }

        // Set content type
        xhr.setRequestHeader('Content-Type', file.type);

        // Start upload
        xhr.send(file);
      });

      return await uploadPromise;

    } catch (error) {
      const uploadTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      
      console.error('❌ Upload failed:', {
        error: errorMessage,
        uploadTime: `${uploadTime}ms`,
        fileName,
        fileSize: file.size
      });

      const result: UploadResult = {
        success: false,
        error: errorMessage,
        uploadTime,
      };

      options.onError?.(errorMessage);
      return result;
    }
  }

  // Delete file from S3
  public async deleteFile(fileKey: string, caseId?: string): Promise<boolean> {
    try {
      console.log('🗑️ Deleting file:', fileKey);

      await this.apiRequest('/upload/file', {
        method: 'DELETE',
        body: JSON.stringify({
          fileKey,
          caseId,
        }),
      });

      console.log('✅ File deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Delete failed:', error);
      throw error;
    }
  }

  // Get download URL for file
  public async getDownloadUrl(
    fileKey: string,
    expiresIn: number = 3600,
    filename?: string
  ): Promise<string> {
    try {
      console.log('🔗 Getting download URL for:', fileKey);

      const params = new URLSearchParams({
        expiresIn: expiresIn.toString(),
        download: 'true',
      });

      if (filename) {
        params.append('filename', filename);
      }

      const response = await this.apiRequest(`/upload/download/${encodeURIComponent(fileKey)}?${params}`);
      const result = await response.json();

      console.log('✅ Download URL generated');
      return result.downloadUrl;
    } catch (error) {
      console.error('❌ Failed to get download URL:', error);
      throw error;
    }
  }

  // Get files for a case
  public async getCaseFiles(
    caseId: string,
    options: {
      captureType?: 'screenshot' | 'video';
      page?: number;
      limit?: number;
      sortBy?: 'name' | 'size' | 'date';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    files: any[];
    pagination: any;
    summary: any;
  }> {
    try {
      console.log('📁 Getting files for case:', caseId);

      const params = new URLSearchParams();
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await this.apiRequest(`/upload/cases/${caseId}/files?${params}`);
      const result = await response.json();

      console.log('✅ Case files retrieved:', {
        totalFiles: result.summary.totalFiles,
        screenshots: result.summary.screenshots,
        videos: result.summary.videos
      });

      return result;
    } catch (error) {
      console.error('❌ Failed to get case files:', error);
      throw error;
    }
  }

  // Get upload statistics
  public async getUploadStats(options: {
    caseId?: string;
    days?: number;
    detailed?: boolean;
  } = {}): Promise<any> {
    try {
      console.log('📊 Getting upload statistics');

      const params = new URLSearchParams();
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await this.apiRequest(`/upload/stats?${params}`);
      const result = await response.json();

      console.log('✅ Upload stats retrieved');
      return result;
    } catch (error) {
      console.error('❌ Failed to get upload stats:', error);
      throw error;
    }
  }

  // Check connection to backend
  public async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error('❌ Backend connection check failed:', error);
      return false;
    }
  }

  // Get storage costs estimation
  public async getStorageCosts(caseId?: string): Promise<any> {
    try {
      console.log('💰 Getting storage costs');

      const params = new URLSearchParams();
      if (caseId) {
        params.append('caseId', caseId);
      }

      const response = await this.apiRequest(`/upload/costs?${params}`);
      const result = await response.json();

      console.log('✅ Storage costs retrieved');
      return result;
    } catch (error) {
      console.error('❌ Failed to get storage costs:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const s3Service = new S3Service();

// Helper function to format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Helper function to format upload speed
export function formatSpeed(bytesPerSecond: number): string {
  return formatFileSize(bytesPerSecond) + '/s';
}

// Helper function to format time remaining
export function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

export default s3Service;