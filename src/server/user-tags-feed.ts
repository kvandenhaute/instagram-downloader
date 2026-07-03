import type { GetUserTagsFeedMessageResponse } from '../messages';
import type { InstagramMediaItem } from './instagram/types';

import { fetchApi } from './instagram/api';
import { makeMediaItem, makeSuccessResult } from './lib/helpers';

type UserTagsFeedResponse = {
	items: Array<InstagramMediaItem>
	more_available: boolean
	next_max_id: string
};

export async function fetchUserTagsFeed(userId: number, next?: string) {
	const fetchResult = await fetchApi<UserTagsFeedResponse>(`/api/v1/usertags/${userId}/feed/?&max_id=${next}`);

	console.log(fetchResult);

	if (!fetchResult.success) {
		return fetchResult;
	}

	return makeSuccessResult({
		items: fetchResult.data.items.map(item => makeMediaItem(item)),
		next: fetchResult.data.next_max_id,
	} satisfies GetUserTagsFeedMessageResponse);
}
