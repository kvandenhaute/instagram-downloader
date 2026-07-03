import type { InstagramMediaItem, MediaItemResult } from './types';

import { makeSuccessResult } from '../lib/helpers';
import { fetchApi } from './api';
import { makeMediaItemResult } from './helpers';

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
	items: Array<MediaItemResult>
	next?: string
};

export async function fetchInstagramUserClips(userId: number, next?: string) {
	const searchParams = new URLSearchParams();
	searchParams.set('target_user_id', userId.toString());
	searchParams.set('page_size', '12');
	searchParams.set('include_feed_video', '1');
	next && searchParams.set('max_id', next);

	const fetchResult = await fetchApi<InstagramClipsFeedResponse>('/api/v1/clips/user/', searchParams.toString());
	if (!fetchResult.success) {
		return fetchResult;
	}

	return makeSuccessResult({
		items: fetchResult.data.items.map(item => makeMediaItemResult(item.media)),
		next: fetchResult.data.paging_info.max_id,
	} satisfies InstagramClipsFeedResult);
}
