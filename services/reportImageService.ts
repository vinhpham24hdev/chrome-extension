// services/reportImageService.ts - Service to handle images in report
export interface ImageDisplayData {
  fileKey: string;
  fileName: string;
  originalUrl: string;
  displayUrl: string;
  expiresAt: string;
  isPrivate: boolean;
}

class ReportImageService {
  private apiBaseUrl: string;
  private authToken: string | null = null;
  private imageCache = new Map<string, ImageDisplayData>();

  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
    this.loadAuthToken();
  }

  private loadAuthToken(): void {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get(["authState"], (result) => {
          if (result.authState?.token) {
            this.authToken = result.authState.token;
          }
        });
      }
    } catch (error) {
      console.warn("Failed to load auth token:", error);
    }
  }

  public setAuthToken(token: string): void {
    this.authToken = token;
  }

  // Phương pháp 1: Tạo presigned URL cho ảnh
  async getImageDisplayUrl(fileKey: string): Promise<string> {
    try {
      // Kiểm tra cache trước
      const cached = this.imageCache.get(fileKey);
      if (cached && new Date(cached.expiresAt) > new Date()) {
        console.log("📸 Using cached image URL for:", fileKey);
        return cached.displayUrl;
      }

      console.log("🔗 Generating display URL for image:", fileKey);

      const response = await fetch(`${this.apiBaseUrl}/image-display/url/${encodeURIComponent(fileKey)}`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get image URL: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Cache kết quả
        const imageData: ImageDisplayData = {
          fileKey,
          fileName: data.fileKey.split('/').pop() || 'image',
          originalUrl: data.fileUrl || '',
          displayUrl: data.imageUrl,
          expiresAt: data.expiresAt,
          isPrivate: true
        };

        this.imageCache.set(fileKey, imageData);
        
        console.log("✅ Image display URL generated and cached");
        return data.imageUrl;
      } else {
        throw new Error(data.error || 'Failed to generate image URL');
      }

    } catch (error) {
      console.error("❌ Error getting image display URL:", error);
      
      // Fallback: return proxy URL
      return this.getProxyImageUrl(fileKey);
    }
  }

  // Phương pháp 2: Proxy URL qua backend
  getProxyImageUrl(fileKey: string): string {
    return `${this.apiBaseUrl}/image-display/stream/${encodeURIComponent(fileKey)}?token=${this.authToken}`;
  }

  // Phương pháp 3: Batch load nhiều ảnh cùng lúc
  async batchLoadImages(fileKeys: string[]): Promise<Map<string, string>> {
    try {
      console.log("📦 Batch loading images:", fileKeys.length);

      const response = await fetch(`${this.apiBaseUrl}/image-display/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileKeys,
          options: {
            expiresIn: 7200, // 2 hours
            includeMetadata: false
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Batch load failed: ${response.statusText}`);
      }

      const data = await response.json();
      const urlMap = new Map<string, string>();

      if (data.success && data.successful) {
        data.successful.forEach((item: any) => {
          urlMap.set(item.fileKey, item.imageUrl);
          
          // Cache individual items
          const imageData: ImageDisplayData = {
            fileKey: item.fileKey,
            fileName: item.fileKey.split('/').pop() || 'image',
            originalUrl: '',
            displayUrl: item.imageUrl,
            expiresAt: item.expiresAt,
            isPrivate: true
          };
          this.imageCache.set(item.fileKey, imageData);
        });
      }

      // Fallback cho những ảnh failed
      if (data.failed && data.failed.length > 0) {
        data.failed.forEach((item: any) => {
          const fileKey = item.fileKey || fileKeys.find(k => !urlMap.has(k));
          if (fileKey) {
            urlMap.set(fileKey, this.getProxyImageUrl(fileKey));
          }
        });
      }

      console.log("✅ Batch load completed:", urlMap.size, "images");
      return urlMap;

    } catch (error) {
      console.error("❌ Batch load failed:", error);
      
      // Fallback: tạo proxy URLs
      const urlMap = new Map<string, string>();
      fileKeys.forEach(fileKey => {
        urlMap.set(fileKey, this.getProxyImageUrl(fileKey));
      });
      return urlMap;
    }
  }

  // Refresh URLs khi hết hạn
  async refreshImageUrls(fileKeys: string[]): Promise<void> {
    try {
      console.log("🔄 Refreshing image URLs:", fileKeys.length);
      
      // Xóa cache cũ
      fileKeys.forEach(key => this.imageCache.delete(key));
      
      // Load lại URLs mới
      await this.batchLoadImages(fileKeys);
      
      console.log("✅ Image URLs refreshed");
    } catch (error) {
      console.error("❌ Failed to refresh image URLs:", error);
    }
  }

  // Clear cache
  clearCache(): void {
    this.imageCache.clear();
    console.log("🧹 Image cache cleared");
  }

  // Get cached image data
  getCachedImageData(fileKey: string): ImageDisplayData | null {
    return this.imageCache.get(fileKey) || null;
  }

  // Check if image URL is expired
  isImageUrlExpired(fileKey: string): boolean {
    const cached = this.imageCache.get(fileKey);
    if (!cached) return true;
    
    return new Date(cached.expiresAt) <= new Date();
  }

  // Preload images để tăng tốc độ
  async preloadReportImages(reportHtml: string): Promise<void> {
    try {
      // Extract all image sources from HTML
      const imageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
      const matches = [];
      let match;
      
      while ((match = imageRegex.exec(reportHtml)) !== null) {
        matches.push(match[1]);
      }

      // Filter ra những ảnh từ S3 private bucket
      const s3ImageKeys = matches
        .filter(src => src.includes(this.apiBaseUrl) || src.includes('proofext.s3'))
        .map(src => this.extractFileKeyFromUrl(src))
        .filter(key => key !== null) as string[];

      if (s3ImageKeys.length > 0) {
        console.log("🚀 Preloading report images:", s3ImageKeys.length);
        await this.batchLoadImages(s3ImageKeys);
      }

    } catch (error) {
      console.error("❌ Failed to preload report images:", error);
    }
  }

  // Extract file key from various URL formats
  private extractFileKeyFromUrl(url: string): string | null {
    try {
      // Format 1: /api/image-display/stream/uploads%2F2024-07-31%2Ffile.jpg
      const streamMatch = url.match(/\/image-display\/stream\/(.+?)(?:\?|$)/);
      if (streamMatch) {
        return decodeURIComponent(streamMatch[1]);
      }

      // Format 2: Direct S3 URL
      const s3Match = url.match(/proofext\.s3\.amazonaws\.com\/(.+?)(?:\?|$)/);
      if (s3Match) {
        return s3Match[1];
      }

      // Format 3: Presigned URL
      const presignedMatch = url.match(/proofext\.s3\.us-east-1\.amazonaws\.com\/(.+?)\?/);
      if (presignedMatch) {
        return presignedMatch[1];
      }

      return null;
    } catch (error) {
      console.warn("⚠️ Failed to extract file key from URL:", url);
      return null;
    }
  }
}

// Singleton instance
export const reportImageService = new ReportImageService();