import type { MediaElement, PageType } from './types';

import { makeDownloadButton } from './buttons';
import { findFirstRelativeAncestor, findFirstRelativeDescendant, queryFirst } from './dom';
import { isValidMedia } from './helpers';
import { logDebug } from './logger';
import { downloadByShortcode } from './media';

// DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export function downloadFromPost(media: MediaElement) {
	if (!isValidMedia(media)) {
		return;
	}

	const listElement = media.closest('li');
	if (!listElement) {
		return downloadByShortcode(media);
	}

	return downloadFromPostCarousel(media);
}

async function downloadFromPostCarousel(media: MediaElement, url?: string) {
	const searchParams = new URL(window.location.href).searchParams;
	const index = searchParams.get('img_index');

	return downloadByShortcode(media, url, index ? parseInt(index, 10) - 1 : 0);
}

// BUTTONS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export function addPostDownloadButton(media: MediaElement, pageType: PageType) {
	const root = queryFirst<HTMLElement>(document, '[role="dialog"] article > div > div:first-child', 'main > div > div:first-child > div > div');
	if (!root || !root.contains(media)) {
		return logDebug('Skip, no root found for media');
	} else if (media instanceof HTMLImageElement && root.querySelector('video')) {
		return logDebug('Skip as this is a poster, there is a download button for the video itself');
	}

	const downloadButton = makeDownloadButton(pageType);
	downloadButton.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();

		void downloadFromPost(media);
	});
	downloadButton.dataset[ 'media' ] = media.src;

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
