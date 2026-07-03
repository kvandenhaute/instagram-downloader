import pMap from 'p-map';

import type { FilenameOptions } from './download';
import type { MediaCarouselItem, MediaItem } from './media';

import { logError } from '../lib/logger';
import { downloadFile } from './download';
import * as Buttons from './helpers/buttons';
import { getWebProfileInfo } from './profile';
import { getDatetime, sendMessage } from './utils';

// MESSAGES ////////////////////////////////////////////////////////////////////////////////////////////////////////////

type UserFeedResponse = {
	items: Array<MediaItem>
	next?: string
};

async function getUserTagsFeed(userId: number, next?: string) {
	const sendMessageResult = await sendMessage<UserFeedResponse>({ type: 'get_user_tags_feed', userId, next });
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

	async function _downloadPosts($username: string, response: UserFeedResponse): Promise<unknown> {
		const nextUserFeedResponse: Promise<UserFeedResponse> | null = typeof response.next === 'string' ? getUserTagsFeed(webProfileInfo.userId, response.next) : null;

		await pMap(response.items, async item => {
			if (item.carousel_media) {
				return downloadCarouselMedia($username, item.carousel_media);
			}

			return downloadMedia($username, item);
		}, { concurrency: 3 });

		if (!nextUserFeedResponse) {
			return;
		}

		return nextUserFeedResponse.then($response => _downloadPosts($username, $response));
	}

	const userFeed = await getUserTagsFeed(webProfileInfo.userId);

	return _downloadPosts(username, userFeed);
}

async function downloadCarouselMedia(username: string, items: Array<MediaCarouselItem>) {
	return pMap(items, (media, index) => {
		return downloadMedia(username, media, {
			suffix: [
				'carousel',
				index.toString().padStart(2, '0'),
			],
		});
	}, { concurrency: 2 });
}

async function downloadMedia(username: string, media: Pick<MediaItem, 'image' | 'taken_at' | 'video'>, filenameOptions: FilenameOptions = {}) {
	const datetime = getDatetime(media.taken_at);

	if (media.video) {
		if (media.image) {
			console.log(media.taken_at);

			await downloadFile(media.image, username, datetime, { ...filenameOptions, isPoster: true });
		}

		return downloadFile(media.video, username, datetime, filenameOptions);
	} else if (media.image) {
		return downloadFile(media.image, username, datetime, filenameOptions);
	}
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
