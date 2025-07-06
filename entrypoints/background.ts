// entrypoints/background.ts - Fixed for Manifest V3
export default defineBackground(() => {
  console.log('🚀 Background script started:', { id: browser.runtime.id });

  // Store for video results that couldn't be delivered immediately
  const pendingVideoResults = new Map<string, any>();

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
    
    // Similar to handleVideoRecorded but with additional background-specific logic
    return handleVideoRecorded(videoData, sender);
  }

  // FIXED: Try to deliver video result to popup (MV3 compatible)
  async function tryDeliverToPopup(videoData: any): Promise<boolean> {
    try {
      // Method 1: Try direct runtime message (works if popup is open)
      try {
        await chrome.runtime.sendMessage({
          type: 'VIDEO_RESULT_DELIVERY',
          data: videoData,
          timestamp: Date.now()
        });
        console.log('📤 Successfully delivered video result via runtime message');
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
              data: videoData,
              timestamp: Date.now()
            });
            console.log('📤 Delivered video result to extension tab:', tab.id);
            return true;
          } catch (error) {
            // Tab might not be able to receive messages, continue
          }
        }
      }

      // Method 3: Store for later pickup
      console.log('📦 No active popup/tabs found, storing for later pickup');
      return false;

    } catch (error) {
      console.error('❌ Error delivering to popup:', error);
      return false;
    }
  }

  // FIXED: Handle popup opened - deliver any pending results (MV3 compatible)
  async function handlePopupOpened(sender: chrome.runtime.MessageSender) {
    console.log('🎯 Popup opened, checking for pending video results');

    try {
      // Check for pending results in storage
      const storage = await chrome.storage.local.get(['has_pending_video_results', 'latest_video_result_id']);
      
      if (storage.has_pending_video_results && storage.latest_video_result_id) {
        const resultKey = `pending_video_${storage.latest_video_result_id}`;
        const result = await chrome.storage.local.get([resultKey]);
        
        if (result[resultKey] && !result[resultKey].delivered) {
          console.log('📦 Found pending video result, delivering to popup');
          
          // Send to popup with delay to ensure it's ready
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
              console.error('❌ Error delivering pending result:', error);
            }
          }, 1000); // Small delay to ensure popup is ready

          return { hasPendingResults: true, resultId: storage.latest_video_result_id };
        }
      }

      return { hasPendingResults: false };
    } catch (error) {
      console.error('❌ Error handling popup opened:', error);
      throw error;
    }
  }

  // Handle recording window closed
  function handleRecordingWindowClosed(message: any, sender: chrome.runtime.MessageSender) {
    console.log('📄 Recording window closed');
    
    // Clean up any pending operations related to this recording session
    // Could implement cleanup logic here if needed
  }

  // Handle recording cancelled
  function handleRecordingCancelled(message: any, sender: chrome.runtime.MessageSender) {
    console.log('❌ Recording cancelled');
    
    // Clean up any pending operations
    // Could notify popup about cancellation if needed
  }

  // Get pending video results
  async function handleGetPendingResults(sender: chrome.runtime.MessageSender) {
    console.log('📋 Getting pending video results');

    try {
      const storage = await chrome.storage.local.get();
      const pendingResults = [];

      for (const [key, value] of Object.entries(storage)) {
        if (key.startsWith('pending_video_') && typeof value === 'object' && value !== null) {
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
        if (key.startsWith('pending_video_') && typeof value === 'object' && value !== null) {
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

  console.log('✅ Background script initialized successfully');
});