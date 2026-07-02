import { Result } from './types';

const DEBUG = true;

const BTN_CLASS_NAME = 'ig-dl-btn';
const PROCESSED_ATTR = 'data-ig-dl-processed';

type PageType = 'home-feed' | 'post' | 'reels' | 'reel' | 'stories';

function getPageType(): PageType | null {
	const pathname = window.location.pathname;

	if (pathname === '/') {
		return 'home-feed';
	} else if (pathname.includes('/p/')) {
		return 'post';
	} else if (pathname.includes('/reels/')) {
		return 'reels';
	} else if (pathname.includes('/reel/')) {
		return 'reel';
	} else if (pathname.includes('/stories/')) {
		return 'stories';
	}

	return null;
}

function scanPage() {
	const pageType = getPageType();
	if (!pageType) {
		return;
	}

	if (pageType === 'stories') {
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

// DOWNLOAD ////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
		await download(urls.image, mediaInfo.username, getDatetime(mediaInfo.taken_at), true);
	}

	return download(urls.video, mediaInfo.username, getDatetime(mediaInfo.taken_at));
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

async function download(url: string, username: string, datetime: string, isPoster?: boolean) {
	return sendMessage({
		type: 'download',
		url,
		filename: makeFilename(url, username, datetime, isPoster),
	});
}

function makeFilename(url: string, username: string, datetime: string, isPoster?: boolean) {
	const basename = `instagram_${username}__${formatDatetimeToFilenamePart(datetime)}`;
	const ext = getFileExtension(url);

	if (isPoster) {
		return `${basename}_poster.${ext}`;
	}

	return `${basename}.${ext}`;
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
		case 'home-feed':
			addHomeFeedDownloadButton(media, pageType);
			break;
		case 'post':
			addPostDownloadButton(media, pageType);
			break;
		case 'reel':
			addReelDownloadButton(media, pageType);
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
		return logDebug('No root found for media in post');
	}

	const downloadButton = makeDownloadButton(pageType);
	downloadButton.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();

		void downloadFromPost(media);
	});

	return getDownloadButtonParent(root, media)
		.appendChild(downloadButton);
}

function addReelDownloadButton(media: MediaElement, pageType: PageType) {
	return addPostDownloadButton(media, pageType);
}

function addStoryDownloadButton(pageType: PageType) {
	const section = document.querySelector('section:has([aria-label="Instagram"])');
	if (!section || section.querySelector(`:scope > .${BTN_CLASS_NAME}`)) {
		return;
	}

	const downloadButton = makeDownloadButton(pageType);
	downloadButton.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();

		void downloadStory();
	});

	section.appendChild(downloadButton);
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

function makeDownloadButton(pageType: PageType) {
	const button = document.createElement('button');
	button.classList.add(BTN_CLASS_NAME, `${BTN_CLASS_NAME}--${pageType}`);
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

function formatDatetimeToFilenamePart(datetime: string): string {
	return datetime
		.replace('T', '_')
		.replace(/([:-])/g, '')
		.replace(/\.\d+Z?$/, '');
}

function getDatetime(takenAt: number) {
	return new Date(takenAt).toISOString();
}

function getFileExtension(url: string) {
	return new URL(url).pathname.split('.').pop() || 'jpg';
}

// MESSAGES ////////////////////////////////////////////////////////////////////////////////////////////////////////////

function sendMessage<T>(message: Record<string, unknown>): Promise<Result<T>> {
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
		return mediaInfo;
	}

	const postId = mapShortcodeToPostId(shortcode);
	const getMediaInfoResult = await sendMessage<MediaInfoResponse>({ type: 'get_media_info', postId });
	if (!getMediaInfoResult.success) {
		throw getMediaInfoResult.error;
	}

	mediaInfoMap.set(shortcode, getMediaInfoResult.data);

	return getMediaInfoResult.data;
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

	const getWebProfileInfoResult = await sendMessage<WebProfileInfoResponse>({ type: 'get_web_profile_info', username });
	if (!getWebProfileInfoResult.success) {
		throw getWebProfileInfoResult.error;
	}
	webProfileInfoMap.set(username, getWebProfileInfoResult.data);

	return getWebProfileInfoResult.data;
}

type UserReelsResponse = {
	reels_by_pk: Record<string, { taken_at: number, url: string }>
	reels: Array<{ taken_at: number, url: string }>
};

async function getUserReels(userId: number) {
	const getUserReelsResult = await sendMessage<UserReelsResponse>({ type: 'get_user_reels', userId });
	if (!getUserReelsResult.success) {
		throw getUserReelsResult.error;
	}

	return getUserReelsResult.data;
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

function queryFirst<T extends Element>(root: ParentNode, ...selectors: [string, ...Array<string>]): T | null {
	for (const selector of selectors) {
		const el = root.querySelector<T>(selector);
		if (el) {
			return el;
		}
	}

	return null;
}

// HELPERS /////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}

// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

type MediaElement = HTMLImageElement | HTMLVideoElement;
