import pMap from 'p-map';

import { BTN_CLASS_NAME, makeDownloadButton } from './buttons';
import { downloadFile } from './download';
import { logError } from './logger';
import { downloadReel, type Reel } from './reels';
import { getDatetime, sendMessage } from './utils';

// MESSAGE \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

type HighlightReels = {
	reels_by_pk: Record<string, Reel>
	reels: Array<Reel>
	username: string
};

async function getHighlightReels(highlightId: string) {
	const sendMessageResult = await sendMessage<HighlightReels>({ type: 'get_highlight_reels', highlightId });
	if (!sendMessageResult.success) {
		throw sendMessageResult.error;
	}

	return sendMessageResult.data;
}

// DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

async function downloadAllHighlights() {
	const highlights = await collectAllHighlights();

	return pMap(highlights, async highlight => {
		const reels = await getHighlightReels(highlight.id);
		const title = highlight.title || highlight.id;

		return pMap(reels.reels, async (reel, index) => {
			const suffix = [
				encodeURIComponent(title.replace(/[^\p{L}\p{N}\s_-]/gu, '').trim()),
				index.toString().padStart(3, '0'),
			];

			return downloadReel(reel, reels.username, { suffix });
		}, { concurrency: 3 });
	}, { concurrency: 3 });
}

async function downloadSingleHighlight(root: HTMLElement) {
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

	return downloadFile(reel.url, highlightReels.username, getDatetime(reel.taken_at));
}

// BUTTONS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export function makeDownloadAllHighlightsButton() {
	const downloadButton = makeDownloadButton('profile', { className: 'highlights', text: 'Highlights' });
	downloadButton.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();

		downloadButton.disabled = true;

		void downloadAllHighlights()
			.finally(() => (downloadButton.disabled = false));
	});

	return downloadButton;
}

export function addDownloadSingleHighlightButton() {
	const root = document.querySelector<HTMLElement>('section > div > div > div');
	if (!root || root.querySelector(`:scope > .${BTN_CLASS_NAME}`)) {
		return;
	}

	const downloadButton = makeDownloadButton('highlights');
	downloadButton.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();

		void downloadSingleHighlight(root);
	});

	root.appendChild(downloadButton);
}

// HELPERS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

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
