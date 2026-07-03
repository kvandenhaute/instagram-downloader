import type { MediaElement, PageType } from '../lib/types';

import { logDebug } from '../lib/logger';
import { isValidMedia } from './helpers';
import { makeDownloadButton } from './helpers/buttons';
import * as Media from './media';
import { findFirstRelativeAncestor, findFirstRelativeDescendant, queryFirst } from './utils/dom';

// DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export function download(media: MediaElement) {
	// if (!isValidMedia(media)) {
	// 	return Promise.resolve();
	// }

	const listElement = media.closest('li');
	if (!listElement) {
		return Media.downloadOneByShortcode();
	}

	return downloadCarouselMedia();
}

async function downloadCarouselMedia() {
	const searchParams = new URL(window.location.href).searchParams;
	const index = searchParams.get('img_index');

	return Media.downloadOneFromCarouselByShortcode(
		index ? parseInt(index, 10) - 1 : 0,
	);
}

// BUTTONS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export function addPostDownloadButton(media: MediaElement, pageType: PageType) {
	const root = queryFirst<HTMLElement>(document, '[role="dialog"] article > div > div:first-child', 'main > div > div:first-child > div > div');
	if (!root || !root.contains(media)) {
		return logDebug('Skip, no root found for media');
	} else if (media instanceof HTMLImageElement) {
		const li = media.closest('li');

		if (!li && root.querySelector('video')) {
			return logDebug('Skip as this is a poster, there is a download button for the video itself');
		} else if (li && li.querySelector('video')) {
			return logDebug('Skip as this is a poster, there is a download button for the video itself');
		}
	}

	const downloadButton = makeDownloadButton(pageType);
	downloadButton.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();

		downloadButton.disabled = true;

		void download(media)
			.finally(() => (downloadButton.disabled = false));
	});

	return getDownloadButtonParent(root, media)
		.appendChild(downloadButton);
}

// HELPERS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export function getDownloadButtonParent(root: HTMLElement, media: MediaElement) {
	let buttonParent: HTMLElement | null;
	const listItem = media.closest('li');
	if (listItem) {
		if (media instanceof HTMLVideoElement) {
			buttonParent = findFirstRelativeDescendant(listItem);
		} else {
			buttonParent = findFirstRelativeAncestor(media, listItem);
		}
	} else if (media instanceof HTMLVideoElement) {
		buttonParent = root.querySelector('div:has(> a[href^="/reels/"])');
	} else {
		buttonParent = findFirstRelativeAncestor(media, root);
	}

	if (!buttonParent) {
		buttonParent = root;
	}

	buttonParent.style.position = 'relative';

	return buttonParent;
}
