import type { Url } from '../lib/types';
import type { DownloadMergedMessage, DownloadMessage } from '../messages';

import { logDebug } from '../lib/logger';

export async function downloadFile(url: Url, username: string, datetime: string, filenameOptions?: FilenameOptions): Promise<unknown> {
	const filename = makeFilename(url, username, datetime, filenameOptions);

	logDebug(filename);

	return chrome.runtime.sendMessage({
		type: 'download',
		url,
		filename,
	} satisfies DownloadMessage);
}

// Video and audio are merged into one MP4 by the background; rejects when that
// fails, so the caller can fall back to another file.
export async function downloadMergedFile(videoUrl: Url, audioUrl: Url, username: string, datetime: string, filenameOptions?: FilenameOptions) {
	const filename = makeFilename(videoUrl, username, datetime, filenameOptions);

	logDebug(filename, '(merged)');

	const response = await chrome.runtime.sendMessage<DownloadMergedMessage, { success: boolean, error?: string }>({
		type: 'download_merged',
		audioUrl,
		filename,
		videoUrl,
	});
	if (!response.success) {
		throw new Error(`Merge failed: ${response.error ?? 'unknown error'}`);
	}
}

export type FilenameOptions = {
	index?: number
	isPoster?: boolean
	suffix?: string | Array<string>
};

function makeFilename(url: Url, username: string, datetime: string, options: FilenameOptions = {}) {
	const basenameParts: Array<string> = [ 'instagram', username, formatDatetimeToBasenamePart(datetime) ];
	const ext = getFileExtension(url);

	if (options.suffix) {
		if (Array.isArray(options.suffix)) {
			basenameParts.push(...options.suffix);
		} else {
			basenameParts.push(options.suffix);
		}
	}

	if (typeof options.index === 'number') {
		basenameParts.push((options.index + 1).toString().padStart(3, '0'));
	}

	options.isPoster && basenameParts.push('poster');

	return `${basenameParts.join('__')}.${ext}`;
}

function formatDatetimeToBasenamePart(datetime: string): string {
	return datetime
		.replace('T', '_')
		.replace(/([:-])/g, '')
		.replace(/\.\d+Z?$/, '');
}

function getFileExtension(url: Url) {
	return new URL(url).pathname.split('.').pop() || 'jpg';
}
