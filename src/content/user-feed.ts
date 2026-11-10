import pMap from 'p-map';

import type { ShortcodeFeedPage } from '../lib/types';

import { logError } from '../lib/logger';
import { fetchApi, findFbDtsg } from './api';
import * as Buttons from './helpers/buttons';
import { downloadManyFromCarousel, downloadOne, getMediaInfo, hasCarousel } from './media';

// FETCH \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

const FEED_QUERY_NAME = 'PolarisProfilePostsTabContentQuery_connection';
const FEED_DOC_ID = '30219963740926411';

type UserFeedResponse = {
	data: {
		xdt_api__v1__feed__user_timeline_graphql_connection: {
			edges: Array<{ node: { code: string } }>
			page_info: {
				end_cursor: string | null
				has_next_page: boolean
			}
		} | null
	} | null
	errors?: Array<{ message: string }>
};

// The web app's own query for the posts grid of a profile; /api/v1/feed/user/
// returns a 404. The response usually has a field_exception for
// location.profile_pic_url, Instagram's own requests too, so errors only count
// when there is no data. Instagram rotates the doc_id now and then.
async function getUserFeed(username: string, next?: string): Promise<ShortcodeFeedPage> {
	const fbDtsg = findFbDtsg();
	if (!fbDtsg) {
		throw new Error('Could not find fb_dtsg in page');
	}

	const body = new URLSearchParams({
		doc_id: FEED_DOC_ID,
		fb_dtsg: fbDtsg,
		variables: JSON.stringify({
			...(next ? { after: next } : {}),
			data: { count: 12 },
			first: 12,
			username,
			__relay_internal__pv__PolarisMultiCaptionCarouselEnabledrelayprovider: true,
			__relay_internal__pv__PolarisShortDramaEnabledrelayprovider: true,
			__relay_internal__pv__PolarisSEOIsCrawlerrelayprovider: false,
			__relay_internal__pv__PolarisThreadsStyleCommentsEnabledrelayprovider: false,
			__relay_internal__pv__PolarisReelsRecoDebugOverlayEnabledrelayprovider: false,
		}),
		server_timestamps: 'true',
	});

	const data = await fetchApi<UserFeedResponse>('/graphql/query', body, { 'x-fb-friendly-name': FEED_QUERY_NAME });
	const feed = data.data?.xdt_api__v1__feed__user_timeline_graphql_connection;
	if (!feed) {
		throw new Error(`Feed query: ${data.errors?.[ 0 ]?.message ?? `no posts found for ${username}`}`);
	}

	return {
		shortcodes: feed.edges.map(edge => edge.node.code),
		next: feed.page_info.has_next_page ? feed.page_info.end_cursor ?? undefined : undefined,
	};
}

// DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

async function downloadAllPosts() {
	const username = window.location.href.match(/instagram\.com\/([^/?]+)/)?.[ 1 ];
	if (!username) {
		return logError('No username found in url');
	}

	async function _downloadPosts($username: string, response: ShortcodeFeedPage): Promise<unknown> {
		const nextUserFeedResponse: Promise<ShortcodeFeedPage> | null = typeof response.next === 'string' ? getUserFeed($username, response.next) : null;

		await pMap(response.shortcodes, async shortcode => {
			const item = await getMediaInfo(shortcode);
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

	const userFeed = await getUserFeed(username);

	return _downloadPosts(username, userFeed);
}

// BUTTONS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export function makeDownloadButton() {
	const downloadButton = Buttons.makeDownloadButton('profile', { className: 'user-feed', text: 'Feed' });
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
