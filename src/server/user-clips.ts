import type { GetUserClipsMessageResponse } from '../messages';
import type { InstagramMediaItem } from './instagram/types';

import { fetchApi } from './instagram/api';
import { makeMediaItem, makeSuccessResult } from './lib/helpers';

type UserClipsResponse = {
	items: Array<{
		media: InstagramMediaItem
	}>
	paging_info: {
		max_id: string
		more_available: boolean
	}
};

export async function fetchUserClips(userId: number, next?: string) {
	const searchParams = new URLSearchParams();
	searchParams.set('target_user_id', userId.toString());
	searchParams.set('page_size', '12');
	searchParams.set('include_feed_video', '1');
	next && searchParams.set('max_id', next);

	const fetchResult = await fetchApi<UserClipsResponse>('/api/v1/clips/user/', searchParams.toString());
	if (!fetchResult.success) {
		return fetchResult;
	}

	return makeSuccessResult({
		items: fetchResult.data.items.map(item => makeMediaItem(item.media)),
		next: fetchResult.data.paging_info.max_id,
	} satisfies GetUserClipsMessageResponse);
}
