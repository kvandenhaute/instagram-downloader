import type { GetMediaInfoMessageResponse } from '../messages';
import type { InstagramMediaItem } from './instagram/types';

import { fetchApi } from './instagram/api';
import { makeErrorResult, makeMediaItem, makeSuccessResult } from './lib/helpers';

type PostResponse = {
	items: Array<InstagramMediaItem>
};

export async function fetchPost(postId: string) {
	const fetchResult = await fetchApi<PostResponse>(`/api/v1/media/${encodeURI(postId)}/info/`);
	if (!fetchResult.success) {
		return fetchResult;
	}

	const item = fetchResult.data.items[ 0 ];
	if (!item) {
		return makeErrorResult(`Unexpected empty response for postId ${postId}`);
	}

	return makeSuccessResult(makeMediaItem(item) satisfies GetMediaInfoMessageResponse);
}
