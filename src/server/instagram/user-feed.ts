import type { InstagramMediaItem, MediaItemResult } from './types';

import { makeSuccessResult } from '../lib/helpers';
import { fetchApi } from './api';
import { makeMediaItemResult } from './helpers';

type InstagramUserFeedResponse = {
	items: Array<InstagramMediaItem>
	more_available: boolean
	next_max_id: string
};

type InstagramUserFeedResult = {
	items: Array<MediaItemResult>
	next?: string
};

export async function fetchInstagramUserFeed(userId: number, next?: string) {
	const fetchResult = await fetchApi<InstagramUserFeedResponse>(`/api/v1/feed/user/${userId}?&max_id=${next}`);
	if (!fetchResult.success) {
		return fetchResult;
	}

	return makeSuccessResult({
		items: fetchResult.data.items.map(item => makeMediaItemResult(item)),
		next: fetchResult.data.next_max_id,
	} satisfies InstagramUserFeedResult);
}
