import pMap from 'p-map';

import type { GetUserClipsMessage, GetUserClipsMessageResponse } from '../messages';

import { logError } from '../lib/logger';
import * as Buttons from './helpers/buttons';
import { downloadManyFromCarousel, downloadOne, hasCarousel } from './media';
import { getWebProfileInfo } from './profile';
import { sendMessage } from './utils';

// MESSAGES ////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function getUserClips(userId: number, next?: string) {
	const sendMessageResult = await sendMessage<GetUserClipsMessageResponse>({
		type: 'get_user_clips',
		userId,
		next,
	} satisfies GetUserClipsMessage);
	if (!sendMessageResult.success) {
		throw sendMessageResult.error;
	}

	return sendMessageResult.data;
}

// DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

async function downloadAllClips() {
	const username = window.location.href.match(/instagram\.com\/([^/?]+)/)?.[ 1 ];
	if (!username) {
		return logError('No username found in url');
	}

	const webProfileInfo = await getWebProfileInfo(username);

	async function _downloadClips($username: string, response: GetUserClipsMessageResponse): Promise<unknown> {
		const nextUserClipsResponse: Promise<GetUserClipsMessageResponse> | null = typeof response.next === 'string' ? getUserClips(webProfileInfo.userId, response.next) : null;

		await pMap(response.items, async item => {
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
			.finally(() => (downloadButton.disabled = false));
	});

	return downloadButton;
}
