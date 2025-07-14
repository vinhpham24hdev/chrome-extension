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
  method: "PUT" | "POST";
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
    this.apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
    this.loadAuthToken();
  }

  // Load auth token from storage
  private loadAuthToken(): void {
    try {
      // Try Chrome storage first
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get(["authState"], (result) => {
          if (result.authState?.token) {
            this.authToken = result.authState.token;
          }
        });
      } else {
        // Fallback to localStorage
        const authState = localStorage.getItem("authState");
        if (authState) {
          const parsed = JSON.parse(authState);
          this.authToken = parsed.token;
        }
      }
    } catch (error) {
      console.warn("Failed to load auth token:", error);
    }
  }

  // Set auth token
  public setAuthToken(token: string): void {
    this.authToken = token;
  }

  // API request helper with auth
  private async apiRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${this.apiBaseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Request failed" }));
      throw new Error(
        error.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response;
  }

  // Get presigned URL from backend
  private async getPresignedUrl(
    fileName: string,
    fileType: string,
    caseId: string,
    captureType: "screenshot" | "video",
    fileSize?: number
  ): Promise<PresignedUrlResponse> {
    console.log("🔗 Getting presigned URL from backend...");
    
    const response = await this.apiRequest("/upload/presigned-url", {
      method: "POST",
      body: JSON.stringify({
        fileName,
        fileType: fileType || fileName.split('.').pop() || "application/octet-stream",
        caseId,
        captureType,
        fileSize,
        uploadMethod: "PUT",
      }),
    });

    const result = await response.json();
    console.log("✅ Presigned URL received:", {
      key: result.key,
      expiresIn: result.expiresIn,
      method: result.method,
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
    console.log("✅ Confirming upload with backend...");

    await this.apiRequest("/upload/confirm", {
      method: "POST",
      body: JSON.stringify({
        fileId,
        fileKey,
        actualFileSize,
        checksum,
        uploadMethod: "PUT",
      }),
    });

    console.log("✅ Upload confirmed with backend");
  }

  /**
   * Upload a file to S3 via presigned URL
   *
   * Assumes:
   * 1. this.getPresignedUrl(...) returns {
   *      uploadUrl: string;   // presigned PUT URL
   *      fileUrl:  string;    // public / presigned GET url (optional)
   *      key:      string;    // object key in S3
   *      fileId:   string;    // internal DB id
   *      headers?: Record<string, string>; // extra headers that were part of the signature
   *    }
   * 2. this.confirmUpload(...) notifies your backend after upload succeeds
   */
  public async uploadFile(
    file: Blob,
    fileName: string,
    caseId: string,
    captureType: "screenshot" | "video",
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const start = Date.now();
    let lastTick = start;
    let lastLoaded = 0;

    try {
      // ──────────────── 1. Presigned URL ────────────────
      const presigned = await this.getPresignedUrl(
        fileName,
        file.type,
        caseId,
        captureType,
        file.size
      );

      // ──────────────── 2. Upload via XHR PUT ────────────────
      const result = await new Promise<UploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // progress
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

        // success
        xhr.onload = async () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            const msg = `Upload failed (${xhr.status} ${xhr.statusText})`;
            options.onError?.(msg);
            return reject(new Error(msg));
          }

          try {
            await this.confirmUpload(
              presigned.fileId,
              presigned.key,
              file.size
            );

            const uploadTime = Date.now() - start;
            const ok: UploadResult = {
              success: true,
              fileUrl: presigned.fileUrl,
              fileKey: presigned.key,
              fileName,
              fileSize: file.size,
              uploadTime,
            };
            options.onSuccess?.(ok);
            resolve(ok);
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : "Upload confirmation failed";
            options.onError?.(msg);
            reject(new Error(msg));
          }
        };

        // network-level failures
        xhr.onerror = () => {
          reject(new Error("Network error during upload"));
        };
        xhr.ontimeout = () => {
          reject(new Error("Upload timeout"));
        };

        // configure request
        xhr.open("PUT", presigned.uploadUrl);
        xhr.timeout = options.timeout ?? 300_000; // 5 min

        // ─── Signed headers from backend ───
        if (presigned.headers) {
          for (const [key, value] of Object.entries(presigned.headers)) {
            xhr.setRequestHeader(key, value);
          }
        }

        if (!presigned.headers?.["Content-Type"] && file.type) {
          xhr.setRequestHeader("Content-Type", file.type);
        }

        if (!presigned.headers?.["x-amz-server-side-encryption"]) {
          xhr.setRequestHeader("x-amz-server-side-encryption", "AES256");
        }

        // send
        xhr.send(file);
      });

      return result;
    } catch (err) {
      const uploadTime = Date.now() - start;
      const message =
        err instanceof Error ? err.message : "Unknown upload error";

      options.onError?.(message);
      return { success: false, error: message, uploadTime };
    }
  }

  // Delete file from S3
  public async deleteFile(fileKey: string, caseId?: string): Promise<boolean> {
    try {
      console.log("🗑️ Deleting file:", fileKey);

      await this.apiRequest("/upload/file", {
        method: "DELETE",
        body: JSON.stringify({
          fileKey,
          caseId,
        }),
      });

      console.log("✅ File deleted successfully");
      return true;
    } catch (error) {
      console.error("❌ Delete failed:", error);
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
      console.log("🔗 Getting download URL for:", fileKey);

      const params = new URLSearchParams({
        expiresIn: expiresIn.toString(),
        download: "true",
      });

      if (filename) {
        params.append("filename", filename);
      }

      const response = await this.apiRequest(
        `/upload/download/${encodeURIComponent(fileKey)}?${params}`
      );
      const result = await response.json();

      console.log("✅ Download URL generated");
      return result.downloadUrl;
    } catch (error) {
      console.error("❌ Failed to get download URL:", error);
      throw error;
    }
  }

  // Get files for a case
  public async getCaseFiles(
    caseId: string,
    options: {
      captureType?: "screenshot" | "video";
      page?: number;
      limit?: number;
      sortBy?: "name" | "size" | "date";
      sortOrder?: "asc" | "desc";
    } = {}
  ): Promise<{
    files: any[];
    pagination: any;
    summary: any;
  }> {
    try {
      console.log("📁 Getting files for case:", caseId);

      const params = new URLSearchParams();
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await this.apiRequest(
        `/upload/cases/${caseId}/files?${params}`
      );
      const result = await response.json();

      console.log("✅ Case files retrieved:", {
        totalFiles: result.summary.totalFiles,
        screenshots: result.summary.screenshots,
        videos: result.summary.videos,
      });

      return result;
    } catch (error) {
      console.error("❌ Failed to get case files:", error);
      throw error;
    }
  }

  // Get upload statistics
  public async getUploadStats(
    options: {
      caseId?: string;
      days?: number;
      detailed?: boolean;
    } = {}
  ): Promise<any> {
    try {
      console.log("📊 Getting upload statistics");

      const params = new URLSearchParams();
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await this.apiRequest(`/upload/stats?${params}`);
      const result = await response.json();

      console.log("✅ Upload stats retrieved");
      return result;
    } catch (error) {
      console.error("❌ Failed to get upload stats:", error);
      throw error;
    }
  }

  // Check connection to backend
  public async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error("❌ Backend connection check failed:", error);
      return false;
    }
  }

  // Get storage costs estimation
  public async getStorageCosts(caseId?: string): Promise<any> {
    try {
      console.log("💰 Getting storage costs");

      const params = new URLSearchParams();
      if (caseId) {
        params.append("caseId", caseId);
      }

      const response = await this.apiRequest(`/upload/costs?${params}`);
      const result = await response.json();

      console.log("✅ Storage costs retrieved");
      return result;
    } catch (error) {
      console.error("❌ Failed to get storage costs:", error);
      throw error;
    }
  }
}

// Create singleton instance
export const s3Service = new S3Service();

// Helper function to format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// Helper function to format upload speed
export function formatSpeed(bytesPerSecond: number): string {
  return formatFileSize(bytesPerSecond) + "/s";
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
