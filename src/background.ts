import { FailureResult, Result, SuccessResult } from './types';

const AUTH_HEADER_NAMES = [ 'x-ig-app-id', 'x-ig-www-claim', 'x-asbd-id', 'x-instagram-ajax' ];
const INSTAGRAM_ORIGIN = 'https://www.instagram.com';

type DownloadMessage = {
	type: 'download'
	url: string
	filename: string
};

type GetMediaInfoMessage = {
	type: 'get_media_info'
	postId: string
};

type GetWebProfileInfoMessage = {
	type: 'get_web_profile_info'
	username: string
};

type GetUserReelsMessage = {
	type: 'get_user_reels'
	userId: number
};

type Message = DownloadMessage | GetMediaInfoMessage | GetUserReelsMessage | GetWebProfileInfoMessage;

chrome.runtime.onMessage.addListener(
	(message: Message, _sender, sendResponse) => {
		if (message.type === 'download') {
			chrome.downloads.download(
				{ url: message.url, filename: message.filename, saveAs: false },
				() => sendResponse({ success: !chrome.runtime.lastError }),
			);

			return true;
		} else if (message.type === 'get_media_info') {
			void fetchInstagramMediaInfo(message.postId)
				.then(result => sendResponse(result));

			return true;
		} else if (message.type === 'get_user_reels') {
			void fetchInstagramUserReels(message.userId)
				.then(result => sendResponse(result));

			return true;
		} else if (message.type === 'get_web_profile_info') {
			void fetchInstagramWebProfileInfo(message.username)
				.then(result => sendResponse(result));

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
				updates[ header.name.toLowerCase() ] = header.value;
			}
		}

		if (!Object.keys(updates).length) {
			return;
		}

		void chrome.storage.local.get('igHeaders').then(data => {
			const current = (data[ 'igHeaders' ] as StoredHeaders | undefined) ?? {};
			void chrome.storage.local.set({
				igHeaders: { ...current, ...updates },
			});
		});
	},
	{ urls: [ `${INSTAGRAM_ORIGIN}/*` ], types: [ 'xmlhttprequest' ] },
	[ 'requestHeaders', 'extraHeaders' ],
);

// INSTAGRAM ///////////////////////////////////////////////////////////////////////////////////////////////////////////

type StoredHeaders = Record<string, string>;

type InstagramMediaVersion = {
	url: string
	width: number
	height: number
};

async function fetchInstagramApi<T>(path: `/api/v1/${string}`): Promise<Result<T>> {
	const headers = await getAuthHeaders();

	try {
		const response = await fetch(INSTAGRAM_ORIGIN + path, { headers, credentials: 'include' });
		if (!response.ok) {
			return makeErrorResult(response.statusText);
		}

		const data = await response.json() as T;

		return makeSuccessResult(data);
	} catch (err) {
		return makeErrorResult(err, 'Instagram fetch: ');
	}
}

function findBestCandidate(candidates: Array<InstagramMediaVersion>) {
	return [ ...candidates ].sort((a, b) => b.width - a.width)[ 0 ];
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
		...((storage[ 'igHeaders' ] as StoredHeaders | undefined) ?? {}),
	};

	if (cookie?.value) {
		headers[ 'x-csrftoken' ] = cookie.value;
	}

	return headers;
}

// INSTAGRAM REELS /////////////////////////////////////////////////////////////////////////////////////////////////////

type InstagramUserReelsResponse = {
	reels_media: Array<{
		items: Array<{
			image_versions2: {
				candidates: Array<InstagramMediaVersion>
			}
			pk: number
			taken_at: number
			video_versions?: Array<InstagramMediaVersion>
		}>
	}>
};

type InstagramUserReelsResult = {
	reels_by_pk: Record<string, { taken_at: number, url: string }>
	reels: Array<{ taken_at: number, url: string }>
};

async function fetchInstagramUserReels(userId: number) {
	const fetchReelsResult = await fetchInstagramApi<InstagramUserReelsResponse>(`/api/v1/feed/reels_media/?reel_ids=${encodeURIComponent(userId)}`);
	if (!fetchReelsResult.success) {
		return fetchReelsResult;
	}

	const items = fetchReelsResult.data.reels_media.at(0)?.items;
	if (!items) {
		return makeErrorResult('No reels found');
	}

	const reels = items.map(reel => {
		if (reel.video_versions) {
			return {
				pk: reel.pk,
				takenAt: reel.taken_at,
				url: findBestCandidate(reel.video_versions).url,
			};
		}

		return {
			pk: reel.pk,
			takenAt: reel.taken_at,
			url: findBestCandidate(reel.image_versions2.candidates).url,
		};
	});

	const result: InstagramUserReelsResult = {
		reels_by_pk: {},
		reels: reels.map(reel => ({
			taken_at: reel.takenAt,
			url: reel.url,
		})),
	};

	reels.reduce(($result, reel) => {
		$result.reels_by_pk[ reel.pk.toString(10) ] = {
			taken_at: reel.takenAt,
			url: reel.url,
		};

		return $result;
	}, result);

	return makeSuccessResult(result);
}

// INSTAGRAM WEB PROFILE INFO //////////////////////////////////////////////////////////////////////////////////////////

type InstagramWebProfileInfoResponse = {
	data: {
		user: {
			id: number
		}
	}
};

type InstagramWebProfileInfoResult = {
	userId: number
};

async function fetchInstagramWebProfileInfo(username: string) {
	const fetchWebProfileInfoResult = await fetchInstagramApi<InstagramWebProfileInfoResponse>(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`);
	if (!fetchWebProfileInfoResult.success) {
		return fetchWebProfileInfoResult;
	}

	return makeSuccessResult({
		userId: fetchWebProfileInfoResult.data.data.user.id,
	} satisfies InstagramWebProfileInfoResult);
}

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

type InstagramMediaInfoResult = {
	carousel_media?: Array<{
		image?: string
		video?: string
	}>
	image?: string
	taken_at: number
	username: string
	video?: string
};

async function fetchInstagramMediaInfo(postId: string) {
	const fetchInstagramMediaInfoResult = await fetchInstagramApi<InstagramMediaInfoResponse>(`/api/v1/media/${encodeURI(postId)}/info/`);
	if (!fetchInstagramMediaInfoResult.success) {
		return fetchInstagramMediaInfoResult;
	}

	const item = fetchInstagramMediaInfoResult.data.items[ 0 ];
	if (!item) {
		return makeErrorResult(`Unexpected empty response for postId ${postId}`);
	}

	return makeSuccessResult({
		carousel_media: item.carousel_media?.map(media => ({
			image: media.image_versions2 && findBestCandidate(media.image_versions2.candidates).url,
			video: media.video_versions ? findBestCandidate(media.video_versions).url : media.video_url,
		})),
		image: item.image_versions2 && findBestCandidate(item.image_versions2.candidates).url,
		taken_at: item.taken_at,
		username: item.user.username,
		video: item.video_versions ? findBestCandidate(item.video_versions).url : item.video_url,
	} satisfies InstagramMediaInfoResult);
}

// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function makeErrorResult(err: unknown, prefix?: `${string}: `): FailureResult {
	return { success: false, error: getError(err, prefix) };
}

function makeSuccessResult(): SuccessResult<undefined>;
function makeSuccessResult<T>(data: T): SuccessResult<typeof data>;
function makeSuccessResult<T>(data?: T) {
	return { success: true, data };
}

function getError(err: unknown, prefix?: `${string}: `) {
	if (err instanceof Error) {
		if (prefix) {
			return new Error(prefix + err.message, { cause: err });
		}

		return err;
	} else if (typeof err === 'string') {
		return new Error(prefix ? prefix + err : err);
	}

	return new Error(prefix ? prefix + 'Something unexpected occurred.' : 'Something unexpected occurred.');
}
