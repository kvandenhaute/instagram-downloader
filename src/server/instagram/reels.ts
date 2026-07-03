import type { InstagramMediaItem } from './types';

import { makeErrorResult, makeSuccessResult } from '../lib/helpers';
import { fetchApi } from './api';
import { findBestCandidate } from './helpers';

type InstagramHighlightResponse = {
	highlights_info: {
		added_to: Array<{
			reel_id: string
			title: string
		}>
	}
	reels_media: Array<InstagramReelsMediaItem>
};

export async function fetchInstagramHighlightReels(highlightId: string) {
	const fetchResult = await fetchApi<InstagramHighlightResponse>(`/api/v1/feed/reels_media/?reel_ids=highlight:${highlightId}`);
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

export async function fetchInstagramUserReels(userId: number) {
	const fetchResult = await fetchApi<InstagramUserReelsResponse>(`/api/v1/feed/reels_media/?reel_ids=${encodeURIComponent(userId)}`);
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

type InstagramReelMediaItem = SetRequired<InstagramMediaItem, 'image_versions2'> & {
	original_media_type: number
};
