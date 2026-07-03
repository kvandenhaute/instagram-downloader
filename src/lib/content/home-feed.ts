import type { MediaElement, PageType, Url } from '../types';

import { isValidMedia } from '../helpers';
import { makeDownloadButton } from '../helpers/buttons';
import { logError } from '../logger';
import * as Media from './media';
import * as Posts from './posts';

// DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

async function downloadPost(media: MediaElement, root: HTMLElement) {
	const anchor = root.querySelector<HTMLAnchorElement>('a:has(time)');
	if (!anchor) {
		console.warn('[ig-dl]', 'Could not find anchor');

		return;
	}

	const listElement = media.closest('li');
	if (!listElement) {
		return Media.downloadOne(anchor.href as Url);
	}

	return downloadFromCarousel(root, media, anchor.href as Url);
}

async function downloadFromCarousel(root: HTMLElement, media: MediaElement, url: Url) {
	if (!isValidMedia(media)) {
		return;
	}

	const step = root.querySelector('button[aria-current="step"]');
	if (!step) {
		return logError('Could not find carousel step');
	}

	return Media.downloadOneFromCarousel(
		Array.from(step.parentElement!.children).indexOf(step),
		url,
	);
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

		downloadButton.disabled = true;

		void downloadPost(media, root)
			.finally(() => (downloadButton.disabled = false));
	});

	return Posts.getDownloadButtonParent(root, media)
		.appendChild(downloadButton);
}
