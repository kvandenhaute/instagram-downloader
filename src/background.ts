const AUTH_HEADER_NAMES = [ 'x-ig-app-id', 'x-ig-www-claim', 'x-asbd-id', 'x-instagram-ajax' ];
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
			fetchInstagramMediaInfo(message.postId)
				.then(result => sendResponse(result))
				.catch((err: unknown) => sendResponse({ error: String(err) }));
			return true;
		}
	},
);

chrome.webRequest.onBeforeSendHeaders.addListener(
	details => {
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

		void chrome.storage.local.get('igHeaders').then(data => {
			const current = (data['igHeaders'] as StoredHeaders | undefined) ?? {};
			void chrome.storage.local.set({
				igHeaders: { ...current, ...updates },
			});
		});
	},
	{ urls: [ `${INSTAGRAM_ORIGIN}/*` ], types: [ 'xmlhttprequest' ] },
	[ 'requestHeaders', 'extraHeaders' ],
);

// INSTAGRAM MEDIA INFO ////////////////////////////////////////////////////////////////////////////////////////////////

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

async function fetchInstagramMediaInfo(postId: string) {
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

	return {
		carousel_media: item.carousel_media?.map(media => ({
			image: media.image_versions2 && findBestCandidate(media.image_versions2.candidates).url,
			video: media.video_versions ? findBestCandidate(media.video_versions).url : media.video_url,
		})),
		image: item.image_versions2 && findBestCandidate(item.image_versions2.candidates).url,
		taken_at: item.taken_at,
		username: item.user.username,
		video: item.video_versions ? findBestCandidate(item.video_versions).url : item.video_url,
	} satisfies MediaInfoResult;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function findBestCandidate(candidates: Array<InstagramMediaVersion>) {
	return [ ...candidates ].sort((a, b) => b.width - a.width)[0];
}

async function getAuthHeaders() {
	const [ storage, cookie ] = await Promise.all([
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

type MediaInfoResult = {
	carousel_media?: Array<{
		image?: string
		video?: string
	}>
	image?: string
	taken_at: number
	username: string
	video?: string
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
