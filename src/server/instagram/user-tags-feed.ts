import type { InstagramMediaItem, MediaItemResult } from './types';

import { makeSuccessResult } from '../lib/helpers';
import { fetchApi } from './api';
import { makeMediaItemResult } from './helpers';

type InstagramUserTagsFeedResponse = {
	items: Array<InstagramMediaItem>
	more_available: boolean
	next_max_id: string
};

type InstagramUserTagsFeedResult = {
	items: Array<MediaItemResult>
	next?: string
};

export async function fetchInstagramUserTagsFeed(userId: number, next?: string) {
	const fetchResult = await fetchApi<InstagramUserTagsFeedResponse>(`/api/v1/usertags/${userId}/feed/?&max_id=${next}`);

	console.log(fetchResult);

	if (!fetchResult.success) {
		return fetchResult;
	}

	return makeSuccessResult({
		items: fetchResult.data.items.map(item => makeMediaItemResult(item)),
		next: fetchResult.data.next_max_id,
	} satisfies InstagramUserTagsFeedResult);
}
