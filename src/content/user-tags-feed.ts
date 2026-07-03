import pMap from 'p-map';

import type { GetUserTagsFeedMessage, GetUserTagsFeedMessageResponse } from '../messages';

import { logError } from '../lib/logger';
import * as Buttons from './helpers/buttons';
import { downloadManyFromCarousel, downloadOne, hasCarousel } from './media';
import { getWebProfileInfo } from './profile';
import { sendMessage } from './utils';

// MESSAGES ////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function getUserTagsFeed(userId: number, next?: string) {
	const sendMessageResult = await sendMessage<GetUserTagsFeedMessageResponse>({
		type: 'get_user_tags_feed',
		userId,
		next,
	} satisfies GetUserTagsFeedMessage);
	if (!sendMessageResult.success) {
		throw sendMessageResult.error;
	}

	return sendMessageResult.data;
}

// DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

async function downloadAllPosts() {
	const username = window.location.href.match(/instagram\.com\/([^/?]+)/)?.[ 1 ];
	if (!username) {
		return logError('No username found in url');
	}

	const webProfileInfo = await getWebProfileInfo(username);

	async function _downloadPosts($username: string, response: GetUserTagsFeedMessageResponse): Promise<unknown> {
		const nextUserFeedResponse: Promise<GetUserTagsFeedMessageResponse> | null = typeof response.next === 'string' ? getUserTagsFeed(webProfileInfo.userId, response.next) : null;

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
			.finally(() => (downloadButton.disabled = false));
	});

	return downloadButton;
}
