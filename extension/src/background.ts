type DownloadRequest = {
  type: "DOWNLOAD_FILES";
  files: Array<{ filename: string; mimeType: string; content: string }>;
};

chrome.runtime.onMessage.addListener((message: DownloadRequest, _sender, sendResponse) => {
  if (message?.type !== "DOWNLOAD_FILES") return undefined;
  void (async () => {
    try {
      for (const file of message.files) {
        const url = `data:${file.mimeType};charset=utf-8,${encodeURIComponent(file.content)}`;
        await chrome.downloads.download({ url, filename: file.filename, conflictAction: "uniquify", saveAs: false });
      }
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();
  return true;
});
