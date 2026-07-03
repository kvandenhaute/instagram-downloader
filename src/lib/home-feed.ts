import type { MediaElement, PageType } from './types';

import { makeDownloadButton } from './buttons';
import { isValidMedia } from './helpers';
import { logError } from './logger';
import { downloadByShortcode } from './media';
import { getDownloadButtonParent } from './posts';

// DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

function downloadFromHomeFeed(media: MediaElement, root: HTMLElement) {
	const anchor = root.querySelector<HTMLAnchorElement>('a:has(time)');
	if (!anchor) {
		console.warn('[ig-dl]', 'Could not find anchor');

		return;
	}

	const listElement = media.closest('li');
	if (!listElement) {
		return downloadByShortcode(media, anchor.href);
	}

	return downloadFromHomeFeedCarousel(root, media, anchor.href);
}

async function downloadFromHomeFeedCarousel(root: HTMLElement, media: MediaElement, url?: string) {
	if (!isValidMedia(media)) {
		return;
	}

	const step = root.querySelector('button[aria-current="step"]');
	if (!step) {
		return logError('Could not find carousel step');
	}

	const index = Array.from(step.parentElement!.children).indexOf(step);

	return downloadByShortcode(media, url, index);
}

// BUTTONS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export function addDownloadFromHomeFeedButton(media: MediaElement, pageType: PageType) {
	const root = media.closest('article');
	if (!root) {
		return;
	}

	const downloadButton = makeDownloadButton(pageType);
	downloadButton.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();

		void downloadFromHomeFeed(media, root);
	});

	return getDownloadButtonParent(root, media)
		.appendChild(downloadButton);
}
