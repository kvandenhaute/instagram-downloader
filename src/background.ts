const INSTAGRAM_ORIGIN = 'https://www.instagram.com';
const AUTH_HEADER_NAMES = ['x-ig-app-id', 'x-ig-www-claim', 'x-asbd-id', 'x-instagram-ajax'];

interface StoredHeaders {
	[key: string]: string
}

interface MediaItem {
	video_url?: string
	video_versions?: Array<{ url: string, width: number, height: number }>
}

interface MediaInfoResponse {
	items: MediaItem[]
}

type DownloadMessage = {
	type: 'download'
	url: string
	filename: string
};

type GetVideoUrlMessage = {
	type: 'get_video_url'
	postId: string
};

type Message = DownloadMessage | GetVideoUrlMessage;

// Intercept Instagram's eigen XHR-verzoeken om auth-headers te kopiëren
chrome.webRequest.onBeforeSendHeaders.addListener(
	(details) => {
		if (!details.requestHeaders?.length) return;
		const updates: StoredHeaders = {};
		for (const header of details.requestHeaders) {
			if (AUTH_HEADER_NAMES.includes(header.name.toLowerCase()) && header.value) {
				updates[header.name.toLowerCase()] = header.value;
			}
		}
		if (!Object.keys(updates).length) return;
		void chrome.storage.local.get('igHeaders').then((data) => {
			const current = (data['igHeaders'] as StoredHeaders | undefined) ?? {};
			void chrome.storage.local.set({ igHeaders: { ...current, ...updates } });
		});
	},
	{ urls: [`${INSTAGRAM_ORIGIN}/*`], types: ['xmlhttprequest'] },
	['requestHeaders', 'extraHeaders'],
);

async function getAuthHeaders(): Promise<Record<string, string>> {
	const [storage, cookie] = await Promise.all([
		chrome.storage.local.get('igHeaders'),
		chrome.cookies.get({ url: INSTAGRAM_ORIGIN, name: 'csrftoken' }),
	]);
	const headers: Record<string, string> = {
		'x-requested-with': 'XMLHttpRequest',
		...((storage['igHeaders'] as StoredHeaders | undefined) ?? {}),
	};
	if (cookie?.value) {
		headers['x-csrftoken'] = cookie.value;
	}
	return headers;
}

async function fetchVideoUrl(postId: string): Promise<string> {
	const headers = await getAuthHeaders();
	const res = await fetch(`${INSTAGRAM_ORIGIN}/api/v1/media/${postId}/info/`, { headers, credentials: 'include' });
	if (!res.ok) throw new Error(`API ${res.status}`);
	const data = await res.json() as MediaInfoResponse;
	const item = data.items[0];
	if (!item) throw new Error('leeg antwoord van API');
	if (item.video_url) return item.video_url;
	const version = item.video_versions?.[0];
	if (version) return version.url;
	throw new Error('geen video_url in API-antwoord');
}

chrome.runtime.onMessage.addListener(
	(message: Message, _sender, sendResponse) => {
		if (message.type === 'download') {
			chrome.downloads.download(
				{ url: message.url, filename: message.filename, saveAs: false },
				() => sendResponse({ success: !chrome.runtime.lastError }),
			);
			return true;
		}
		if (message.type === 'get_video_url') {
			fetchVideoUrl(message.postId)
				.then(url => sendResponse({ url }))
				.catch((err: unknown) => sendResponse({ error: String(err) }));
			return true;
		}
	},
);
