import type { GetUserFeedMessageResponse } from '../../messages';
import type { InstagramMediaItem } from './types';

import { makeSuccessResult } from '../lib/helpers';
import { fetchApi } from './api';
import { makeMediaItem } from './helpers';

type UserFeedResponse = {
	items: Array<InstagramMediaItem>
	more_available: boolean
	next_max_id: string
};

export async function fetchUserFeed(userId: number, next?: string) {
	const fetchResult = await fetchApi<UserFeedResponse>(`/api/v1/feed/user/${userId}?&max_id=${next}`);
	if (!fetchResult.success) {
		return fetchResult;
	}

	return makeSuccessResult({
		items: fetchResult.data.items.map(item => makeMediaItem(item)),
		next: fetchResult.data.next_max_id,
	} satisfies GetUserFeedMessageResponse);
}
