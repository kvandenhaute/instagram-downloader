import pMap from 'p-map';

import type { ShortcodeFeedPage } from '../lib/types';

import { logError } from '../lib/logger';
import { fetchApi, findFbDtsg } from './api';
import * as Buttons from './helpers/buttons';
import { downloadManyFromCarousel, downloadOne, getMediaInfo, hasCarousel } from './media';
import { getWebProfileInfo } from './profile';

// FETCH \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

const CLIPS_QUERY_NAME = 'PolarisProfileReelsTabContentQuery_connection';
const CLIPS_DOC_ID = '29020894810865438';

type UserClipsResponse = {
	data: {
		fetch__XDTUserDict: {
			clips_connection: {
				edges: Array<{ node: { media: { code: string } } }>
				page_info: {
					end_cursor: string | null
					has_next_page: boolean
				}
			}
		} | null
	} | null
	errors?: Array<{ message: string }>
};

// The web app's own query for the Reels tab of a profile. /api/v1/clips/user/
// returns HTML instead of JSON. Instagram rotates the doc_id now and then.
async function getUserClips(userId: number, next?: string): Promise<ShortcodeFeedPage> {
	const fbDtsg = findFbDtsg();
	if (!fbDtsg) {
		throw new Error('Could not find fb_dtsg in page');
	}

	const id = String(userId);
	const body = new URLSearchParams({
		doc_id: CLIPS_DOC_ID,
		fb_dtsg: fbDtsg,
		variables: JSON.stringify({
			...(next ? { after: next } : {}),
			data: { include_feed_video: true, page_size: 12, target_user_id: id },
			first: 12,
			id,
			__relay_internal__pv__PolarisShortDramaEnabledrelayprovider: true,
		}),
		server_timestamps: 'true',
	});

	const data = await fetchApi<UserClipsResponse>('/graphql/query', body, { 'x-fb-friendly-name': CLIPS_QUERY_NAME });
	const clips = data.data?.fetch__XDTUserDict?.clips_connection;
	if (!clips) {
		throw new Error(`Clips query: ${data.errors?.[ 0 ]?.message ?? `no clips found for ${id}`}`);
	}

	return {
		shortcodes: clips.edges.map(edge => edge.node.media.code),
		next: clips.page_info.has_next_page ? clips.page_info.end_cursor ?? undefined : undefined,
	};
}

// DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

async function downloadAllClips() {
	const username = window.location.href.match(/instagram\.com\/([^/?]+)/)?.[ 1 ];
	if (!username) {
		return logError('No username found in url');
	}

	const webProfileInfo = await getWebProfileInfo(username);

	async function _downloadClips($username: string, response: ShortcodeFeedPage): Promise<unknown> {
		const nextUserClipsResponse: Promise<ShortcodeFeedPage> | null = typeof response.next === 'string' ? getUserClips(webProfileInfo.userId, response.next) : null;

		await pMap(response.shortcodes, async shortcode => {
			const item = await getMediaInfo(shortcode);
			if (hasCarousel(item)) {
				return downloadManyFromCarousel(item);
			}

			return downloadOne(item);
		}, { concurrency: 3 });

		if (!nextUserClipsResponse) {
			return;
		}

		return nextUserClipsResponse.then($response => _downloadClips($username, $response));
	}

	const userClips = await getUserClips(webProfileInfo.userId);

	return _downloadClips(username, userClips);
}

// BUTTONS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export function makeDownloadButton() {
	const downloadButton = Buttons.makeDownloadButton('profile', { className: 'user-clips', text: 'Clips' });
	downloadButton.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();

		downloadButton.disabled = true;

		void downloadAllClips()
			.catch(logError)
			.finally(() => (downloadButton.disabled = false));
	});

	return downloadButton;
}
