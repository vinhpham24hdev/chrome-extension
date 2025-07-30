// services/reportMediaService.ts - Enhanced service for both images and videos
export interface MediaDisplayData {
  fileKey: string;
  fileName: string;
  mediaType: 'image' | 'video';
  originalUrl: string;
  displayUrl: string;
  expiresAt: string;
  isPrivate: boolean;
  videoMetadata?: {
    duration?: number;
    width?: number;
    height?: number;
    codec?: string;
    hasAudio?: boolean;
  };
}

class ReportMediaService {
  private apiBaseUrl: string;
  private authToken: string | null = null;
  private mediaCache = new Map<string, MediaDisplayData>();

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

  // Universal method for both images and videos
  async getMediaDisplayUrl(fileKey: string): Promise<string> {
    try {
      // Check cache first
      const cached = this.mediaCache.get(fileKey);
      if (cached && new Date(cached.expiresAt) > new Date()) {
        console.log("📸 Using cached media URL for:", fileKey);
        return cached.displayUrl;
      }

      console.log("🔗 Generating display URL for media:", fileKey);

      const response = await fetch(`${this.apiBaseUrl}/media-display/url/${encodeURIComponent(fileKey)}`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get media URL: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Cache result
        const mediaData: MediaDisplayData = {
          fileKey,
          fileName: data.fileName || fileKey.split('/').pop() || 'media',
          mediaType: data.mediaType || 'image',
          originalUrl: data.fileUrl || '',
          displayUrl: data.mediaUrl || data.imageUrl || data.videoUrl,
          expiresAt: data.expiresAt,
          isPrivate: true,
          ...(data.videoMetadata ? { videoMetadata: data.videoMetadata } : {})
        };

        this.mediaCache.set(fileKey, mediaData);
        
        console.log("✅ Media display URL generated and cached");
        return mediaData.displayUrl;
      } else {
        throw new Error(data.error || 'Failed to generate media URL');
      }

    } catch (error) {
      console.error("❌ Error getting media display URL:", error);
      
      // Fallback: return proxy URL
      return this.getProxyMediaUrl(fileKey);
    }
  }

  // Backward compatibility
  async getImageDisplayUrl(fileKey: string): Promise<string> {
    return this.getMediaDisplayUrl(fileKey);
  }

  // Proxy URL for both images and videos
  getProxyMediaUrl(fileKey: string): string {
    return `${this.apiBaseUrl}/media-display/stream/${encodeURIComponent(fileKey)}?token=${this.authToken}`;
  }

  // Backward compatibility
  getProxyImageUrl(fileKey: string): string {
    return this.getProxyMediaUrl(fileKey);
  }

  // Batch load media files (images + videos)
  async batchLoadMedia(fileKeys: string[]): Promise<Map<string, string>> {
    try {
      console.log("📦 Batch loading media:", fileKeys.length);

      const response = await fetch(`${this.apiBaseUrl}/media-display/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileKeys,
          options: {
            expiresIn: 7200, // 2 hours
            includeMetadata: true
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
          const displayUrl = item.mediaUrl || item.imageUrl || item.videoUrl;
          urlMap.set(item.fileKey, displayUrl);
          
          // Cache individual items
          const mediaData: MediaDisplayData = {
            fileKey: item.fileKey,
            fileName: item.metadata?.fileName || item.fileKey.split('/').pop() || 'media',
            mediaType: item.mediaType || 'image',
            originalUrl: '',
            displayUrl: displayUrl,
            expiresAt: item.expiresAt,
            isPrivate: true,
            ...(item.metadata?.videoMetadata ? { videoMetadata: item.metadata.videoMetadata } : {})
          };
          this.mediaCache.set(item.fileKey, mediaData);
        });
      }

      // Fallback for failed items
      if (data.failed && data.failed.length > 0) {
        data.failed.forEach((item: any) => {
          const fileKey = item.fileKey || fileKeys.find(k => !urlMap.has(k));
          if (fileKey) {
            urlMap.set(fileKey, this.getProxyMediaUrl(fileKey));
          }
        });
      }

      console.log("✅ Batch load completed:", urlMap.size, "media files");
      return urlMap;

    } catch (error) {
      console.error("❌ Batch load failed:", error);
      
      // Fallback: create proxy URLs
      const urlMap = new Map<string, string>();
      fileKeys.forEach(fileKey => {
        urlMap.set(fileKey, this.getProxyMediaUrl(fileKey));
      });
      return urlMap;
    }
  }

  // Backward compatibility
  async batchLoadImages(fileKeys: string[]): Promise<Map<string, string>> {
    return this.batchLoadMedia(fileKeys);
  }

  // Refresh URLs when expired
  async refreshMediaUrls(fileKeys: string[]): Promise<void> {
    try {
      console.log("🔄 Refreshing media URLs:", fileKeys.length);
      
      // Clear old cache
      fileKeys.forEach(key => this.mediaCache.delete(key));
      
      // Load new URLs
      await this.batchLoadMedia(fileKeys);
      
      console.log("✅ Media URLs refreshed");
    } catch (error) {
      console.error("❌ Failed to refresh media URLs:", error);
    }
  }

  // Backward compatibility
  async refreshImageUrls(fileKeys: string[]): Promise<void> {
    return this.refreshMediaUrls(fileKeys);
  }

  // Check if media URL is expired
  isMediaUrlExpired(fileKey: string): boolean {
    const cached = this.mediaCache.get(fileKey);
    if (!cached) return true;
    
    return new Date(cached.expiresAt) <= new Date();
  }

  // Backward compatibility
  isImageUrlExpired(fileKey: string): boolean {
    return this.isMediaUrlExpired(fileKey);
  }

  // Get cached media data
  getCachedMediaData(fileKey: string): MediaDisplayData | null {
    return this.mediaCache.get(fileKey) || null;
  }

  // Backward compatibility
  getCachedImageData(fileKey: string): MediaDisplayData | null {
    return this.getCachedMediaData(fileKey);
  }

  // Preload media files from report HTML
  async preloadReportMedia(reportHtml: string): Promise<void> {
    try {
      // Extract all image and video sources from HTML
      const mediaRegex = /<(?:img|video)[^>]+src=["']([^"']+)["'][^>]*>/gi;
      const matches = [];
      let match;
      
      while ((match = mediaRegex.exec(reportHtml)) !== null) {
        matches.push(match[1]);
      }

      // Filter media files from S3 private bucket
      const s3MediaKeys = matches
        .filter(src => src.includes(this.apiBaseUrl) || src.includes('proofext.s3'))
        .map(src => this.extractFileKeyFromUrl(src))
        .filter(key => key !== null) as string[];

      if (s3MediaKeys.length > 0) {
        console.log("🚀 Preloading report media:", s3MediaKeys.length);
        await this.batchLoadMedia(s3MediaKeys);
      }

    } catch (error) {
      console.error("❌ Failed to preload report media:", error);
    }
  }

  // Backward compatibility
  async preloadReportImages(reportHtml: string): Promise<void> {
    return this.preloadReportMedia(reportHtml);
  }

  // Clear cache
  clearCache(): void {
    this.mediaCache.clear();
    console.log("🧹 Media cache cleared");
  }

  // Extract file key from various URL formats
  private extractFileKeyFromUrl(url: string): string | null {
    try {
      // Format 1: /api/media-display/stream/uploads%2F2024-07-31%2Ffile.jpg
      const streamMatch = url.match(/\/media-display\/stream\/(.+?)(?:\?|$)/);
      if (streamMatch) {
        return decodeURIComponent(streamMatch[1]);
      }

      // Format 2: Legacy image-display URLs
      const imageStreamMatch = url.match(/\/image-display\/stream\/(.+?)(?:\?|$)/);
      if (imageStreamMatch) {
        return decodeURIComponent(imageStreamMatch[1]);
      }

      // Format 3: Direct S3 URL
      const s3Match = url.match(/proofext\.s3\.amazonaws\.com\/(.+?)(?:\?|$)/);
      if (s3Match) {
        return s3Match[1];
      }

      // Format 4: Presigned URL
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

  // Get media type from file key/cached data
  getMediaType(fileKey: string): 'image' | 'video' | 'unknown' {
    const cached = this.mediaCache.get(fileKey);
    if (cached) {
      return cached.mediaType;
    }

    // Guess from file extension
    const extension = fileKey.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return 'image';
    }
    if (['mp4', 'webm', 'mov', 'avi'].includes(extension || '')) {
      return 'video';
    }

    return 'unknown';
  }
}

// Singleton instance
export const reportMediaService = new ReportMediaService();
