import type { FailureResult, Result, SuccessResult } from './lib/types';

const AUTH_HEADER_NAMES = [ 'x-ig-app-id', 'x-ig-www-claim', 'x-asbd-id', 'x-instagram-ajax' ];
const INSTAGRAM_ORIGIN = 'https://www.instagram.com';

type DownloadMessage = {
	type: 'download'
	url: string
	filename: string
};

type GetHighlightReelsMessage = {
	type: 'get_highlight_reels'
	highlightId: string
};

type GetMediaInfoMessage = {
	type: 'get_media_info'
	postId: string
};

type GetUserClipsMessage = {
	next?: string
	type: 'get_user_clips'
	userId: number
};

type GetUserFeedMessage = {
	next?: string
	type: 'get_user_feed'
	userId: number
};

type GetUserReelsMessage = {
	type: 'get_user_reels'
	userId: number
};

type GetWebProfileInfoMessage = {
	type: 'get_web_profile_info'
	username: string
};

type Message = DownloadMessage | GetMediaInfoMessage | GetHighlightReelsMessage | GetUserClipsMessage | GetUserFeedMessage | GetUserReelsMessage | GetWebProfileInfoMessage;

chrome.runtime.onMessage.addListener(
	(message: Message, _sender, sendResponse) => {
		if (message.type === 'download') {
			chrome.downloads.download(
				{ url: message.url, filename: message.filename, saveAs: false, conflictAction: 'overwrite' },
				() => sendResponse({ success: !chrome.runtime.lastError }),
			);

			return true;
		} else if (message.type === 'get_media_info') {
			void fetchInstagramMediaInfo(message.postId)
				.then(result => sendResponse(result));

			return true;
		} else if (message.type === 'get_highlight_reels') {
			void fetchInstagramHighlightReels(message.highlightId)
				.then(result => sendResponse(result));

			return true;
		} else if (message.type === 'get_user_clips') {
			void fetchInstagramUserClips(message.userId, message.next)
				.then(result => sendResponse(result));

			return true;
		} else if (message.type === 'get_user_feed') {
			void fetchInstagramUserFeed(message.userId, message.next)
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

async function fetchInstagramApi<T>(path: `/api/v1/${string}`, body?: string): Promise<Result<T>> {
	const headers = await getAuthHeaders();
	if (body) {
		headers[ 'content-type' ] = 'application/x-www-form-urlencoded';
	}

	try {
		const response = await fetch(INSTAGRAM_ORIGIN + path, {
			headers,
			credentials: 'include',
			method: body ? 'POST' : 'GET',
			body,
		});
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

// INSTAGRAM MEDIA INFO ////////////////////////////////////////////////////////////////////////////////////////////////

type InstagramCarouselItem = {
	image_versions2?: {
		candidates: Array<InstagramMediaVersion>
	}
	pk: number
	taken_at: number
	video_url?: string
	video_versions?: Array<InstagramMediaVersion>
};

type InstagramMediaInfoResponse = {
	items: Array<InstagramMediaItem>
};

type InstagramMediaItem = {
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
		taken_at: number
		video?: string
	}>
	image?: string
	taken_at: number
	username: string
	video?: string
};

async function fetchInstagramMediaInfo(postId: string) {
	const fetchResult = await fetchInstagramApi<InstagramMediaInfoResponse>(`/api/v1/media/${encodeURI(postId)}/info/`);
	if (!fetchResult.success) {
		return fetchResult;
	}

	const item = fetchResult.data.items[ 0 ];
	if (!item) {
		return makeErrorResult(`Unexpected empty response for postId ${postId}`);
	}

	return makeSuccessResult(makeMediaInfoResult(item));
}

function makeMediaInfoResult(item: InstagramMediaItem) {
	return {
		carousel_media: makeCarouselResult(item.carousel_media),
		image: makeImageResult(item),
		taken_at: item.taken_at * 1000,
		username: item.user.username,
		video: makeVideoResult(item),
	} satisfies InstagramMediaInfoResult;
}

function makeCarouselResult(items?: Array<InstagramCarouselItem>) {
	return items?.map(media => ({
		image: media.image_versions2 && findBestCandidate(media.image_versions2.candidates).url,
		taken_at: media.taken_at * 1000,
		video: media.video_versions ? findBestCandidate(media.video_versions).url : media.video_url,
	}));
}

function makeImageResult(item: InstagramMediaItem) {
	return item.image_versions2 && findBestCandidate(item.image_versions2.candidates).url;
}

function makeVideoResult(item: InstagramMediaItem) {
	return item.video_versions ? findBestCandidate(item.video_versions).url : item.video_url;
}

// INSTAGRAM REELS /////////////////////////////////////////////////////////////////////////////////////////////////////

type InstagramHighlightResponse = {
	highlights_info: {
		added_to: Array<{
			reel_id: string
			title: string
		}>
	}
	reels_media: Array<InstagramReelsMediaItem>
};

async function fetchInstagramHighlightReels(highlightId: string) {
	const fetchResult = await fetchInstagramApi<InstagramHighlightResponse>(`/api/v1/feed/reels_media/?reel_ids=highlight:${highlightId}`);
	if (!fetchResult.success) {
		return fetchResult;
	}

	return processReelsMediaItem(fetchResult.data.reels_media);
}

type InstagramUserReelsResponse = {
	reels_media: Array<InstagramReelsMediaItem>
};

type InstagramUserReelsResult = {
	reels_by_pk: Record<string, { poster?: string, taken_at: number, url: string }>
	reels: Array<{ poster?: string, taken_at: number, url: string }>
	username: string
};

async function fetchInstagramUserReels(userId: number) {
	const fetchResult = await fetchInstagramApi<InstagramUserReelsResponse>(`/api/v1/feed/reels_media/?reel_ids=${encodeURIComponent(userId)}`);
	if (!fetchResult.success) {
		return fetchResult;
	}

	return processReelsMediaItem(fetchResult.data.reels_media);
}

function processReelsMediaItem(reelsMedia: Array<InstagramReelsMediaItem>) {
	const item = reelsMedia.at(0);
	const items = item?.items;
	if (!items) {
		return makeErrorResult('No reels found');
	}

	const reels = items.map(reel => {
		if (reel.original_media_type === 2 && reel.video_versions) {
			return {
				pk: reel.pk,
				taken_at: reel.taken_at * 1000,
				url: findBestCandidate(reel.video_versions).url,
				poster: findBestCandidate(reel.image_versions2.candidates).url,
			};
		}

		return {
			pk: reel.pk,
			taken_at: reel.taken_at * 1000,
			url: findBestCandidate(reel.image_versions2.candidates).url,
		};
	});

	const result: InstagramUserReelsResult = {
		reels_by_pk: {},
		reels,
		username: item.user.username,
	};

	reels.reduce(($result, reel) => {
		$result.reels_by_pk[ reel.pk.toString(10) ] = {
			taken_at: reel.taken_at,
			url: reel.url,
			poster: reel.poster,
		};

		return $result;
	}, result);

	return makeSuccessResult(result);
}

type InstagramReelsMediaItem = {
	items: Array<InstagramReelMediaItem>
	reel_type: string
	user: {
		username: string
	}
};

type InstagramReelMediaItem = {
	image_versions2: {
		candidates: Array<InstagramMediaVersion>
	}
	original_media_type: number
	pk: number
	taken_at: number
	video_versions?: Array<InstagramMediaVersion>
};

// INSTAGRAM USER CLIPS /////////////////////////////////////////////////////////////////////////////////////////////////

type InstagramClipItem = {
	media: InstagramMediaItem
};

type InstagramClipsFeedResponse = {
	items: Array<InstagramClipItem>
	paging_info: {
		max_id: string
		more_available: boolean
	}
};

type InstagramClipsFeedResult = {
	items: Array<InstagramMediaInfoResult>
	next?: string
};

async function fetchInstagramUserClips(userId: number, next?: string) {
	const searchParams = new URLSearchParams();
	searchParams.set('target_user_id', userId.toString());
	searchParams.set('page_size', '12');
	searchParams.set('include_feed_video', '1');
	next && searchParams.set('max_id', next);

	const fetchResult = await fetchInstagramApi<InstagramClipsFeedResponse>('/api/v1/clips/user/', searchParams.toString());
	if (!fetchResult.success) {
		return fetchResult;
	}

	return makeSuccessResult({
		items: fetchResult.data.items.map(item => makeMediaInfoResult(item.media)),
		next: fetchResult.data.paging_info.max_id,
	} satisfies InstagramClipsFeedResult);
}

// INSTAGRAM USER FEED /////////////////////////////////////////////////////////////////////////////////////////////////

type InstagramUserFeedResponse = {
	items: Array<InstagramMediaItem>
	more_available: boolean
	next_max_id: string
};

type InstagramUserFeedResult = {
	items: Array<InstagramMediaInfoResult>
	next?: string
};

async function fetchInstagramUserFeed(userId: number, next?: string) {
	const fetchResult = await fetchInstagramApi<InstagramUserFeedResponse>(`/api/v1/feed/user/${userId}?&max_id=${next}`);
	if (!fetchResult.success) {
		return fetchResult;
	}

	return makeSuccessResult({
		items: fetchResult.data.items.map(item => makeMediaInfoResult(item)),
		next: fetchResult.data.next_max_id,
	} satisfies InstagramUserFeedResult);
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
	const fetchResult = await fetchInstagramApi<InstagramWebProfileInfoResponse>(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`);
	if (!fetchResult.success) {
		return fetchResult;
	}

	return makeSuccessResult({
		userId: fetchResult.data.data.user.id,
	} satisfies InstagramWebProfileInfoResult);
}

// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function makeErrorResult(err: unknown, prefix?: `${string}: `): FailureResult {
	return { success: false, error: getError(err, prefix) };
}

function makeSuccessResult<T>(data: T): SuccessResult<typeof data> {
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
