import type { InstagramMediaItem } from '../lib/instagram/types';
import type { ReelItem, ReelsMedia, Url } from '../lib/types';

import { INSTAGRAM_ORIGIN } from '../lib/constants';
import { findBestCandidate } from '../lib/instagram/helpers';

const STORIES_QUERY_NAME = 'PolarisStoriesV3ReelPageStandaloneQuery';
const DEFAULT_STORIES_DOC_ID = '28449850404637481';

type StoriesResponse = {
	data: {
		xdt_api__v1__feed__reels_media: {
			reels_media: Array<ReelsMediaItem>
		} | null
	} | null
	errors?: Array<{ message: string }>
};

type ReelsMediaItem = {
	items: Array<ReelMediaItem>
	user: {
		username: string
	}
};

type ReelMediaItem = SetRequired<InstagramMediaItem, 'image_versions2'> & {
	media_type: number
	pk: string
};

// FETCH \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export function fetchUserStories(userId: number) {
	return fetchReelsMedia(String(userId));
}

export function fetchHighlightReels(highlightId: string) {
	return fetchReelsMedia(`highlight:${highlightId}`);
}

// Instagram's /api/v1/feed/reels_media/ endpoint is broken server-side, so we use
// the web app's GraphQL query instead. It returns HTML when called from the service
// worker, so the content script calls it with the page origin and cookies.
async function fetchReelsMedia(reelId: string): Promise<ReelsMedia> {
	const { docId, fbDtsg } = findQueryParams();
	if (!fbDtsg) {
		throw new Error('Could not find fb_dtsg in page');
	}

	const body = new URLSearchParams({
		doc_id: docId ?? DEFAULT_STORIES_DOC_ID,
		fb_dtsg: fbDtsg,
		variables: JSON.stringify({
			media_id: null,
			reel_ids_arr: [ reelId ],
			__relay_internal__pv__PolarisCommunityNoteStoriesLabelEnabledrelayprovider: true,
		}),
		server_timestamps: 'true',
	});

	const response = await fetch(`${INSTAGRAM_ORIGIN}/graphql/query`, {
		method: 'POST',
		credentials: 'include',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			'x-csrftoken': document.cookie.match(/csrftoken=([^;]+)/)?.[ 1 ] ?? '',
			'x-fb-friendly-name': STORIES_QUERY_NAME,
		},
		body,
	});
	if (!response.ok) {
		throw new Error(`Stories query failed: HTTP ${response.status}`);
	}

	const data = await response.json() as StoriesResponse;
	const reelsMedia = data.data?.xdt_api__v1__feed__reels_media?.reels_media.at(0);
	if (!reelsMedia) {
		throw new Error(`Stories query: ${data.errors?.[ 0 ]?.message ?? `no reels found for ${reelId}`}`);
	}

	return processReelsMediaItem(reelsMedia);
}

function processReelsMediaItem(reelsMedia: ReelsMediaItem): ReelsMedia {
	const result: ReelsMedia = {
		reels_by_pk: {},
		reels: [],
		username: reelsMedia.user.username,
	};

	for (const item of reelsMedia.items) {
		const image = findBestCandidate(item.image_versions2.candidates).url as Url;
		const reel: ReelItem = { taken_at: item.taken_at * 1000, url: image };

		if (item.media_type === 2 && item.video_versions) {
			reel.url = findBestCandidate(item.video_versions).url as Url;
			reel.poster = image;
		}

		result.reels.push(reel);
		result.reels_by_pk[ item.pk ] = reel;
	}

	return result;
}

// HELPERS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

function findQueryParams() {
	let docId: string | undefined;
	let fbDtsg: string | undefined;

	for (const script of document.querySelectorAll('script[type="application/json"]')) {
		const text = script.textContent;
		fbDtsg ??= text.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/)?.[ 1 ];
		docId ??= text.match(/"queryID":"(\d+)","variables":\{[^}]*\},"queryName":"PolarisStoriesV3ReelPageStandaloneQuery"/)?.[ 1 ];

		if (docId && fbDtsg) {
			break;
		}
	}

	return { docId, fbDtsg };
}
