chrome.runtime.onInstalled.addListener(async () => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  const existing = await chrome.storage.sync.get("canvaMultiDownloadSettings");
  if (!existing.canvaMultiDownloadSettings) {
    chrome.storage.sync.set({
      canvaMultiDownloadSettings: {
        formats: ["PNG", "PDF Standard"],
        delayMs: 3500,
        pageRanges: {},
        saveConfig: false,
        keepPanelOpen: true
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CANVA_MULTI_LOG") {
    chrome.runtime.sendMessage(message).catch?.(() => {});
    return false;
  }

  if (message?.type !== "CANVA_MULTI_DOWNLOAD" && message?.type !== "CANVA_MULTI_DEBUG") return false;

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const isCanva = tab?.url?.startsWith("https://www.canva.com/") ||
      tab?.url?.startsWith("https://canva.com/");

    if (!tab?.id || !isCanva) {
      sendResponse({ ok: false, error: "Buka halaman editor Canva dulu." });
      return;
    }

    chrome.tabs.sendMessage(tab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          ok: false,
          error: "Content script belum aktif. Refresh tab Canva lalu coba lagi."
        });
        return;
      }

      sendResponse(response || { ok: true });
    });
  });

  return true;
});
