// services/badgeService.ts - Extension Badge Management
export class BadgeService {
  private static instance: BadgeService;
  private isRecording = false;

  private constructor() {}

  public static getInstance(): BadgeService {
    if (!BadgeService.instance) {
      BadgeService.instance = new BadgeService();
    }
    return BadgeService.instance;
  }

  /**
   * Show recording indicator (red dot)
   */
  public showRecordingIndicator(): void {
    if (typeof chrome !== 'undefined' && chrome.action) {
      // Set red badge with recording dot
      chrome.action.setBadgeText({ text: '●' });
      chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
      
      // Update tooltip
      chrome.action.setTitle({ title: 'Cellebrite - Recording... (Click to stop)' });
      
      this.isRecording = true;
      console.log('🔴 Recording indicator shown');
    }
  }

  /**
   * Hide recording indicator
   */
  public hideRecordingIndicator(): void {
    if (typeof chrome !== 'undefined' && chrome.action) {
      // Clear badge
      chrome.action.setBadgeText({ text: '' });
      
      // Reset tooltip
      chrome.action.setTitle({ title: 'Cellebrite Capture Tool' });
      
      this.isRecording = false;
      console.log('⚪ Recording indicator hidden');
    }
  }

  /**
   * Check if currently showing recording indicator
   */
  public isShowingRecordingIndicator(): boolean {
    return this.isRecording;
  }

  /**
   * Set badge for notification count
   */
  public setNotificationBadge(count: number): void {
    if (typeof chrome !== 'undefined' && chrome.action && !this.isRecording) {
      if (count > 0) {
        chrome.action.setBadgeText({ text: count.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    }
  }

  /**
   * Animate recording indicator (pulsing effect)
   */
  public startRecordingAnimation(): void {
    if (!this.isRecording) return;

    const pulseInterval = setInterval(() => {
      if (!this.isRecording) {
        clearInterval(pulseInterval);
        return;
      }

      // Alternate between full and semi-transparent red
      chrome.action.setBadgeBackgroundColor({ 
        color: Math.random() > 0.5 ? '#ff0000' : '#ff6666' 
      });
    }, 1000);
  }

  /**
   * Show error indicator
   */
  public showErrorIndicator(duration = 3000): void {
    if (typeof chrome !== 'undefined' && chrome.action) {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
      chrome.action.setTitle({ title: 'Cellebrite - Error occurred' });

      setTimeout(() => {
        if (!this.isRecording) {
          this.hideRecordingIndicator();
        }
      }, duration);
    }
  }

  /**
   * Show success indicator
   */
  public showSuccessIndicator(duration = 2000): void {
    if (typeof chrome !== 'undefined' && chrome.action && !this.isRecording) {
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#059669' });
      chrome.action.setTitle({ title: 'Cellebrite - Action completed' });

      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setTitle({ title: 'Cellebrite Capture Tool' });
      }, duration);
    }
  }
}

// Export singleton instance
export const badgeService = BadgeService.getInstance();