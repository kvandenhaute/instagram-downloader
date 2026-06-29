interface DownloadMessage {
	type: 'download'
	url: string
	filename: string
}

chrome.runtime.onMessage.addListener(
	(message: DownloadMessage, _sender, sendResponse) => {
		if (message.type !== 'download') return;
		chrome.downloads.download(
			{ url: message.url, filename: message.filename, saveAs: false },
			() => sendResponse({ success: !chrome.runtime.lastError }),
		);
		return true;
	},
);
