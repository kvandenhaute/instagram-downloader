import { Result } from './types';

const BTN_CLASS_NAME = 'ig-dl-btn';
const PROCESSED_ATTR = 'data-ig-dl-processed';

type Config = {
	containers: Array<string>
	downloadButtonContainerSelector?: string
	selectors: Array<string>
	type?: 'home-feed' | 'reels' | 'reel' | 'stories'
	username?: string
	usernameSelector?: string
};

function getConfig() {
	const pathname = window.location.pathname;

	// console.debug(pathname, (/\/reel\/([\w-]+)\//).test(pathname));

	const config: Config = {
		containers: [],
		selectors: [],
		username: findUsernameInUrl(),
	};

	// console.debug(config.username);

	if (pathname === '/') {
		config.containers.push('article');
		config.downloadButtonContainerSelector = 'div:has(> a[href^="/reels/"])';
		config.selectors.push('article img[alt^="Photo"]');
		config.selectors.push('article video[src^="blob:https://www.instagram.com"]');
		config.type = 'home-feed';
	}

	// if (pathname === '/' || pathname.startsWith('/p/')) {
	// 	config.containers.push('article');
	// 	config.selectors.push('article img[alt^="Photo"]');
	// 	config.selectors.push('article video[src^="blob:https://www.instagram.com"]');
	// }

	if (pathname.startsWith('/p/')) {
		config.containers.push('main > div > div');
		config.selectors.push('main > div > div li img');
		config.selectors.push('main > div > div video[src^="blob:https://www.instagram.com"]');
	}

	if (pathname.startsWith('/reels/')) {
		config.containers.push('main > div > div:has(video)');
		config.selectors.push('main > div > div video');
		config.usernameSelector = 'a[href$="/reels/"]';
		config.type = 'reels';
	} else if ((/\/reel\/([\w-]+)\//).test(pathname)) {
		console.log('REEL');

		config.containers.push('article');
		config.selectors.push('article video');
		config.type = 'reel';
	}

	if (pathname.startsWith('/stories/')) {
		config.containers.push('section');
		config.selectors.push('section img', 'section video');
		config.type = 'stories';
	}

	return config;
}

function scanPage() {
	const config = getConfig();
	if (config.selectors.length === 0) {
		return;
	}

	const media = document.querySelectorAll<HTMLImageElement>(config.selectors.join(','));

	media.forEach(m => processMedia(m, config));
}

function processMedia(media: MediaElement, config: Config) {
	if (media.hasAttribute(PROCESSED_ATTR)) {
		return;
	}

	const container = media.closest<HTMLElement>(config.containers.join(','));
	if (!container) {
		console.warn('NO CONTAINER', media, config.containers);

		return;
	}

	addDownloadButton(media, config);

	// const relativeAncestor = findRelativeAncestor(container, media);
	// if (relativeAncestor) {
	// 	relativeAncestor.appendChild(makeDownloadButton(container, media, config));
	// } else {
	// 	container.style.setProperty('position', 'relative');
	// 	container.appendChild(makeDownloadButton(container, media, config));
	// }

	media.setAttribute(PROCESSED_ATTR, '1');
}

// DOWNLOAD ////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function downloadHandler(evt: PointerEvent, container: HTMLElement, media: MediaElement, config: Config) {
	evt.preventDefault();
	evt.stopPropagation();

	if (config.type === 'home-feed') {
		return downloadFromHomeFeed(media, container);
	} else if (config.type === 'reels' || config.type === 'reel') {
		return downloadReel();
	} else if (config.type === 'stories') {
		return downloadStory(config);
	}

	const shortcode = findShortcode(media);
	if (!shortcode) {
		void downloadRawMedia(media, config.username);

		return;
	}

	const mediaInfo = await getMediaInfo(shortcode);

	const step = container.querySelector('button[aria-current="step"]');
	if (step) {
		const index = Array.from(step.parentElement!.children).indexOf(step);
		const entry = mediaInfo.carousel_media?.at(index);
		if (!entry) {
			console.error('[ig-dl]', 'Could not find media entry');

			return;
		}

		if (media instanceof HTMLVideoElement && entry.video) {
			return download(entry.video, mediaInfo.username, getDatetime(media));
		} else if (entry.image) {
			return download(entry.image, mediaInfo.username, getDatetime(media));
		}

		console.error('[ig-dl]', 'Could not find media entry url');

		return;
	}

	if (media instanceof HTMLVideoElement && mediaInfo.video) {
		return download(mediaInfo.video, mediaInfo.username, getDatetime(media));
	} else if (mediaInfo.image) {
		return download(mediaInfo.image, mediaInfo.username, getDatetime(media));
	}

	console.error('[ig-dl]', 'Could not find media item url');
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

	return downloadFromCarousel(root, media, anchor.href);
}

async function downloadFromCarousel(root: HTMLElement, media: MediaElement, url: string) {
	const step = root.querySelector('button[aria-current="step"]');
	if (!step) {
		console.error('[ig-dl]', 'Could not find carousel step');

		return;
	}

	const index = Array.from(step.parentElement!.children).indexOf(step);

	return downloadByShortcode(media, url, index);
}

async function downloadByShortcode(media: MediaElement, url: string, index?: number) {
	const shortcode = findShortcodeInUrl(url);
	if (!shortcode) {
		console.error('[ig-dl]', 'Could not find shortcode in url');

		return;
	}

	const mediaInfo = await getMediaInfo(shortcode);
	let urls: Pick<MediaInfoResponse, 'image' | 'video'> | undefined;

	if (typeof index !== 'undefined') {
		urls = mediaInfo.carousel_media?.at(index);
	} else {
		urls = mediaInfo;
	}

	if (!urls) {
		console.error('[ig-dl]', 'Could not find media item url');

		return;
	}

	if (media instanceof HTMLImageElement) {
		if (!urls.image) {
			console.error('[ig-dl]', 'Expected to have an image URL within the mediaInfo response');

			return;
		}

		return download(urls.image, mediaInfo.username, getDatetime(mediaInfo.taken_at));
	} else if (!urls.video) {
		console.error('[ig-dl]', 'Expected to have a video URL within the mediaInfo response');

		return;
	}

	return download(urls.video, mediaInfo.username, getDatetime(mediaInfo.taken_at));
}

async function downloadReel() {
	const shortcode = findShortcodeInUrl();
	if (!shortcode) {
		console.error('[ig-dl]', 'Could not find shortcode in url');

		return;
	}

	const mediaInfo = await getMediaInfo(shortcode);
	if (!mediaInfo.video) {
		console.error('[ig-dl]', 'Expected to have a video URL within the mediaInfo response');

		return;
	}

	return download(mediaInfo.video, mediaInfo.username, getDatetime(mediaInfo.taken_at));
}

async function downloadStory(config: Config) {
	if (!config.username) {
		console.error('[ig-dl]', 'No username in config');

		return;
	}

	const match = window.location.href.match(/\/stories\/[^/]+\/(\d+)/);
	const storyId = match?.at(1);

	const webProfileInfo = await getWebProfileInfo(config.username);
	const reels = await getUserReels(webProfileInfo.userId);

	if (!storyId) {
		const firstReel = reels.reels.at(0);
		if (!firstReel) {
			console.error('[ig-dl]', 'No reels found');

			return;
		}

		return download(firstReel.url, config.username, getDatetime(firstReel.taken_at));
	}

	const reel = reels.reels_by_pk[ storyId.toString() ];
	if (!reel) {
		console.debug('[ig-dl]', reels);
		console.error('[ig-dl]', `No reel found for story ${storyId}`);

		return;
	}

	return download(reel.url, config.username, getDatetime(reel.taken_at));
}

async function download(url: string, username: string, datetime: string) {
	return sendMessage({
		type: 'download',
		url,
		filename: makeFilename(url, username, datetime),
	});
}

async function downloadRawMedia(media: MediaElement, username: string = 'unknown') {
	if (media instanceof HTMLVideoElement) {
		console.warn('Download of raw video not supported');

		return;
	}

	return downloadRawImage(media, username);
}

async function downloadRawImage(img: HTMLImageElement, username: string) {
	const url = getImageUrl(img);

	return sendMessage({
		type: 'download',
		url,
		filename: makeFilename(url, username, getDatetime(img)),
	});
}

function makeFilename(url: string, username: string, datetime: string) {
	const ext = getFileExtension(url);

	return `instagram_${username}__${formatDatetimeToFilenamePart(datetime)}.${ext}`;
}

// URL /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function findUsernameInUrl() {
	const match = window.location.href.match(/\/stories\/([^/]+)\//);
	if (match && match[ 1 ]) {
		return match[ 1 ];
	}
}

// DOM /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function addDownloadButton(media: MediaElement, config: Config) {
	if (config.type === 'home-feed') {
		return addHomeFeedDownloadButton(media, config);
	}
}

function addHomeFeedDownloadButton(media: MediaElement, config: Config) {
	const root = media.closest('article');
	if (!root) {
		return;
	}

	let buttonParent: HTMLElement | null = null;
	if (media instanceof HTMLVideoElement) {
		buttonParent = root.querySelector('div:has(> a[href^="/reels/"])');
		console.log('video', buttonParent);
	} else if (media.closest('li')) {
		buttonParent = findRelativeAncestor(media.closest('li') as HTMLLIElement, media);
		console.log('carousel', buttonParent);
	} else {
		buttonParent = findRelativeAncestor(root, media);
		console.log('default', buttonParent);
	}

	if (!buttonParent) {
		buttonParent = root;
		console.log('fallback', buttonParent);
	}

	buttonParent.style.position = 'relative';
	buttonParent.appendChild(makeDownloadButton(root, media, config));
}

function findRelativeAncestor(root: HTMLElement, media: MediaElement) {
	if (media instanceof HTMLVideoElement) {
		return null;
		// return root.querySelector('[aria-label="Video player"]');
	}

	let current = media.parentElement;
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

function getDatetime(media: HTMLElement): string;
function getDatetime(takenAt: number): string;
function getDatetime(value: HTMLElement | number) {
	if (typeof value === 'number') {
		return new Date(value).toISOString();
	}

	const time = value.closest(':has(time[datetime])')?.querySelector('time[datetime]');

	return time?.getAttribute('datetime') ?? new Date().toISOString();
}

function makeDownloadButton(container: HTMLElement, media: MediaElement, config: Config) {
	const button = document.createElement('button');

	// console.debug(button, BTN_CLASS_NAME);

	button.classList.add(BTN_CLASS_NAME);
	if (config.type) {
		button.classList.add(config.type);
	}

	button.appendChild(makeDownloadIcon());
	button.addEventListener('click', evt => void downloadHandler(evt, container, media, config));

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

function findShortcode(media: MediaElement) {
	const shortcode = findShortcodeInUrl();
	if (shortcode) {
		return shortcode;
	}

	const container = media.closest<HTMLElement>('article, [role="dialog"]');
	if (!container) {
		return null;
	}

	for (const a of container.querySelectorAll<HTMLAnchorElement>('a[href]')) {
		const match = a.href.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
		if (match) {
			return match[ 2 ] ?? null;
		}
	}

	return null;
}

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

function getFileExtension(url: string) {
	return new URL(url).pathname.split('.').pop() || 'jpg';
}

function getImageUrl(img: HTMLImageElement) {
	const srcset = img.srcset;
	if (!srcset) {
		return img.src;
	}

	const candidates = srcset
		.split(',')
		.map(source => {
			const parts = source.trim().split(/\s+/);

			return {
				url: parts[ 0 ] ?? '',
				width: parseInt(parts[ 1 ] ?? '0', 10),
			};
		})
		.filter(c => c.url);
	candidates.sort((a, b) => b.width - a.width);

	return candidates[ 0 ]?.url ?? img.src;
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
