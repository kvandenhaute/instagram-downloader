let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function init() {
	const pathname = window.location.pathname;
	const selectors: Array<string> = [];

	if (pathname === '/') {
		selectors.push('article img[alt^="Photo"]');
		selectors.push('article video[src^="blob:https://www.instagram.com"]');
	}

	console.log(pathname);

	scanPage(selectors);

	const observer = new MutationObserver(() => {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => scanPage(selectors), 300);
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

function scanPage(selectors: Array<string>) {
	if (selectors.length === 0) {
		return;
	}

	const sources = document.querySelectorAll<HTMLImageElement>(selectors.join(','));

	sources.forEach(processSource);
}

function getDatetime(media: HTMLElement) {
	const time = media.closest(':has(time[datetime])')?.querySelector('time[datetime]');

	return time?.getAttribute('datetime') ?? new Date().toISOString();
}

function processSource(media: HTMLImageElement | HTMLVideoElement) {
	if (media.hasAttribute(PROCESSED_ATTR)) {
		return;
	}

	const container = media.closest<HTMLElement>('article');
	if (!container) {
		console.warn('NO CONTAINER', media);
		return;
	}

	const relativeAncestor = findRelativeAncestor(container, media);
	if (relativeAncestor) {
		relativeAncestor.appendChild(makeDownloadButton(container, media));
	} else {
		container.style.setProperty('position', 'relative');
		container.appendChild(makeDownloadButton(container, media));
	}

	media.setAttribute(PROCESSED_ATTR, '1');
}

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

// MAKERS //////////////////////////////////////////////////////////////////////////////////////////////////////////////

function makeDownloadButton(container: HTMLElement, media: HTMLImageElement | HTMLVideoElement) {
	const button = document.createElement('button');
	button.classList.add(BTN_CLASS_NAME);
	button.appendChild(makeDownloadIcon());
	button.addEventListener('click', (evt) => {
		evt.preventDefault();
		evt.stopPropagation();
		// evt.stopImmediatePropagation();

		const shortcode = findShortcode(media);
		if (!shortcode) {
			void downloadRawMedia(media);
			return;
		}

		void fetchMediaInfo(shortcode).then((mediaInfo) => {
			console.log(mediaInfo);

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
		console.warn('No shortcode found');
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
