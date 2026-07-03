import type { Url } from '../../lib/types';
import type { GetUserReelsMessageResponse } from '../../messages';
import type { InstagramMediaItem } from './types';

import { makeErrorResult, makeSuccessResult } from '../lib/helpers';
import { fetchApi } from './api';
import { findBestCandidate } from './helpers';

type HighlightResponse = {
	highlights_info: {
		added_to: Array<{
			reel_id: string
			title: string
		}>
	}
	reels_media: Array<ReelsMediaItem>
};

export async function fetchInstagramHighlightReels(highlightId: string) {
	const fetchResult = await fetchApi<HighlightResponse>(`/api/v1/feed/reels_media/?reel_ids=highlight:${highlightId}`);
	if (!fetchResult.success) {
		return fetchResult;
	}

	return processReelsMediaItem(fetchResult.data.reels_media);
}

type ReelsResponse = {
	reels_media: Array<ReelsMediaItem>
};

export async function fetchReels(userId: number) {
	const fetchResult = await fetchApi<ReelsResponse>(`/api/v1/feed/reels_media/?reel_ids=${encodeURIComponent(userId)}`);
	if (!fetchResult.success) {
		return fetchResult;
	}

	return processReelsMediaItem(fetchResult.data.reels_media);
}

function processReelsMediaItem(reelsMedia: Array<ReelsMediaItem>) {
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
				url: findBestCandidate(reel.video_versions).url as Url,
				poster: findBestCandidate(reel.image_versions2.candidates).url as Url,
			};
		}

		return {
			pk: reel.pk,
			taken_at: reel.taken_at * 1000,
			url: findBestCandidate(reel.image_versions2.candidates).url as Url,
		};
	});

	const result: GetUserReelsMessageResponse = {
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

type ReelsMediaItem = {
	items: Array<ReelMediaItem>
	reel_type: string
	user: {
		username: string
	}
};

type ReelMediaItem = SetRequired<InstagramMediaItem, 'image_versions2'> & {
	original_media_type: number
};
