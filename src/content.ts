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

///////

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

// blob URL → beste chunk URL (hoogste bitrate)
const blobToChunkUrl = new Map<string, { url: string, bitrate: number }>();

function parseEfgBitrate(url: string): number {
	try {
		const efg = new URL(url).searchParams.get('efg');
		if (!efg) return 0;
		return (JSON.parse(atob(efg)) as { bitrate?: number }).bitrate ?? 0;
	} catch {
		return 0;
	}
}

function cleanVideoUrl(url: string): string {
	const u = new URL(url);
	u.searchParams.delete('bytestart');
	u.searchParams.delete('byteend');
	return u.toString();
}

window.addEventListener('ig-dl-chunk', (evt) => {
	const { blobUrl, chunkUrl } = (evt as CustomEvent<{ blobUrl: string, chunkUrl: string }>).detail;
	const bitrate = parseEfgBitrate(chunkUrl);
	const existing = blobToChunkUrl.get(blobUrl);
	if (!existing || bitrate > existing.bitrate) {
		blobToChunkUrl.set(blobUrl, { url: cleanVideoUrl(chunkUrl), bitrate });
	}
});

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

		const filename = `${getProfileName(source) || 'unknown'}__${formatDatetime(datetime)}.${getFileExtension(source.src)}`;

		if (source instanceof HTMLVideoElement) {
			const blobUrl = source.src || source.currentSrc;
			const candidate = blobToChunkUrl.get(blobUrl);
			if (!candidate?.url) {
				console.warn('[ig-dl] geen chunk URL gevonden voor', blobUrl);
				return;
			}
			void chrome.runtime.sendMessage({ type: 'download', url: candidate.url, filename });
			return;
		}

		void chrome.runtime.sendMessage({
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
