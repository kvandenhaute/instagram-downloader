import pMap from 'p-map';

import type { GetUserTagsFeedMessageResponse } from '../messages';

import { fetchApi } from './instagram/api';
import { makeErrorResult, makeSuccessResult } from './lib/helpers';
import { fetchPost } from './posts';

type StoredTaggedQuery = {
	docId: string
	fbDtsg: string
	lsd: string
	av?: string
};

type TaggedFeedNode = {
	pk: string
};

type UserTagsFeedResponse = {
	data: {
		xdt_api__v1__usertags__user_id__feed_connection: {
			edges: Array<{ node: TaggedFeedNode }>
			page_info: {
				end_cursor: string
				has_next_page: boolean
			}
		}
	}
};

export async function fetchUserTagsFeed(userId: number, next?: string) {
	const storage = await chrome.storage.local.get('igTaggedQuery');
	const query = storage[ 'igTaggedQuery' ] as StoredTaggedQuery | undefined;
	if (!query) {
		return makeErrorResult('Geen query gevonden — bezoek eerst het Tagged-tabblad op een Instagram-profiel');
	}

	const body = new URLSearchParams({
		doc_id: query.docId,
		fb_dtsg: query.fbDtsg,
		lsd: query.lsd,
		variables: JSON.stringify({ count: 12, user_id: String(userId), ...(next ? { after: next } : {}) }),
		server_timestamps: 'true',
		__a: '1',
	});

	if (query.av) {
		body.set('av', query.av);
	}

	const fetchResult = await fetchApi<UserTagsFeedResponse>('/graphql/query', body.toString());
	if (!fetchResult.success) {
		return fetchResult;
	}

	const feed = fetchResult.data.data.xdt_api__v1__usertags__user_id__feed_connection;
	const items = await pMap(
		feed.edges,
		async edge => {
			const result = await fetchPost(edge.node.pk);

			return result.success ? result.data : null;
		},
		{ concurrency: 5 },
	);

	return makeSuccessResult({
		items: items.filter(item => item !== null),
		next: feed.page_info.has_next_page ? feed.page_info.end_cursor : undefined,
	} satisfies GetUserTagsFeedMessageResponse);
}
