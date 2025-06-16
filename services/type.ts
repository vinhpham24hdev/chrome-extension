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
  fields?: Record<string, string>;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed?: number;
  timeRemaining?: number;
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

// Screenshot service types
export interface ScreenshotOptions {
  type: 'full' | 'visible' | 'region';
  format: 'png' | 'jpeg';
  quality?: number;
}

export interface ScreenshotResult {
  success: boolean;
  dataUrl?: string;
  blob?: Blob;
  filename?: string;
  error?: string;
}

export interface RegionSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenshotData {
  dataUrl: string;
  filename: string;
  timestamp: string;
  type: string;
  caseId: string;
  blob?: Blob;
}

// Service interfaces
export interface IS3Service {
  initialize(config: UploadConfig): Promise<{ success: boolean; error?: string }>;
  uploadFile(
    file: Blob,
    fileName: string,
    caseId: string,
    captureType: 'screenshot' | 'video',
    options?: {
      onProgress?: (progress: UploadProgress) => void;
      onSuccess?: (result: UploadResult) => void;
      onError?: (error: string) => void;
      tags?: string[];
      metadata?: Record<string, any>;
    }
  ): Promise<UploadResult>;
  deleteFile(fileKey: string, caseId: string): Promise<{ success: boolean; error?: string }>;
  getUploadStats(caseId?: string): Promise<UploadStats>;
  getCaseFiles(caseId: string): Promise<FileMetadata[]>;
  getFileMetadata(identifier: string): Promise<FileMetadata | null>;
  getUploadQueue(): Map<string, UploadProgress>;
  cancelUpload(uploadId: string): boolean;
  validateFile(file: Blob, captureType: 'screenshot' | 'video'): { isValid: boolean; errors: string[] };
  generateThumbnail(file: Blob, maxSize?: number): Promise<string>;
  setMockMode(enabled: boolean): void;
}