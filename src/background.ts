import type { Message, MuxResponse, OffscreenMessage } from './messages';

import { INSTAGRAM_ORIGIN } from './lib/constants';

chrome.runtime.onMessage.addListener(
	(message: Message, _sender, sendResponse) => {
		if (message.type === 'download') {
			chrome.downloads.download(
				{ url: message.url, filename: message.filename, saveAs: false, conflictAction: 'overwrite' },
				() => sendResponse({ success: !chrome.runtime.lastError }),
			);

			return true;
		} else if (message.type === 'download_merged') {
			void downloadMerged(message.videoUrl, message.audioUrl, message.filename)
				.then(() => sendResponse({ success: true }))
				.catch((err: unknown) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));

			return true;
		}
	},
);

// MERGED DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
const OFFSCREEN_URL = 'src/offscreen.html';

let creatingOffscreen: Promise<void> | null = null;

async function downloadMerged(videoUrl: string, audioUrl: string, filename: string) {
	await ensureOffscreenDocument();

	const response = await chrome.runtime.sendMessage<OffscreenMessage, MuxResponse>({ target: 'offscreen', type: 'mux', videoUrl, audioUrl });
	if (!response.success) {
		throw new Error(response.error);
	}

	const downloadId = await chrome.downloads.download({ url: response.url, filename, saveAs: false, conflictAction: 'overwrite' });
	revokeWhenDone(downloadId, response.url);
}

async function ensureOffscreenDocument() {
	const contexts = await chrome.runtime.getContexts({
		contextTypes: [ chrome.runtime.ContextType.OFFSCREEN_DOCUMENT ],
		documentUrls: [ chrome.runtime.getURL(OFFSCREEN_URL) ],
	});
	if (contexts.length) {
		return;
	}

	creatingOffscreen ??= chrome.offscreen.createDocument({
		url: OFFSCREEN_URL,
		reasons: [ chrome.offscreen.Reason.BLOBS ],
		justification: 'Merge the video and audio of a download into one file',
	}).finally(() => (creatingOffscreen = null));

	return creatingOffscreen;
}

function revokeWhenDone(downloadId: number, url: string) {
	const listener = (delta: chrome.downloads.DownloadDelta) => {
		if (delta.id !== downloadId || !delta.state || delta.state.current === 'in_progress') {
			return;
		}

		chrome.downloads.onChanged.removeListener(listener);
		void chrome.runtime.sendMessage<OffscreenMessage>({ target: 'offscreen', type: 'revoke', url });
	};

	chrome.downloads.onChanged.addListener(listener);
}

const GRAPHQL_QUERY_NAMES: Record<string, string> = {
	PolarisProfileTaggedTabContentQuery: 'igTaggedQuery',
};

chrome.webRequest.onBeforeRequest.addListener(
	details => {
		const formData = details.requestBody?.formData;
		if (!formData) {
			return;
		}

		const getString = (key: string): string | undefined => {
			const val = formData[ key ];

			return val instanceof ArrayBuffer ? undefined : (val as string[] | undefined)?.[ 0 ];
		};

		const friendlyName = getString('fb_api_req_friendly_name');
		const storageKey = friendlyName && GRAPHQL_QUERY_NAMES[ friendlyName ];
		if (!storageKey) {
			return;
		}

		const docId = getString('doc_id');
		const fbDtsg = getString('fb_dtsg');
		const lsd = getString('lsd');
		const av = getString('av');

		if (docId && fbDtsg && lsd) {
			void chrome.storage.local.set({ [ storageKey ]: { docId, fbDtsg, lsd, av } });
		}
	},
	{ urls: [ `${INSTAGRAM_ORIGIN}/graphql/query*` ], types: [ 'xmlhttprequest' ] },
	[ 'requestBody' ],
);
