import pMap from 'p-map';

import type { MediaFeedPage } from '../lib/types';

import { logError } from '../lib/logger';
import { fetchApi } from './api';
import * as Buttons from './helpers/buttons';
import { downloadManyFromCarousel, downloadOne, getMediaInfo, hasCarousel, mapPostIdToShortcode } from './media';
import { getWebProfileInfo } from './profile';

// FETCH \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

type StoredTaggedQuery = {
	docId: string
	fbDtsg: string
	lsd: string
	av?: string
};

type UserTagsFeedResponse = {
	data: {
		xdt_api__v1__usertags__user_id__feed_connection: {
			edges: Array<{ node: { pk: string } }>
			page_info: {
				end_cursor: string
				has_next_page: boolean
			}
		}
	}
};

// doc_id, fb_dtsg and lsd are captured by the background from Instagram's own
// request, so the Tagged tab has to be opened first.
async function getUserTagsFeed(userId: number, next?: string): Promise<MediaFeedPage> {
	const storage = await chrome.storage.local.get('igTaggedQuery');
	const query = storage[ 'igTaggedQuery' ] as StoredTaggedQuery | undefined;
	if (!query) {
		throw new Error('No tagged query found, open the Tagged tab of a profile first');
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

	const data = await fetchApi<UserTagsFeedResponse>('/graphql/query', body);
	const feed = data.data.xdt_api__v1__usertags__user_id__feed_connection;
	const items = await pMap(
		feed.edges,
		edge => getMediaInfo(mapPostIdToShortcode(edge.node.pk)).catch((err: unknown) => {
			logError(`Could not fetch tagged post ${edge.node.pk}`, err);

			return null;
		}),
		{ concurrency: 5 },
	);

	return {
		items: items.filter(item => item !== null),
		next: feed.page_info.has_next_page ? feed.page_info.end_cursor : undefined,
	};
}

// DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

async function downloadAllPosts() {
	const username = window.location.href.match(/instagram\.com\/([^/?]+)/)?.[ 1 ];
	if (!username) {
		return logError('No username found in url');
	}

	const webProfileInfo = await getWebProfileInfo(username);

	async function _downloadPosts($username: string, response: MediaFeedPage): Promise<unknown> {
		const nextUserFeedResponse: Promise<MediaFeedPage> | null = typeof response.next === 'string' ? getUserTagsFeed(webProfileInfo.userId, response.next) : null;

		await pMap(response.items, async item => {
			if (hasCarousel(item)) {
				return downloadManyFromCarousel(item);
			}

			return downloadOne(item);
		}, { concurrency: 3 });

		if (!nextUserFeedResponse) {
			return;
		}

		return nextUserFeedResponse.then($response => _downloadPosts($username, $response));
	}

	const userFeed = await getUserTagsFeed(webProfileInfo.userId);

	return _downloadPosts(username, userFeed);
}

// BUTTONS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export function makeDownloadButton() {
	const downloadButton = Buttons.makeDownloadButton('profile', { className: 'user-tags-feed', text: 'Tagged' });
	downloadButton.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();

		downloadButton.disabled = true;

		void downloadAllPosts()
			.catch(logError)
			.finally(() => (downloadButton.disabled = false));
	});

	return downloadButton;
}
