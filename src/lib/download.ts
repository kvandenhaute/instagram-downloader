import type { Url } from './types';

import { logDebug } from './logger';

export async function downloadFile(url: Url, username: string, datetime: string, filenameOptions?: FilenameOptions): Promise<unknown> {
	logDebug(url, filenameOptions);

	return chrome.runtime.sendMessage({
		type: 'download',
		url,
		filename: makeFilename(url, username, datetime, filenameOptions),
	});
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
