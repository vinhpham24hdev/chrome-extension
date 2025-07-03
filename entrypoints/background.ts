// entrypoints/background.ts - Enhanced for region selector communication
export default defineBackground(() => {
  console.log('🚀 Background script started:', { id: browser.runtime.id });

  // Store for various results that couldn't be delivered immediately
  const pendingVideoResults = new Map<string, any>();
  const pendingRegionSelections = new Map<string, any>();

  // Handle messages from different parts of the extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Background received message:', message.type, 'from:', sender.tab?.url || 'extension');

    try {
      switch (message.type) {
        case 'VIDEO_RECORDED':
          handleVideoRecorded(message.data, sender)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true; // Keep message channel open for async response

        case 'VIDEO_RECORDED_BACKGROUND':
          handleVideoRecordedBackground(message.data, sender)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true;

        case 'GET_PENDING_VIDEO_RESULTS':
          handleGetPendingResults(sender)
            .then(results => sendResponse({ success: true, results }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true;

        case 'RECORDING_WINDOW_CLOSED':
          handleRecordingWindowClosed(message, sender);
          sendResponse({ success: true });
          break;

        case 'RECORDING_CANCELLED':
          handleRecordingCancelled(message, sender);
          sendResponse({ success: true });
          break;

        case 'POPUP_OPENED':
          handlePopupOpened(sender)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true;

        // NEW: Region selector communication
        case 'REGION_TAB_READY':
          handleRegionTabReady(message, sender)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true;

        case 'REGION_SELECTED':
          handleRegionSelected(message, sender)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true;

        case 'REGION_CANCELLED':
          handleRegionCancelled(message, sender);
          sendResponse({ success: true });
          break;

        case 'REGION_SELECTOR_DATA':
          handleRegionSelectorData(message, sender)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true;

        default:
          console.log('🤷‍♂️ Unknown message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Handle video recording completion
  async function handleVideoRecorded(videoData: any, sender: chrome.runtime.MessageSender) {
    console.log('🎬 Handling video recording completion:', videoData);

    try {
      // Store video result with timestamp
      const resultId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      pendingVideoResults.set(resultId, {
        ...videoData,
        timestamp: Date.now(),
        senderTabId: sender.tab?.id
      });

      // Try to deliver to popup immediately
      const delivered = await tryDeliverToPopup(videoData);
      
      if (!delivered) {
        console.log('📦 Popup not available, storing result for later delivery');
        
        // Store in chrome.storage as backup
        await chrome.storage.local.set({
          [`pending_video_${resultId}`]: {
            ...videoData,
            timestamp: Date.now(),
            delivered: false
          }
        });

        // Notify about pending result
        await chrome.storage.local.set({
          'has_pending_video_results': true,
          'latest_video_result_id': resultId
        });
      }

      return { delivered, resultId };
    } catch (error) {
      console.error('❌ Error handling video recorded:', error);
      throw error;
    }
  }

  // Handle video recording from background context
  async function handleVideoRecordedBackground(videoData: any, sender: chrome.runtime.MessageSender) {
    console.log('🎬 Handling video recording from background context');
    return handleVideoRecorded(videoData, sender);
  }

  // NEW: Handle region tab ready
  async function handleRegionTabReady(message: any, sender: chrome.runtime.MessageSender) {
    console.log('🎯 Region tab ready, relaying to service...');

    try {
      // Relay message to all extension contexts (popup, options, etc.)
      const relayMessage = {
        type: 'REGION_TAB_READY',
        tabId: sender.tab?.id,
        timestamp: Date.now(),
        originalMessage: message
      };

      // Try to deliver to popup/service
      const delivered = await tryDeliverToExtensionContexts(relayMessage);
      
      if (!delivered) {
        console.log('📦 No extension contexts available, storing region tab ready state');
        // Store the ready state for later pickup
        await chrome.storage.local.set({
          'region_tab_ready': {
            tabId: sender.tab?.id,
            timestamp: Date.now(),
            message: message
          }
        });
      }

      return { delivered, tabId: sender.tab?.id };
    } catch (error) {
      console.error('❌ Error handling region tab ready:', error);
      throw error;
    }
  }

  // NEW: Handle region selected
  async function handleRegionSelected(message: any, sender: chrome.runtime.MessageSender) {
    console.log('🎯 Region selected, relaying to service...');

    try {
      const regionData = {
        type: 'REGION_SELECTED',
        data: message.data,
        caseId: message.caseId,
        tabId: sender.tab?.id,
        timestamp: Date.now()
      };

      // Try to deliver to extension contexts
      const delivered = await tryDeliverToExtensionContexts(regionData);
      
      if (!delivered) {
        console.log('📦 Storing region selection for later pickup');
        
        // Store region selection result
        const resultId = `region_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await chrome.storage.local.set({
          [`pending_region_${resultId}`]: regionData,
          'has_pending_region_result': true,
          'latest_region_result_id': resultId
        });
      }

      return { delivered, regionData };
    } catch (error) {
      console.error('❌ Error handling region selected:', error);
      throw error;
    }
  }

  // NEW: Handle region cancelled
  function handleRegionCancelled(message: any, sender: chrome.runtime.MessageSender) {
    console.log('❌ Region selection cancelled');
    
    // Relay cancellation to extension contexts
    tryDeliverToExtensionContexts({
      type: 'REGION_CANCELLED',
      caseId: message.caseId,
      tabId: sender.tab?.id,
      timestamp: Date.now()
    }).catch(error => {
      console.warn('⚠️ Failed to relay region cancellation:', error);
    });
  }

  // NEW: Handle region selector data relay
  async function handleRegionSelectorData(message: any, sender: chrome.runtime.MessageSender) {
    console.log('📸 Relaying region selector data...');

    try {
      // If message has target tab, send directly to that tab
      if (message.tabId) {
        await chrome.tabs.sendMessage(message.tabId, message);
        return { delivered: true, method: 'direct_tab' };
      }

      // Otherwise, try to find region selector tabs
      const tabs = await chrome.tabs.query({});
      const regionSelectorTabs = tabs.filter(tab => 
        tab.url?.includes('region-selector.html')
      );

      if (regionSelectorTabs.length > 0) {
        // Send to all region selector tabs
        const promises = regionSelectorTabs.map(tab => 
          chrome.tabs.sendMessage(tab.id!, message).catch(error => {
            console.warn(`⚠️ Failed to send to tab ${tab.id}:`, error);
          })
        );
        
        await Promise.allSettled(promises);
        return { delivered: true, method: 'region_tabs', count: regionSelectorTabs.length };
      }

      return { delivered: false, reason: 'no_region_tabs' };
    } catch (error) {
      console.error('❌ Error relaying region selector data:', error);
      throw error;
    }
  }

  // Enhanced: Try to deliver to popup (MV3 compatible)
  async function tryDeliverToPopup(data: any): Promise<boolean> {
    try {
      // Method 1: Try direct runtime message (works if popup is open)
      try {
        await chrome.runtime.sendMessage({
          type: 'VIDEO_RESULT_DELIVERY',
          data: data,
          timestamp: Date.now()
        });
        console.log('📤 Successfully delivered result via runtime message');
        return true;
      } catch (error) {
        console.log('⚠️ Direct runtime message failed, trying alternative methods');
      }

      // Method 2: Try sending to extension tabs
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url?.includes('chrome-extension://')) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: 'VIDEO_RESULT_DELIVERY',
              data: data,
              timestamp: Date.now()
            });
            console.log('📤 Delivered result to extension tab:', tab.id);
            return true;
          } catch (error) {
            // Tab might not be able to receive messages, continue
          }
        }
      }

      console.log('📦 No active popup/tabs found, storing for later pickup');
      return false;

    } catch (error) {
      console.error('❌ Error delivering to popup:', error);
      return false;
    }
  }

  // NEW: Try to deliver to extension contexts (popup, options, etc.)
  async function tryDeliverToExtensionContexts(data: any): Promise<boolean> {
    try {
      // Method 1: Direct runtime message
      try {
        await chrome.runtime.sendMessage(data);
        console.log('📤 Delivered to extension via runtime message');
        return true;
      } catch (error) {
        console.log('⚠️ Runtime message failed, trying extension tabs');
      }

      // Method 2: Extension tabs
      const tabs = await chrome.tabs.query({});
      let delivered = false;
      
      for (const tab of tabs) {
        if (tab.id && tab.url?.includes('chrome-extension://')) {
          try {
            await chrome.tabs.sendMessage(tab.id, data);
            console.log('📤 Delivered to extension tab:', tab.id);
            delivered = true;
          } catch (error) {
            // Continue trying other tabs
          }
        }
      }

      return delivered;
    } catch (error) {
      console.error('❌ Error delivering to extension contexts:', error);
      return false;
    }
  }

  // Enhanced: Handle popup opened - deliver any pending results (MV3 compatible)
  async function handlePopupOpened(sender: chrome.runtime.MessageSender) {
    console.log('🎯 Popup opened, checking for pending results...');

    try {
      const results = { 
        hasPendingVideoResults: false, 
        hasPendingRegionResults: false 
      };

      // Check for pending video results
      const videoStorage = await chrome.storage.local.get(['has_pending_video_results', 'latest_video_result_id']);
      
      if (videoStorage.has_pending_video_results && videoStorage.latest_video_result_id) {
        const resultKey = `pending_video_${videoStorage.latest_video_result_id}`;
        const result = await chrome.storage.local.get([resultKey]);
        
        if (result[resultKey] && !result[resultKey].delivered) {
          console.log('📦 Found pending video result, delivering to popup');
          results.hasPendingVideoResults = true;
          
          // Deliver with delay
          setTimeout(async () => {
            try {
              await chrome.runtime.sendMessage({
                type: 'VIDEO_RESULT_DELIVERY',
                data: result[resultKey],
                timestamp: Date.now()
              });

              // Mark as delivered
              await chrome.storage.local.set({
                [resultKey]: { ...result[resultKey], delivered: true },
                'has_pending_video_results': false
              });

              console.log('✅ Successfully delivered pending video result');
            } catch (error) {
              console.error('❌ Error delivering pending video result:', error);
            }
          }, 1000);
        }
      }

      // NEW: Check for pending region results
      const regionStorage = await chrome.storage.local.get(['has_pending_region_result', 'latest_region_result_id']);
      
      if (regionStorage.has_pending_region_result && regionStorage.latest_region_result_id) {
        const resultKey = `pending_region_${regionStorage.latest_region_result_id}`;
        const result = await chrome.storage.local.get([resultKey]);
        
        if (result[resultKey]) {
          console.log('📦 Found pending region result, delivering to popup');
          results.hasPendingRegionResults = true;
          
          // Deliver with delay
          setTimeout(async () => {
            try {
              await chrome.runtime.sendMessage(result[resultKey]);

              // Clean up
              await chrome.storage.local.remove([
                resultKey, 
                'has_pending_region_result', 
                'latest_region_result_id'
              ]);

              console.log('✅ Successfully delivered pending region result');
            } catch (error) {
              console.error('❌ Error delivering pending region result:', error);
            }
          }, 1500);
        }
      }

      return results;
    } catch (error) {
      console.error('❌ Error handling popup opened:', error);
      throw error;
    }
  }

  // Handle recording window closed
  function handleRecordingWindowClosed(message: any, sender: chrome.runtime.MessageSender) {
    console.log('📄 Recording window closed');
    // Clean up any pending operations related to this recording session
  }

  // Handle recording cancelled
  function handleRecordingCancelled(message: any, sender: chrome.runtime.MessageSender) {
    console.log('❌ Recording cancelled');
    // Clean up any pending operations
  }

  // Get pending video results
  async function handleGetPendingResults(sender: chrome.runtime.MessageSender) {
    console.log('📋 Getting pending results...');

    try {
      const storage = await chrome.storage.local.get();
      const pendingResults = [];

      for (const [key, value] of Object.entries(storage)) {
        if ((key.startsWith('pending_video_') || key.startsWith('pending_region_')) && 
            typeof value === 'object' && value !== null) {
          const result = value as any;
          if (!result.delivered) {
            pendingResults.push({
              id: key,
              ...result
            });
          }
        }
      }

      return pendingResults;
    } catch (error) {
      console.error('❌ Error getting pending results:', error);
      throw error;
    }
  }

  // Cleanup old pending results (run periodically)
  function cleanupOldResults() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    chrome.storage.local.get().then(storage => {
      const keysToRemove = [];
      
      for (const [key, value] of Object.entries(storage)) {
        if ((key.startsWith('pending_video_') || key.startsWith('pending_region_')) && 
            typeof value === 'object' && value !== null) {
          const result = value as any;
          if (result.timestamp && result.timestamp < cutoffTime) {
            keysToRemove.push(key);
          }
        }
      }
      
      if (keysToRemove.length > 0) {
        chrome.storage.local.remove(keysToRemove);
        console.log('🧹 Cleaned up old pending results:', keysToRemove.length);
      }
    }).catch(error => {
      console.error('❌ Error cleaning up old results:', error);
    });
  }

  // Run cleanup every hour
  setInterval(cleanupOldResults, 60 * 60 * 1000);

  // Initial cleanup on startup
  setTimeout(cleanupOldResults, 5000);

  console.log('✅ Background script initialized with region selector support');
});