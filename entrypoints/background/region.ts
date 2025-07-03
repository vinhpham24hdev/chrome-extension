export async function startRegionCapture(tabId?: number) {
  /* 1️⃣ Lấy tab đang active (nếu tabId chưa truyền) */
  let tab: chrome.tabs.Tab;
  if (tabId != null) {
    tab = await chrome.tabs.get(tabId);
  } else {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  }
  if (!tab?.id || tab.windowId == null) throw new Error("No active tab");

  /* 2️⃣ Capture bitmap */
  const png = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  console.log("[BG] PNG length:", png.length);

  /* 3️⃣ Inject overlay trước */
  await chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      files: [chrome.runtime.getURL("content-scripts/region-overlay.js")],
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error("[BG] inject error", chrome.runtime.lastError);
        return;
      }
      console.log("[BG] overlay injected OK");

      /* 4️⃣ Mở port an toàn – tab.id chắc chắn là number */
      const port = chrome.tabs.connect(tab.id!, { name: "REGION_OVERLAY" });
      console.log("[BG] port opened → send PNG");
      port.postMessage({ png });
    }
  );
}

chrome.runtime.onMessage.addListener((msg, sender, sendRes) => {
  if (msg.type !== "REGION_START") return;
  startRegionCapture(sender.tab?.id)
    .then(() => sendRes({ ok: true }))
    .catch((err) => sendRes({ ok: false, error: String(err) }));
  return true; // async
});
