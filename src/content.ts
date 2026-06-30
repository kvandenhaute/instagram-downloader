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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const BTN_CLASS_NAME = 'ig-dl-btn';
const PROCESSED_ATTR = 'data-ig-dl-processed';

type Config = {
	containers: Array<string>
	selectors: Array<string>
	username?: string
};

function getConfig() {
	const pathname = window.location.pathname;

	// console.log(pathname);

	const config: Config = {
		containers: [],
		selectors: [],
		username: findUsernameInUrl(),
	};

	// console.log(config.username);

	if (pathname === '/' || pathname.startsWith('/p/')) {
		config.containers.push('article');
		config.selectors.push('article img[alt^="Photo"]');
		config.selectors.push('article video[src^="blob:https://www.instagram.com"]');
	}

	if (pathname.startsWith('/p/')) {
		config.containers.push('main > div > div');
		config.selectors.push('main > div > div li img');
		config.selectors.push('main > div > div video[src^="blob:https://www.instagram.com"]');
	}

	if (pathname.startsWith('/stories/')) {
		config.containers.push('section');
		config.selectors.push('section img', 'section video');
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

function processMedia(media: HTMLImageElement | HTMLVideoElement, config: Config) {
	if (media.hasAttribute(PROCESSED_ATTR)) {
		return;
	}

	const container = media.closest<HTMLElement>(config.containers.join(','));
	if (!container) {
		console.warn('NO CONTAINER', media, config.containers);
		return;
	}

	const relativeAncestor = findRelativeAncestor(container, media);
	if (relativeAncestor) {
		relativeAncestor.appendChild(makeDownloadButton(container, media, config));
	} else {
		container.style.setProperty('position', 'relative');
		container.appendChild(makeDownloadButton(container, media, config));
	}

	media.setAttribute(PROCESSED_ATTR, '1');
}

// DOWNLOAD ////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function download(url: string, username: string, datetime: string) {
	const ext = getFileExtension(url);

	console.log(datetime);

	return sendMessage({
		type: 'download',
		url,
		filename: `${username}__${formatDatetimeToFilenamePart(datetime)}.${ext}`,
	});
}

async function downloadRawMedia(media: HTMLImageElement | HTMLVideoElement, username: string = 'unknown') {
	if (media instanceof HTMLVideoElement) {
		console.warn('Download of raw video not supported');
		return;
	}

	return downloadRawImage(media, username);
}

async function downloadRawImage(img: HTMLImageElement, username: string) {
	const url = getImageUrl(img);
	const ext = getFileExtension(url);

	return sendMessage({
		type: 'download',
		url,
		filename: `${username}__${formatDatetimeToFilenamePart(getDatetime(img))}.${ext}`,
	});
}

// URL /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function findUsernameInUrl() {
	const match = window.location.href.match(/\/stories\/([^/]+)\//);
	if (match && match[1]) {
		return match[1];
	}
}

// DOM /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function findRelativeAncestor(root: HTMLElement, source: HTMLImageElement | HTMLVideoElement) {
	if (source instanceof HTMLVideoElement) {
		return root.querySelector('[aria-label="Video player"]');
	}

	let current = source.parentElement;
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

function getDatetime(media: HTMLElement) {
	const time = media.closest(':has(time[datetime])')?.querySelector('time[datetime]');

	return time?.getAttribute('datetime') ?? new Date().toISOString();
}

function makeDownloadButton(container: HTMLElement, media: HTMLImageElement | HTMLVideoElement, config: Config) {
	const button = document.createElement('button');
	button.classList.add(BTN_CLASS_NAME);
	button.appendChild(makeDownloadIcon());
	button.addEventListener('click', (evt) => {
		evt.preventDefault();
		evt.stopPropagation();
		// evt.stopImmediatePropagation();

		const shortcode = findShortcode(media);
		if (!shortcode) {
			void downloadRawMedia(media, config.username);
			return;
		}

		void fetchMediaInfo(shortcode).then((mediaInfo) => {
			// console.log(mediaInfo);

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
			} else {
				if (media instanceof HTMLVideoElement && mediaInfo.video) {
					return download(mediaInfo.video, mediaInfo.username, getDatetime(media));
				} else if (mediaInfo.image) {
					return download(mediaInfo.image, mediaInfo.username, getDatetime(media));
				}

				console.error('[ig-dl]', 'Could not find media item url');
			}
		});
	});

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

function findShortcode(media: HTMLImageElement | HTMLVideoElement) {
	const urlMatch = window.location.pathname.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
	if (urlMatch) {
		return urlMatch[2] ?? null;
	}

	const container = media.closest<HTMLElement>('article, [role="dialog"]');
	if (!container) {
		return null;
	}

	for (const a of container.querySelectorAll<HTMLAnchorElement>('a[href]')) {
		const match = a.href.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
		if (match) {
			return match[2] ?? null;
		}
	}

	return null;
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
		.map((source) => {
			const parts = source.trim().split(/\s+/);

			return {
				url: parts[0] ?? '',
				width: parseInt(parts[1] ?? '0', 10),
			};
		})
		.filter(c => c.url);
	candidates.sort((a, b) => b.width - a.width);

	return candidates[0]?.url ?? img.src;
}

// MESSAGE /////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function fetchMediaInfo(shortcode: string) {
	const postId = mapShortcodeToPostId(shortcode);

	return sendMessage<MediaInfoResponse>({ type: 'get_media_info', postId });
}

function sendMessage<T>(message: Record<string, unknown>): Promise<T> {
	return chrome.runtime.sendMessage(message);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

type MediaInfoResponse = {
	carousel_media?: Array<{ image?: string, video?: string }>
	image?: string
	taken_at: number
	username: string
	video?: string
};
