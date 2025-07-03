// services/fullscreenWindowService.ts - Updated to open in new tab like Loom
export interface RegionSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RegionSelectorTab {
  tabId?: number;
  screenshot?: string;
}

class FullscreenWindowService {
  private regionSelectorTab: RegionSelectorTab = {};
  private regionSelectionCallbacks: ((region: RegionSelection) => void)[] = [];
  private cancelCallbacks: (() => void)[] = [];

  constructor() {
    this.setupMessageListeners();
  }

  private setupMessageListeners() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('📨 Fullscreen service received message:', message.type);

        switch (message.type) {
          case 'REGION_WINDOW_READY':
            this.handleRegionTabReady(sender, sendResponse);
            return true;

          case 'REGION_SELECTED':
            this.handleRegionSelected(message.data);
            sendResponse({ success: true });
            break;

          case 'REGION_CANCELLED':
            this.handleRegionCancelled();
            sendResponse({ success: true });
            break;
        }
      });
    }
  }

  private async handleRegionTabReady(sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    console.log('🎯 Region selector tab is ready');
    
    if (this.regionSelectorTab.screenshot) {
      // Send screenshot data to the tab
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'REGION_SELECTOR_DATA',
          data: {
            screenshot: this.regionSelectorTab.screenshot
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('❌ Failed to send screenshot data:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            console.log('✅ Screenshot data sent to region selector tab');
            sendResponse({ success: true });
          }
        });
      }
    } else {
      sendResponse({ success: false, error: 'No screenshot data available' });
    }
  }

  private handleRegionSelected(region: RegionSelection) {
    console.log('✅ Region selected:', region);
    
    // Close the tab
    if (this.regionSelectorTab.tabId) {
      chrome.tabs.remove(this.regionSelectorTab.tabId).catch(err => {
        console.warn('Failed to close region selector tab:', err);
      });
    }
    
    // Notify callbacks
    this.regionSelectionCallbacks.forEach(callback => callback(region));
    
    // Clear state
    this.clearState();
  }

  private handleRegionCancelled() {
    console.log('❌ Region selection cancelled');
    
    // Close the tab
    if (this.regionSelectorTab.tabId) {
      chrome.tabs.remove(this.regionSelectorTab.tabId).catch(err => {
        console.warn('Failed to close region selector tab:', err);
      });
    }
    
    // Notify callbacks
    this.cancelCallbacks.forEach(callback => callback());
    
    // Clear state
    this.clearState();
  }

  private clearState() {
    this.regionSelectorTab = {};
  }

  async startRegionSelection(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🚀 Starting region selection in new tab...');
      
      // First capture the current visible tab
      const captureResult = await this.captureVisibleTab();
      if (!captureResult.success || !captureResult.dataUrl) {
        return { 
          success: false, 
          error: captureResult.error || 'Failed to capture screenshot' 
        };
      }

      // Store screenshot for later
      this.regionSelectorTab.screenshot = captureResult.dataUrl;

      // Open region selector in new tab (Loom style)
      const extensionUrl = chrome.runtime.getURL('region-selector.html');
      console.log('📄 Opening region selector tab:', extensionUrl);

      const tab = await chrome.tabs.create({
        url: extensionUrl,
        active: true // Focus the new tab immediately
      });

      if (!tab.id) {
        return { success: false, error: 'Failed to create region selector tab' };
      }

      this.regionSelectorTab.tabId = tab.id;
      console.log('✅ Region selector tab created:', tab.id);

      // The tab will send REGION_TAB_READY when loaded
      return { success: true };

    } catch (error) {
      console.error('❌ Failed to start region selection:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async captureVisibleTab(): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
    try {
      console.log('📸 Capturing visible tab for region selection...');
      
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      
      if (!activeTab) {
        return { success: false, error: 'No active tab found' };
      }

      // Capture the visible area
      const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
        format: 'png'
      });

      console.log('✅ Screenshot captured successfully');
      return { success: true, dataUrl };

    } catch (error) {
      console.error('❌ Failed to capture tab:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to capture screenshot' 
      };
    }
  }

  // Check if region selector tab is already open
  async isRegionSelectorOpen(): Promise<boolean> {
    if (!this.regionSelectorTab.tabId) return false;

    try {
      const tab = await chrome.tabs.get(this.regionSelectorTab.tabId);
      return !!tab;
    } catch {
      this.regionSelectorTab = {};
      return false;
    }
  }

  // Focus existing region selector tab
  async focusRegionSelector(): Promise<boolean> {
    if (!this.regionSelectorTab.tabId) return false;

    try {
      await chrome.tabs.update(this.regionSelectorTab.tabId, { active: true });
      const tab = await chrome.tabs.get(this.regionSelectorTab.tabId);
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      return true;
    } catch (error) {
      console.error('Failed to focus region selector tab:', error);
      return false;
    }
  }

  // Event listeners
  onRegionSelected(callback: (region: RegionSelection) => void) {
    this.regionSelectionCallbacks.push(callback);
  }

  onCancelled(callback: () => void) {
    this.cancelCallbacks.push(callback);
  }

  // Remove listeners
  removeListeners() {
    this.regionSelectionCallbacks = [];
    this.cancelCallbacks = [];
  }
}

export const fullscreenWindowService = new FullscreenWindowService();