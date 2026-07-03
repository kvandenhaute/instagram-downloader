import type { InstagramMediaItem } from './types';

import { makeErrorResult, makeSuccessResult } from '../lib/helpers';
import { fetchApi } from './api';
import { makeMediaItemResult } from './helpers';

type InstagramPostResponse = {
	items: Array<InstagramMediaItem>
};

export async function fetchPost(postId: string) {
	const fetchResult = await fetchApi<InstagramPostResponse>(`/api/v1/media/${encodeURI(postId)}/info/`);
	if (!fetchResult.success) {
		return fetchResult;
	}

	const item = fetchResult.data.items[ 0 ];
	if (!item) {
		return makeErrorResult(`Unexpected empty response for postId ${postId}`);
	}

	return makeSuccessResult(makeMediaItemResult(item));
}
