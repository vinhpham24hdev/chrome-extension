/**
 * Region Selector – background/region.ts
 * Một file duy nhất: lắng nghe REGION_START, chụp ảnh, inject overlay.
 */
export const REGION_MESSAGE      = 'REGION_START';
export const REGION_DONE_MESSAGE = 'REGION_DONE';
const   OVERLAY_PORT_NAME        = 'REGION_OVERLAY';
const   OVERLAY_JS_PATH          = 'entrypoints/region-overlay.js';

/**
 * Bắt đầu Region Selector.
 * @param tabId (tuỳ chọn) Tab cần crop. Nếu không truyền sẽ lấy tab active.
 */
export async function startRegionCapture(tabId?: number): Promise<void> {
  /* 1️⃣ Xác định tab & window */
  let tab: chrome.tabs.Tab;
  if (tabId != null) {
    tab = await chrome.tabs.get(tabId);
  } else {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  }
  if (!tab?.id) throw new Error('No active tab');
  if (tab.windowId == null) throw new Error('Tab missing windowId');

  /* 2️⃣ Chụp bitmap */
  const png = await chrome.tabs.captureVisibleTab(
    tab.windowId,
    { format: 'png' }                         // ImageDetails
  );
  if (!png) throw new Error('captureVisibleTab returned empty dataURL');

  /* 3️⃣ Inject overlay JS */
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files : [chrome.runtime.getURL(OVERLAY_JS_PATH)],
  });

  /* 4️⃣ Truyền PNG qua persistent port */
  const port = chrome.tabs.connect(tab.id, { name: OVERLAY_PORT_NAME });
  port.postMessage({ png });
}

/*───────────────────────────────────────────────────────*\
|*  Global listener: popup gửi {type:'REGION_START'}      *|
\*───────────────────────────────────────────────────────*/
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== REGION_MESSAGE) return;

  startRegionCapture(sender.tab?.id)
    .then(()  => sendResponse({ ok: true }))
    .catch(err => sendResponse({ ok: false, error: String(err) }));

  return true;              // async
});
