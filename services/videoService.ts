// services/videoService.ts - Fixed Video Recording Service with proper pause/resume timing
export interface VideoOptions {
  type: "tab" | "desktop" | "window";
  format: "webm" | "mp4";
  quality: "low" | "medium" | "high";
  maxDuration?: number; // seconds
  includeAudio?: boolean;
}

export interface VideoResult {
  success: boolean;
  blob?: Blob;
  dataUrl?: string;
  filename?: string;
  duration?: number;
  size?: number;
  error?: string;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  size: number;
  status:
    | "idle"
    | "starting"
    | "recording"
    | "paused"
    | "stopping"
    | "completed"
    | "error";
}

export interface RecordingControls {
  start: () => Promise<void>;
  stop: () => Promise<VideoResult>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

export class VideoService {
  private static instance: VideoService;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];

  // Fixed timing tracking
  private recordingStartTime: number = 0;
  private totalPausedDuration: number = 0;
  private pauseStartTime: number = 0;
  private progressInterval: NodeJS.Timeout | null = null;

  private onStateChange?: (state: RecordingState) => void;
  private onProgress?: (progress: { duration: number; size: number }) => void;
  private currentState: RecordingState = {
    isRecording: false,
    isPaused: false,
    duration: 0,
    size: 0,
    status: "idle",
  };

  private constructor() {}

  public static getInstance(): VideoService {
    if (!VideoService.instance) {
      VideoService.instance = new VideoService();
    }
    return VideoService.instance;
  }

  /**
   * Check if video recording is supported
   */
  isSupported(): boolean {
    return !!(
      typeof chrome !== "undefined" &&
      chrome.desktopCapture &&
      typeof MediaRecorder !== "undefined" &&
      navigator.mediaDevices
    );
  }

  /**
   * Get available video recording options
   */
  getSupportedFormats(): string[] {
    const formats = ["webm"];

    // Check MP4 support
    if (MediaRecorder.isTypeSupported("video/mp4")) {
      formats.push("mp4");
    }

    return formats;
  }

  /**
   * Start video recording
   */
  async startRecording(
    options: VideoOptions = { type: "tab", format: "webm", quality: "medium" },
    callbacks: {
      onStateChange?: (state: RecordingState) => void;
      onProgress?: (progress: { duration: number; size: number }) => void;
    } = {}
  ): Promise<RecordingControls> {
    this.onStateChange = callbacks.onStateChange;
    this.onProgress = callbacks.onProgress;

    try {
      if (!this.isSupported()) {
        throw new Error("Video recording not supported in this environment");
      }

      if (this.currentState.isRecording) {
        throw new Error("Recording already in progress");
      }

      this.updateState({ status: "starting" });

      // Get media stream based on type
      this.stream = await this.getMediaStream(options);

      if (!this.stream) {
        throw new Error("Failed to get media stream");
      }

      // Setup MediaRecorder
      const mimeType = this.getMimeType(options.format);
      const mediaRecorderOptions: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: this.getVideoBitrate(options.quality),
      };

      // Include audio if requested and available
      if (options.includeAudio && this.stream.getAudioTracks().length > 0) {
        mediaRecorderOptions.audioBitsPerSecond = 128000; // 128kbps
      }

      this.mediaRecorder = new MediaRecorder(this.stream, mediaRecorderOptions);
      this.recordedChunks = [];

      // Reset timing variables
      this.recordingStartTime = Date.now();
      this.totalPausedDuration = 0;
      this.pauseStartTime = 0;

      // Setup event handlers
      this.setupMediaRecorderEvents(options);

      // Start recording
      this.mediaRecorder.start(1000); // Record in 1-second chunks

      this.updateState({
        isRecording: true,
        isPaused: false,
        status: "recording",
        duration: 0,
        size: 0,
      });

      // Start progress tracking
      this.startProgressTracking();

      return {
        start: async () => {
          // Already started
        },
        stop: () => this.stopRecording(),
        pause: () => this.pauseRecording(),
        resume: () => this.resumeRecording(),
        cancel: () => this.cancelRecording(),
      };
    } catch (error) {
      this.updateState({ status: "error" });
      throw new Error(
        `Failed to start recording: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Stop recording and return result
   */
  private async stopRecording(): Promise<VideoResult> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve({
          success: false,
          error: "No active recording",
        });
        return;
      }

      this.updateState({ status: "stopping" });

      // Stop progress tracking
      this.stopProgressTracking();

      // Setup one-time event listener for dataavailable
      const handleFinalData = () => {
        if (this.recordedChunks.length === 0) {
          resolve({
            success: false,
            error: "No recorded data available",
          });
          return;
        }

        try {
          const blob = new Blob(this.recordedChunks, {
            type: this.mediaRecorder!.mimeType,
          });
          const dataUrl = URL.createObjectURL(blob);

          // Calculate final duration
          const finalDuration = this.calculateCurrentDuration();

          const filename = this.generateFilename(
            this.getFormatFromMimeType(this.mediaRecorder!.mimeType)
          );

          this.cleanup();

          this.updateState({
            isRecording: false,
            isPaused: false,
            status: "completed",
            duration: Math.round(finalDuration),
            size: blob.size,
          });

          resolve({
            success: true,
            blob,
            dataUrl,
            filename,
            duration: Math.round(finalDuration),
            size: blob.size,
          });
        } catch (error) {
          this.cleanup();
          this.updateState({ status: "error" });
          resolve({
            success: false,
            error: `Failed to process recording: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          });
        }
      };

      // Add event listener and stop recording
      this.mediaRecorder.addEventListener("stop", handleFinalData, {
        once: true,
      });
      this.mediaRecorder.stop();
    });
  }

  /**
   * Pause recording
   */
  private pauseRecording(): void {
    if (
      this.mediaRecorder &&
      this.currentState.isRecording &&
      !this.currentState.isPaused
    ) {
      this.mediaRecorder.pause();
      this.pauseStartTime = Date.now();

      this.updateState({
        isPaused: true,
        status: "paused",
      });

      console.log(
        "🔴 Recording paused at:",
        this.formatDuration(this.currentState.duration)
      );
    }
  }

  /**
   * Resume recording
   */
  private resumeRecording(): void {
    if (
      this.mediaRecorder &&
      this.currentState.isRecording &&
      this.currentState.isPaused
    ) {
      this.mediaRecorder.resume();

      // Add the pause duration to total paused time
      if (this.pauseStartTime > 0) {
        this.totalPausedDuration += Date.now() - this.pauseStartTime;
        this.pauseStartTime = 0;
      }

      this.updateState({
        isPaused: false,
        status: "recording",
      });

      console.log(
        "▶️ Recording resumed. Total paused time:",
        Math.round(this.totalPausedDuration / 1000),
        "seconds"
      );
    }
  }

  /**
   * Cancel recording
   */
  private cancelRecording(): void {
    this.stopProgressTracking();
    this.cleanup();
    this.updateState({
      isRecording: false,
      isPaused: false,
      status: "idle",
      duration: 0,
      size: 0,
    });
  }

  /**
   * Calculate current recording duration excluding paused time
   */
  private calculateCurrentDuration(): number {
    if (!this.recordingStartTime) return 0;

    const now = Date.now();
    let totalElapsed = now - this.recordingStartTime;

    // Subtract total paused duration
    totalElapsed -= this.totalPausedDuration;

    // If currently paused, subtract current pause duration
    if (this.currentState.isPaused && this.pauseStartTime > 0) {
      totalElapsed -= now - this.pauseStartTime;
    }

    return Math.max(0, totalElapsed / 1000); // Convert to seconds
  }

  /**
   * Get media stream based on options
   */
  private async getMediaStream(options: VideoOptions): Promise<MediaStream> {
    if (options.type === "tab") {
      return this.getTabStream(options);
    } else {
      return this.getDesktopStream(options);
    }
  }

  /**
   * Get tab recording stream (Chrome Extension specific)
   */
  private async getTabStream(options: VideoOptions): Promise<MediaStream> {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.id) {
        throw new Error("No active tab found");
      }

      // Use chrome.tabCapture API for tab recording
      return new Promise((resolve, reject) => {
        chrome.tabCapture.capture(
          {
            video: true,
            audio: options.includeAudio || false,
            videoConstraints: {
              mandatory: {
                minWidth: 1280,
                minHeight: 720,
                maxWidth: 1920,
                maxHeight: 1080,
                minFrameRate: 15,
                maxFrameRate: 30,
              },
            },
          },
          (stream) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (!stream) {
              reject(new Error("Failed to capture tab stream"));
              return;
            }

            resolve(stream);
          }
        );
      });
    } catch (error) {
      throw new Error(
        `Tab recording failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get desktop recording stream
   */
  private async getDesktopStream(options: VideoOptions): Promise<MediaStream> {
    try {
      // Request desktop capture permission
      const streamId = await new Promise<string>((resolve, reject) => {
        chrome.desktopCapture.chooseDesktopMedia(
          ["screen", "window", "tab"],
          (streamId) => {
            if (streamId) {
              resolve(streamId);
            } else {
              reject(
                new Error("User cancelled desktop capture or permission denied")
              );
            }
          }
        );
      });

      // Get media stream with desktop capture
      const constraints: MediaStreamConstraints = {
        audio: options.includeAudio
          ? ({
              mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: streamId,
              },
            } as any)
          : false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: streamId,
            maxWidth:
              options.quality === "high"
                ? 1920
                : options.quality === "medium"
                ? 1280
                : 720,
            maxHeight:
              options.quality === "high"
                ? 1080
                : options.quality === "medium"
                ? 720
                : 480,
            maxFrameRate: options.quality === "high" ? 30 : 15,
          },
        } as any,
      };

      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      throw new Error(
        `Desktop recording failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Setup MediaRecorder event handlers
   */
  private setupMediaRecorderEvents(options: VideoOptions): void {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);

        // Update size
        const totalSize = this.recordedChunks.reduce(
          (sum, chunk) => sum + chunk.size,
          0
        );
        this.updateState({ size: totalSize });
      }
    });

    this.mediaRecorder.addEventListener("error", (event) => {
      console.error("MediaRecorder error:", event);
      this.stopProgressTracking();
      this.cleanup();
      this.updateState({ status: "error" });
    });

    // Auto-stop if max duration reached
    if (options.maxDuration) {
      setTimeout(() => {
        if (this.currentState.isRecording) {
          this.stopRecording();
        }
      }, options.maxDuration * 1000);
    }
  }

  /**
   * Start progress tracking
   */
  private startProgressTracking(): void {
    this.stopProgressTracking(); // Clear any existing interval

    this.progressInterval = setInterval(() => {
      if (this.currentState.isRecording) {
        const duration = this.calculateCurrentDuration();
        const totalSize = this.recordedChunks.reduce(
          (sum, chunk) => sum + chunk.size,
          0
        );

        this.updateState({
          duration: Math.round(duration),
          size: totalSize,
        });

        this.onProgress?.({ duration: Math.round(duration), size: totalSize });

        // Debug logging
        if (Math.round(duration) % 5 === 0 && Math.round(duration) > 0) {
          console.log(
            `📹 Recording progress: ${this.formatDuration(
              Math.round(duration)
            )} | ${this.formatFileSize(totalSize)} | Paused: ${
              this.currentState.isPaused ? "Yes" : "No"
            }`
          );
        }
      }
    }, 1000);
  }

  /**
   * Stop progress tracking
   */
  private stopProgressTracking(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<RecordingState>): void {
    this.currentState = { ...this.currentState, ...updates };
    this.onStateChange?.(this.currentState);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.mediaRecorder) {
      this.mediaRecorder = null;
    }

    this.stopProgressTracking();
    this.recordedChunks = [];
    this.recordingStartTime = 0;
    this.totalPausedDuration = 0;
    this.pauseStartTime = 0;
  }

  /**
   * Utility methods
   */
  private getMimeType(format: string): string {
    switch (format) {
      case "mp4":
        return MediaRecorder.isTypeSupported(
          'video/mp4; codecs="avc1.424028, mp4a.40.2"'
        )
          ? 'video/mp4; codecs="avc1.424028, mp4a.40.2"'
          : "video/mp4";
      case "webm":
      default:
        return MediaRecorder.isTypeSupported('video/webm; codecs="vp9, opus"')
          ? 'video/webm; codecs="vp9, opus"'
          : "video/webm";
    }
  }

  private getFormatFromMimeType(mimeType: string): string {
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("webm")) return "webm";
    return "webm";
  }

  private getVideoBitrate(quality: string): number {
    switch (quality) {
      case "high":
        return 2500000; // 2.5 Mbps
      case "medium":
        return 1000000; // 1 Mbps
      case "low":
        return 500000; // 500 kbps
      default:
        return 1000000;
    }
  }

  private generateFilename(format: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `video-recording-${timestamp}.${format}`;
  }

  /**
   * Convert dataURL (base64) → Blob
   */
  public dataURLtoBlob(dataUrl: string): Blob {
    const [header, base64] = dataUrl.split(",");
    if (!base64) throw new Error("Invalid dataURL");

    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";

    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

    return new Blob([bytes], { type: mime });
  }

  /**
   * Download video file
   */
  downloadVideo(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Get current recording state
   */
  getCurrentState(): RecordingState {
    return { ...this.currentState };
  }

  /**
   * Format duration for display
   */
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }
}

// Export singleton instance
export const videoService = VideoService.getInstance();
