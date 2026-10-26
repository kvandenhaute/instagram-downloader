import type { MediaElement, PageType, ReelItem } from '../lib/types';
import type { FilenameOptions } from './download';

import { downloadFile } from './download';
import { makeDownloadButton } from './helpers/buttons';
import * as Posts from './posts';
import { getDatetime } from './utils';

// DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export async function downloadReel(reel: ReelItem, username: string, filenameOptions: FilenameOptions = {}) {
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
