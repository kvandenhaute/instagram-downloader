import type { MediaElement, PageType } from './lib/types';

import { isValidMedia } from './lib/helpers';
import * as Highlights from './lib/highlights';
import * as HomeFeed from './lib/home-feed';
import * as Posts from './lib/posts';
import { createDownloadButtonStack } from './lib/profile';
import * as Reels from './lib/reels';
import * as Stories from './lib/stories';
import * as UserFeed from './lib/user-feed';

const PROCESSED_ATTR = 'data-ig-dl-processed';

function scanPage() {
	const pageType = getPageType();
	if (!pageType) {
		return;
	}

	if (pageType === 'profile') {
		const stack = createDownloadButtonStack();
		if (!stack) {
			return;
		}

		stack.appendChild(UserFeed.makeDownloadButton());
		stack.appendChild(Highlights.makeDownloadAllHighlightsButton());

		return;
	} else if (pageType === 'stories') {
		return Stories.addStoryDownloadButton(pageType);
	}

	const media = document.querySelectorAll<HTMLImageElement>('img,video');

	media.forEach(m => processMedia(m, pageType));
}

function processMedia(media: MediaElement, pageType: PageType) {
	if (media.hasAttribute(PROCESSED_ATTR)) {
		return;
	} else if (!isValidMedia(media)) {
		return;
	}

	addDownloadButton(media, pageType);
	media.setAttribute(PROCESSED_ATTR, '1');
}

// DOWNLOAD BUTTON /////////////////////////////////////////////////////////////////////////////////////////////////////

function addDownloadButton(media: MediaElement, pageType: PageType) {
	switch (pageType) {
		case 'highlights':
			Highlights.addDownloadSingleHighlightButton();
			break;
		case 'home-feed':
			HomeFeed.addDownloadFromHomeFeedButton(media, pageType);
			break;
		case 'post':
			Posts.addPostDownloadButton(media, pageType);
			break;
		case 'reel':
			Reels.addReelDownloadButton(media, pageType);
			break;
		case 'reels':
			Reels.addReelsDownloadButton(media, pageType);
			break;
	}
}

// HELPERS /////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getPageType(): PageType | null {
	const pathname = window.location.pathname;

	if (pathname === '/') {
		return 'home-feed';
	} else if (pathname.includes('/p/')) {
		return 'post';
	} else if (pathname.includes('/reel/')) {
		return 'reel';
	} else if (pathname.includes('/highlights/')) {
		return 'highlights';
	} else if (pathname.includes('/reels/')) {
		return 'reels';
	} else if (pathname.includes('/stories/')) {
		return 'stories';
	}

	return 'profile';
}

// INIT ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function init() {
	scanPage();

	const observer = new MutationObserver(() => {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(scanPage, 300);
	});

	observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}
