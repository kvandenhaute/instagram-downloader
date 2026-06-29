const PROCESSED_ATTR = 'data-ig-dl-processed';
const BTN_CLASS_NAME = 'ig-dl-btn';

const STYLE = `
  article { position: relative !important; }
  .${BTN_CLASS_NAME} {
    position: absolute;
    top: 10px;
    left: 14px;
    aspect-ratio: 1;
    border: 0;
    border-radius: 50%;
    background-color: rgba(43, 48, 54, .5);
    cursor: pointer;
    z-index: 1;
  }
  .${BTN_CLASS_NAME}:hover {
    background: rgba(43, 48, 54, .85);
  }
`;

function injectStyle(): void {
	if (document.getElementById('ig-dl-style')) {
		return;
	}

	const el = document.createElement('style');
	el.id = 'ig-dl-style';
	el.textContent = STYLE;

	document.head.appendChild(el);
}

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

interface VideoUrlResponse {
	url?: string
	error?: string
}

function shortcodeToPostId(shortcode: string): string {
	const code = shortcode.length > 28 ? shortcode.slice(0, shortcode.length - 28) : shortcode;
	let id = BigInt(0);
	for (const ch of code) {
		id = id * BigInt(64) + BigInt(CHARS.indexOf(ch));
	}
	return id.toString();
}

function getShortcode(source: HTMLElement): string | null {
	const article = source.closest('article');
	if (!article) return null;
	for (const a of article.querySelectorAll<HTMLAnchorElement>('a[href]')) {
		const match = a.href.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
		if (match) return match[2] ?? null;
	}
	return null;
}

function sendMessage<T>(message: Record<string, unknown>): Promise<T> {
	return chrome.runtime.sendMessage(message);
}

///////

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function scanPage() {
	const wrappers = document.querySelectorAll<HTMLImageElement>('article:has(img[alt^="Photo"]),article:has(video)');
	// console.log('[ig-dl] scanPage', 'articles', articles.length);

	wrappers.forEach(processWrapper);
}

function processWrapper(wrapper: HTMLElement) {
	const sources = wrapper.querySelectorAll<HTMLImageElement>('img[alt^="Photo"],video');

	sources.forEach(processSource);
}

function processSource(source: HTMLImageElement | HTMLVideoElement) {
	if (source.hasAttribute(PROCESSED_ATTR)) {
		return;
	}

	const wrapper = source.closest<HTMLElement>('article,li');
	if (!wrapper) {
		console.warn('NO WRAPPER');
		return;
	}

	const relativeAncestor = findRelativeAncestor(wrapper, source);
	if (!relativeAncestor) {
		console.warn('NO RELATIVE ANCESTOR');
		return;
	}

	const time = source.closest(':has(time[datetime])')?.querySelector('time[datetime]');
	if (!time) {
		console.warn('NO TIME');
		// console.log(new Date().toISOString());
		return;
	}
	relativeAncestor.appendChild(makeDownloadButton(source, time.getAttribute('datetime') as string));

	source.setAttribute(PROCESSED_ATTR, '1');
}

function makeDownloadButton(source: HTMLImageElement | HTMLVideoElement, datetime: string) {
	const button = document.createElement('button');

	if (source instanceof HTMLVideoElement) {
		button.style.setProperty('top', '52px');
	}

	// button.style.setProperty('box-sizing', 'border-box');
	// button.style.setProperty('background-color', 'rgba(43, 48, 54, .5)');

	button.classList.add(BTN_CLASS_NAME);

	button.appendChild(makeDownloadIcon());

	button.addEventListener('click', (evt) => {
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();

		if (source instanceof HTMLVideoElement) {
			const shortcode = getShortcode(source);
			if (!shortcode) {
				console.warn('[ig-dl] geen shortcode gevonden');
				return;
			}
			const postId = shortcodeToPostId(shortcode);
			const filename = `${getProfileName(source) || 'unknown'}__${formatDatetime(datetime)}.mp4`;
			void sendMessage<VideoUrlResponse>({ type: 'get_video_url', postId })
				.then((response) => {
					if (!response?.url) {
						console.warn('[ig-dl] geen video URL (shortcode=%s, postId=%s):', shortcode, postId, response?.error);
						return;
					}
					void sendMessage({ type: 'download', url: response.url, filename });
				});
			return;
		}

		const filename = `${getProfileName(source) || 'unknown'}__${formatDatetime(datetime)}.${getFileExtension(source.src)}`;
		void sendMessage({
			type: 'download',
			url: getBestImageUrl(source),
			filename,
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

function formatDatetime(datetime: string): string {
	return datetime
		.replace('T', '_')
		.replace(/([:-])/g, '')
		.replace(/\.\d+Z?$/, '');
}

function getBestImageUrl(img: HTMLImageElement): string {
	const srcset = img.srcset;
	if (!srcset) return img.src;
	const candidates = srcset
		.split(',')
		.map((s) => {
			const parts = s.trim().split(/\s+/);
			return { url: parts[0] ?? '', width: parseInt(parts[1] ?? '0', 10) };
		})
		.filter(c => c.url);
	candidates.sort((a, b) => b.width - a.width);
	return candidates[0]?.url ?? img.src;
}

function getFileExtension(source: string) {
	return new URL(source).pathname.split('.').pop() || 'webp';
}

function getProfileName(source: HTMLElement) {
	console.log(source.closest(':has(a)')?.querySelector('a')?.textContent);

	return source.closest(':has(a)')?.querySelector('a')?.textContent;
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

/////////

function init(): void {
	injectStyle();
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
