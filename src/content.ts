import pMap from 'p-map';

import { Result } from './types';

const DEBUG = true;

const BTN_CLASS_NAME = 'ig-dl-btn';
const PROCESSED_ATTR = 'data-ig-dl-processed';

type PageType = 'highlights' | 'home-feed' | 'post' | 'profile' | 'reels' | 'reel' | 'stories';

function scanPage() {
	const pageType = getPageType();
	if (!pageType) {
		return;
	}

	if (pageType === 'profile') {
		return addHighlightsDownloadButton();
	} else if (pageType === 'stories') {
		return addStoryDownloadButton(pageType);
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

// HIGHLIGHTS //////////////////////////////////////////////////////////////////////////////////////////////////////////

function addHighlightsDownloadButton() {
	const root = document.querySelector<HTMLElement>('section main div:has(> header)');
	if (!root || root.querySelector(`:scope > .${BTN_CLASS_NAME}`)) {
		return;
	}

	const downloadButton = makeDownloadButton('profile', 'highlights');
	downloadButton.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();

		downloadButton.disabled = true;

		void downloadAllHighlights()
			.finally(() => (downloadButton.disabled = false));
	});

	root.style.setProperty('position', 'relative');
	root.appendChild(downloadButton);
}

function addHighlightDownloadButton() {
	const root = document.querySelector<HTMLElement>('section > div > div > div');
	if (!root || root.querySelector(`:scope > .${BTN_CLASS_NAME}`)) {
		return;
	}

	const downloadButton = makeDownloadButton('highlights');
	downloadButton.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();

		void downloadHighlightStory(root);
	});

	root.appendChild(downloadButton);
}

async function collectAllHighlights() {
	let el: HTMLElement | null
		= document.querySelector('a[href*="/stories/highlights/"]');
	let container: HTMLElement | null = null;

	while (el) {
		if (getComputedStyle(el).overflowX === 'auto') {
			container = el;
			break;
		}
		el = el.parentElement;
	}

	if (!container) {
		return [];
	}

	const collected = new Map<string, { id: string, title: string | undefined }>();
	let retries = 0;

	while (retries < 5) {
		const countBefore = collected.size;

		document.querySelectorAll<HTMLAnchorElement>('a[href*="/stories/highlights/"]')
			.forEach(a => {
				const match
					= a.href.match(/\/stories\/highlights\/(\d+)\//);
				if (match?.[ 1 ]) {
					collected.set(match[ 1 ], {
						id: match[ 1 ],
						title:
							a.querySelector('span')?.textContent?.trim(),
					});
				}
			});

		if (collected.size > countBefore) {
			retries = 0;
		} else {
			retries++;
		}

		container.scrollLeft += 200;
		await new Promise(resolve => setTimeout(resolve, 600));
	}

	return Array.from(collected.values());
}

async function downloadAllHighlights() {
	const highlights = await collectAllHighlights();

	return pMap(highlights, async highlight => {
		const reels = await getHighlightReels(highlight.id);
		const title = highlight.title || highlight.id;

		return pMap(reels.reels, async (reel, index) => {
			return download(reel.url, reels.username, getDatetime(reel.taken_at), {
				suffix: [ encodeURIComponent(title), index.toString().padStart(3, '0') ],
			});
		}, { concurrency: 3 });
	}, { concurrency: 3 });
}

async function downloadHighlightStory(root: HTMLElement) {
	const match = window.location.href.match(/\/highlights\/(\d+)/);
	const highlightId = match?.at(1);
	if (!highlightId) {
		return;
	}

	const index = findActiveHighlightIndex(root);
	if (index === null) {
		return;
	}

	const highlightReels = await getHighlightReels(highlightId);
	const reel = highlightReels.reels.at(index);
	if (!reel) {
		return logError(`Could not find highlight reel at index ${index}`);
	}

	return download(reel.url, highlightReels.username, getDatetime(reel.taken_at));
}

function findActiveHighlightIndex(root: HTMLElement): number | null {
	const isProgressBar = (el: Element) => {
		const height = el.clientHeight || (el as HTMLElement).offsetHeight;
		const width = el.clientWidth || (el as HTMLElement).offsetWidth;

		return height > 0 && height < 5 && width > 150 && el.children.length > 0;
	};

	const container = Array.from(root.querySelectorAll('div')).find(isProgressBar);
	if (!container) {
		return null;
	}

	const segments = Array.from(container.children);
	let activeIndex = 0;
	let maxChildren = 0;

	for (let i = 0; i < segments.length; i++) {
		if (segments[ i ].children.length > maxChildren) {
			maxChildren = segments[ i ].children.length;
			activeIndex = i;
		}
	}

	return activeIndex;
}

// DOWNLOAD ////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function downloadByShortcode(media: MediaElement, url?: string, index?: number) {
	const shortcode = findShortcodeInUrl(url);
	if (!shortcode) {
		return logError('Could not find shortcode in url');
	}

	const mediaInfo = await getMediaInfo(shortcode);
	let urls: Pick<MediaInfoResponse, 'image' | 'video'> | undefined;

	if (typeof index !== 'undefined') {
		urls = mediaInfo.carousel_media?.at(index);
	} else {
		urls = mediaInfo;
	}

	if (!urls) {
		return logError('Could not find media item url');
	}

	if (media instanceof HTMLImageElement) {
		if (!urls.image) {
			return logError('Expected to have an image URL within the mediaInfo response');
		}

		return download(urls.image, mediaInfo.username, getDatetime(mediaInfo.taken_at));
	} else if (!urls.video) {
		return logError('Expected to have a video URL within the mediaInfo response');
	}

	if (urls.image) {
		await download(urls.image, mediaInfo.username, getDatetime(mediaInfo.taken_at), { isPoster: true });
	}

	return download(urls.video, mediaInfo.username, getDatetime(mediaInfo.taken_at));
}

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

function downloadFromPost(media: MediaElement) {
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

async function downloadStory() {
	const username = findUsernameInUrl();
	if (!username) {
		return logError('No username found in url');
	}

	const match = window.location.href.match(/\/stories\/[^/]+\/(\d+)/);
	const storyId = match?.at(1);

	const webProfileInfo = await getWebProfileInfo(username);
	const reels = await getUserReels(webProfileInfo.userId);

	if (!storyId) {
		const firstReel = reels.reels.at(0);
		if (!firstReel) {
			return logError('No reels found');
		}

		return download(firstReel.url, username, getDatetime(firstReel.taken_at));
	}

	const reel = reels.reels_by_pk[ storyId.toString() ];
	if (!reel) {
		logDebug(reels);
		logError(`No reel found for story ${storyId}`);

		return;
	}

	return download(reel.url, username, getDatetime(reel.taken_at));
}

async function download(url: string, username: string, datetime: string, filenameOptions?: FilenameOptions) {
	return sendMessage({
		type: 'download',
		url,
		filename: makeFilename(url, username, datetime, filenameOptions),
	});
}

type FilenameOptions = {
	isPoster?: boolean
	suffix?: string | Array<string>
};

function makeFilename(url: string, username: string, datetime: string, options: FilenameOptions = {}) {
	const basenameParts: Array<string | number> = [ 'instagram', username, formatDatetimeToBasenamePart(datetime) ];
	const ext = getFileExtension(url);

	options.isPoster && basenameParts.push('poster');

	if (options.suffix) {
		if (Array.isArray(options.suffix)) {
			basenameParts.push(...options.suffix);
		} else {
			basenameParts.push(options.suffix);
		}
	}

	return `${basenameParts.join('__')}.${ext}`;
}

function formatDatetimeToBasenamePart(datetime: string): string {
	return datetime
		.replace('T', '_')
		.replace(/([:-])/g, '')
		.replace(/\.\d+Z?$/, '');
}

// URL /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function findUsernameInUrl() {
	const match = window.location.href.match(/\/stories\/([^/]+)\//);
	if (match && match[ 1 ]) {
		return match[ 1 ];
	}
}

// DOWNLOAD BUTTON /////////////////////////////////////////////////////////////////////////////////////////////////////

function addDownloadButton(media: MediaElement, pageType: PageType) {
	switch (pageType) {
		case 'highlights':
			addHighlightDownloadButton();
			break;
		case 'home-feed':
			addHomeFeedDownloadButton(media, pageType);
			break;
		case 'post':
			addPostDownloadButton(media, pageType);
			break;
		case 'reel':
			addReelDownloadButton(media, pageType);
			break;
		case 'reels':
			addReelsDownloadButton(media, pageType);
			break;
	}
}

function addHomeFeedDownloadButton(media: MediaElement, pageType: PageType) {
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

function addPostDownloadButton(media: MediaElement, pageType: PageType) {
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

function addReelDownloadButton(media: MediaElement, pageType: PageType) {
	return addPostDownloadButton(media, pageType);
}

function addReelsDownloadButton(media: MediaElement, pageType: PageType) {
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

		void downloadFromPost(media);
	});

	root.appendChild(downloadButton);
}

function addStoryDownloadButton(pageType: 'stories') {
	const root = document.querySelector('root:has([aria-label="Instagram"])');
	if (!root || root.querySelector(`:scope > .${BTN_CLASS_NAME}`)) {
		return;
	}

	const downloadButton = makeDownloadButton(pageType);
	downloadButton.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();

		void downloadStory();
	});

	root.appendChild(downloadButton);
}

function getDownloadButtonParent(root: HTMLElement, media: MediaElement) {
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

function makeDownloadButton(...pageTypes: [PageType, ...PageType[]]) {
	const button = document.createElement('button');
	button.classList.add(BTN_CLASS_NAME, ...pageTypes.map(pageType => `${BTN_CLASS_NAME}--${pageType}`));
	button.appendChild(makeDownloadIcon());

	return button;
}

function makeDownloadIcon(): SVGSVGElement {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('width', '24');
	svg.setAttribute('height', '24');
	svg.innerHTML = '<path d="M19.5 17V19.5H5.5V17M17.5 11L12.5 16L7.5 11M12.5 16V4.99998" stroke="#fff" stroke-width="1.2"/>';

	return svg;
}

// SHORTCODE ///////////////////////////////////////////////////////////////////////////////////////////////////////////

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function findShortcodeInUrl(url: string = window.location.href) {
	const urlMatch = url.match(/\/(p|reel|reels)\/([A-Za-z0-9_-]+)/);

	return urlMatch?.at(2) ?? null;
}

function mapShortcodeToPostId(shortcode: string) {
	const code = shortcode.length > 28 ? shortcode.slice(0, shortcode.length - 28) : shortcode;
	let id = BigInt(0);

	for (const ch of code) {
		id = id * BigInt(64) + BigInt(CHARS.indexOf(ch));
	}

	return id.toString();
}

// UTILS ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getDatetime(takenAt: number) {
	return new Date(takenAt).toISOString();
}

function getFileExtension(url: string) {
	return new URL(url).pathname.split('.').pop() || 'jpg';
}

// MESSAGES ////////////////////////////////////////////////////////////////////////////////////////////////////////////

function sendMessage<T>(message: Record<string, unknown>): Promise<Result<T>> {
	logDebug('sendMessage', message);

	return chrome.runtime.sendMessage(message);
}

type MediaInfoResponse = {
	carousel_media?: Array<{ image?: string, video?: string }>
	image?: string
	taken_at: number
	username: string
	video?: string
};

const mediaInfoMap: Map<string, MediaInfoResponse> = new Map();

async function getMediaInfo(shortcode: string) {
	const mediaInfo = mediaInfoMap.get(shortcode);
	if (mediaInfo) {
		logDebug('MediaInfo', mediaInfo);

		return mediaInfo;
	}

	const postId = mapShortcodeToPostId(shortcode);
	const sendMessageResult = await sendMessage<MediaInfoResponse>({ type: 'get_media_info', postId });
	if (!sendMessageResult.success) {
		throw sendMessageResult.error;
	}

	logDebug('MediaInfo', sendMessageResult.data);

	mediaInfoMap.set(shortcode, sendMessageResult.data);

	return sendMessageResult.data;
}

type WebProfileInfoResponse = {
	userId: number
};

const webProfileInfoMap: Map<string, WebProfileInfoResponse> = new Map();

async function getWebProfileInfo(username: string) {
	const webProfileInfo = webProfileInfoMap.get(username);
	if (webProfileInfo) {
		return webProfileInfo;
	}

	const sendMessageResult = await sendMessage<WebProfileInfoResponse>({ type: 'get_web_profile_info', username });
	if (!sendMessageResult.success) {
		throw sendMessageResult.error;
	}
	webProfileInfoMap.set(username, sendMessageResult.data);

	return sendMessageResult.data;
}

type HighlightReels = {
	reels_by_pk: Record<string, { taken_at: number, url: string }>
	reels: Array<{ taken_at: number, url: string }>
	username: string
};

async function getHighlightReels(highlightId: string) {
	const sendMessageResult = await sendMessage<HighlightReels>({ type: 'get_user_highlight', highlightId });
	if (!sendMessageResult.success) {
		throw sendMessageResult.error;
	}

	return sendMessageResult.data;
}

type UserReelsResponse = {
	reels_by_pk: Record<string, { taken_at: number, url: string }>
	reels: Array<{ taken_at: number, url: string }>
	username: string
};

async function getUserReels(userId: number) {
	const sendMessageResult = await sendMessage<UserReelsResponse>({ type: 'get_user_reels', userId });
	if (!sendMessageResult.success) {
		throw sendMessageResult.error;
	}

	return sendMessageResult.data;
}

// DOM TRAVERSING //////////////////////////////////////////////////////////////////////////////////////////////////////

function findFirstRelativeAncestor(from: HTMLElement, root: HTMLElement) {
	let current = from.parentElement;
	while (current) {
		if (getComputedStyle(current).position === 'relative') {
			return current;
		} else if (current === root) {
			return current;
		}

		current = current.parentElement;
	}

	return null;
}

function findFirstRelativeDescendant(root: HTMLElement) {
	for (const el of root.querySelectorAll<HTMLElement>('*')) {
		if (getComputedStyle(el).position === 'relative') {
			return el;
		}
	}

	return null;
}

function queryFirst<T extends Element>(root: ParentNode, ...selectors: [string, ...string[]]): T | null {
	for (const selector of selectors) {
		const el = root.querySelector<T>(selector);
		if (el) {
			return el;
		}
	}

	return null;
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

function isValidMedia(media: MediaElement) {
	if (media instanceof HTMLImageElement && media.alt.endsWith('profile picture')) {
		return false;
	}

	if (media.offsetWidth < 300 || media.offsetHeight < 300) {
		return false;
	}

	const anchorAncestor = media.closest('a');
	if (anchorAncestor) {
		const pathname = new URL(anchorAncestor.href).pathname;

		return !(/^\/[^/]+\/?$/).test(pathname);
	}

	return true;
}

function logDebug(...data: Array<unknown>) {
	DEBUG && console.debug('[ig-dl]', ...data);
}

function logError(...data: Array<unknown>) {
	console.error('[ig-dl]', ...data);
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

	// setTimeout(() => {
	// 	void collectAllHighlights().then(console.log);
	// }, 3000);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}

// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

type MediaElement = HTMLImageElement | HTMLVideoElement;
