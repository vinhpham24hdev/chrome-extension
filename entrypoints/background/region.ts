export async function startRegionCapture(tabId?: number) {
  const [tab] = tabId
    ? [await chrome.tabs.get(tabId)]
    : await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.windowId == null) throw new Error('No active tab');

  const png = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

  await chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      files: [chrome.runtime.getURL('content-scripts/region-overlay.js')],
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error('inject error', chrome.runtime.lastError);
        return;
      }
      const port = chrome.tabs.connect(tab.id!, { name: 'REGION_OVERLAY' });
      port.postMessage({ png });
    },
  );
}

chrome.runtime.onMessage.addListener((msg, sender, sendRes) => {
  if (msg.type !== 'REGION_START') return;
  startRegionCapture(sender.tab?.id)
    .then(() => sendRes({ ok: true }))
    .catch(err => sendRes({ ok: false, error: String(err) }));
  return true;
});
