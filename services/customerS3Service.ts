// services/customerS3Service.ts - Direct S3 Upload to Customer Bucket
import { UploadProgress, UploadResult, UploadOptions } from './s3Service';

interface CustomerS3Config {
  bucketName: string;
  region: string;
  baseUrl: string;
}

class CustomerS3Service {
  private config: CustomerS3Config;

  constructor() {
    this.config = {
      bucketName: import.meta.env.VITE_CUSTOMER_S3_BUCKET || 'proofext',
      region: import.meta.env.VITE_CUSTOMER_S3_REGION || 'us-east-1',
      baseUrl: import.meta.env.VITE_CUSTOMER_S3_BASE_URL || 'https://proofext.s3.amazonaws.com'
    };

    console.log('🔧 Customer S3 Config:', this.config);
  }

  /**
   * Generate file key for customer bucket
   */
  private generateFileKey(caseId: string, captureType: string, fileName: string): string {
    const timestamp = new Date().toISOString().slice(0, 10);
    const uniqueId = Math.random().toString(36).substr(2, 8);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    return `uploads/${caseId}/${captureType}/${timestamp}/${uniqueId}_${sanitizedFileName}`;
  }

  /**
   * Upload file directly to customer S3 bucket
   */
  public async uploadFile(
    file: Blob,
    fileName: string,
    caseId: string,
    captureType: 'screenshot' | 'video',
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const start = Date.now();
    let lastTick = start;
    let lastLoaded = 0;

    try {
      console.log('🚀 Starting direct upload to customer bucket:', {
        bucket: this.config.bucketName,
        fileName,
        size: file.size,
        type: file.type
      });

      // Generate file key
      const fileKey = this.generateFileKey(caseId, captureType, fileName);
      const uploadUrl = `${this.config.baseUrl}/${fileKey}`;

      console.log('📤 Upload URL:', uploadUrl);

      // Upload using XMLHttpRequest for progress tracking
      const result = await new Promise<UploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Progress tracking
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable || !options.onProgress) return;

          const now = Date.now();
          const dt = (now - lastTick) / 1000; // seconds
          const db = e.loaded - lastLoaded; // bytes
          const speed = dt > 0 ? db / dt : 0; // B/s
          const remain = speed > 0 ? (e.total - e.loaded) / speed : 0;

          options.onProgress({
            percentage: Math.round((e.loaded / e.total) * 100),
            loaded: e.loaded,
            total: e.total,
            speed: speed || undefined,
            timeRemaining: remain || undefined,
          });

          lastTick = now;
          lastLoaded = e.loaded;
        };

        // Success handler
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const uploadTime = Date.now() - start;
            const publicUrl = uploadUrl; // Customer bucket might be public

            const result: UploadResult = {
              success: true,
              fileUrl: publicUrl,
              fileKey: fileKey,
              fileName,
              fileSize: file.size,
              uploadTime,
            };

            console.log('✅ Upload successful to customer bucket:', result);
            options.onSuccess?.(result);
            resolve(result);
          } else {
            const msg = `Upload failed (${xhr.status} ${xhr.statusText})`;
            console.error('❌ Upload failed:', msg);
            options.onError?.(msg);
            reject(new Error(msg));
          }
        };

        // Error handlers
        xhr.onerror = () => {
          const msg = 'Network error during upload';
          console.error('❌', msg);
          options.onError?.(msg);
          reject(new Error(msg));
        };

        xhr.ontimeout = () => {
          const msg = 'Upload timeout';
          console.error('❌', msg);
          options.onError?.(msg);
          reject(new Error(msg));
        };

        // Configure request
        xhr.open('PUT', uploadUrl);
        xhr.timeout = options.timeout ?? 300_000; // 5 minutes

        // Set headers as per customer requirements
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.setRequestHeader('x-amz-acl', 'bucket-owner-full-control'); // Required for customer bucket

        // Optional: Add custom metadata
        if (options.metadata) {
          Object.entries(options.metadata).forEach(([key, value]) => {
            xhr.setRequestHeader(`x-amz-meta-${key}`, String(value));
          });
        }

        // Send the file
        xhr.send(file);
      });

      return result;

    } catch (error) {
      const uploadTime = Date.now() - start;
      const message = error instanceof Error ? error.message : 'Unknown upload error';

      console.error('❌ Customer S3 upload error:', error);
      options.onError?.(message);

      return {
        success: false,
        error: message,
        uploadTime
      };
    }
  }

  /**
   * Check connection to customer bucket
   */
  public async checkConnection(): Promise<boolean> {
    try {
      // Simple HEAD request to check bucket accessibility
      const response = await fetch(this.config.baseUrl, {
        method: 'HEAD'
      });

      return response.status < 400;
    } catch (error) {
      console.error('❌ Customer bucket connection check failed:', error);
      return false;
    }
  }

  /**
   * Get bucket configuration
   */
  public getConfig(): CustomerS3Config {
    return { ...this.config };
  }

  /**
   * Test upload with a small file
   */
  public async testUpload(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🧪 Testing upload to customer bucket...');

      // Create a small test file
      const testContent = `Test upload at ${new Date().toISOString()}`;
      const testBlob = new Blob([testContent], { type: 'text/plain' });
      
      const result = await this.uploadFile(
        testBlob,
        'test-upload.txt',
        'test-case',
        'screenshot',
        {
          onProgress: (progress) => {
            console.log(`Test upload progress: ${progress.percentage}%`);
          }
        }
      );

      if (result.success) {
        console.log('✅ Test upload successful:', result.fileUrl);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Test upload failed';
      console.error('❌ Test upload error:', error);
      return { success: false, error: message };
    }
  }
}

// Create singleton instance
export const customerS3Service = new CustomerS3Service();

export default customerS3Service;