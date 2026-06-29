const AUTH_HEADER_NAMES = ['x-ig-app-id', 'x-ig-www-claim', 'x-asbd-id', 'x-instagram-ajax'];
const INSTAGRAM_ORIGIN = 'https://www.instagram.com';

chrome.runtime.onMessage.addListener(
	(message: Message, _sender, sendResponse) => {
		if (message.type === 'download') {
			chrome.downloads.download(
				{ url: message.url, filename: message.filename, saveAs: false },
				() => sendResponse({ success: !chrome.runtime.lastError }),
			);
			return true;
		}
		if (message.type === 'get_media_info') {
			fetchMediaInfo(message.postId)
				.then(result => sendResponse(result))
				.catch((err: unknown) => sendResponse({ error: String(err) }));
			return true;
		}
	},
);

chrome.webRequest.onBeforeSendHeaders.addListener(
	(details) => {
		if (!details.requestHeaders?.length) {
			return;
		}

		const updates: StoredHeaders = {};
		for (const header of details.requestHeaders) {
			if (AUTH_HEADER_NAMES.includes(header.name.toLowerCase()) && header.value) {
				updates[header.name.toLowerCase()] = header.value;
			}
		}

		if (!Object.keys(updates).length) {
			return;
		}

		void chrome.storage.local.get('igHeaders').then((data) => {
			const current = (data['igHeaders'] as StoredHeaders | undefined) ?? {};
			void chrome.storage.local.set({
				igHeaders: { ...current, ...updates },
			});
		});
	},
	{ urls: [`${INSTAGRAM_ORIGIN}/*`], types: ['xmlhttprequest'] },
	['requestHeaders', 'extraHeaders'],
);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function fetchMediaInfo(postId: string) {
	const headers = await getAuthHeaders();
	const response = await fetch(`${INSTAGRAM_ORIGIN}/api/v1/media/${postId}/info/`, { headers, credentials: 'include' });
	if (!response.ok) {
		throw new Error(`API ${response.status}`);
	}

	const data = await response.json() as InstagramMediaInfoResponse;

	const item = data.items[0];
	if (!item) {
		throw new Error(`Unexpected empty response for postId ${postId}`);
	}

	const username = item.user.username;

	if (item.video_url) {
		return {
			carousel: typeof item.carousel_media !== 'undefined',
			downloadUrl: item.video_url,
			takenAt: item.taken_at,
			username,
		} satisfies MediaInfoResult;
	}

	const videoVersion = item.video_versions?.[0];
	if (videoVersion) {
		return {
			carousel: typeof item.carousel_media !== 'undefined',
			downloadUrl: videoVersion.url,
			takenAt: item.taken_at,
			username,
		} satisfies MediaInfoResult;
	}

	const candidates = item.image_versions2?.candidates;
	if (candidates?.length) {
		const best = [...candidates].sort((a, b) => b.width - a.width)[0];

		return {
			carousel: typeof item.carousel_media !== 'undefined',
			downloadUrl: best.url,
			takenAt: item.taken_at,
			username,
		} satisfies MediaInfoResult;
	}

	throw new Error('No media url found');
}

async function getAuthHeaders() {
	const [storage, cookie] = await Promise.all([
		chrome.storage.local.get('igHeaders'),
		chrome.cookies.get({
			url: INSTAGRAM_ORIGIN,
			name: 'csrftoken',
		}),
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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

type InstagramCarouselItem = {
	image_versions2?: {
		candidates: Array<InstagramMediaVersion>
	}
	pk: number
	video_url?: string
	video_versions?: Array<InstagramMediaVersion>
};

type InstagramMediaInfoResponse = {
	items: Array<InstagramMediaInfoItem>
};

type InstagramMediaInfoItem = {
	carousel_media?: Array<InstagramCarouselItem>
	image_versions2?: {
		candidates: Array<InstagramMediaVersion>
	}
	pk: number
	taken_at: number
	user: {
		username: string
	}
	video_url?: string
	video_versions?: Array<InstagramMediaVersion>
};

type InstagramMediaVersion = {
	url: string
	width: number
	height: number
};

type MediaInfoResult = {
	carousel: boolean
	downloadUrl: string
	takenAt: number
	username: string
};

type StoredHeaders = Record<string, string>;

type DownloadMessage = {
	type: 'download'
	url: string
	filename: string
};

type GetMediaInfoMessage = {
	type: 'get_media_info'
	postId: string
};

type Message = DownloadMessage | GetMediaInfoMessage;
