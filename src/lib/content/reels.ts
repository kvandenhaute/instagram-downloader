import type { MediaElement, PageType, Url } from '../types';
import type { FilenameOptions } from './download';

import { makeDownloadButton } from '../helpers/buttons';
import { getDatetime, sendMessage } from '../utils';
import { downloadFile } from './download';
import * as Posts from './posts';

export type Reel = { poster?: Url, taken_at: number, url: Url };

// MESSAGE \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

type UserReelsResponse = {
	reels_by_pk: Record<string, Reel>
	reels: Array<Reel>
	username: string
};

export async function getUserReels(userId: number) {
	const sendMessageResult = await sendMessage<UserReelsResponse>({ type: 'get_user_reels', userId });
	if (!sendMessageResult.success) {
		throw sendMessageResult.error;
	}

	return sendMessageResult.data;
}

// DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export async function downloadReel(reel: Reel, username: string, filenameOptions: FilenameOptions = {}) {
	const datetime = getDatetime(reel.taken_at);

	if (reel.poster) {
		await downloadFile(reel.poster, username, datetime, { ...filenameOptions, isPoster: true });
	}

	return downloadFile(reel.url, username, datetime, filenameOptions);
}

// BUTTONS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export function addReelDownloadButton(media: MediaElement, pageType: PageType) {
	return Posts.addPostDownloadButton(media, pageType);
}

export function addReelsDownloadButton(media: MediaElement, pageType: PageType) {
	if (media instanceof HTMLImageElement) {
		return;
	}

	const root = media.closest('div:has(img)');
	if (!root) {
		return;
	}

	const downloadButton = makeDownloadButton(pageType);
	downloadButton.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();

		void Posts.download(media);
	});

	root.appendChild(downloadButton);
}
