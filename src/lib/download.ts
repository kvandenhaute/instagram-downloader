import { logDebug } from './logger';

export async function download(url: string, username: string, datetime: string, filenameOptions?: FilenameOptions): Promise<unknown> {
	logDebug(makeFilename(url, username, datetime, filenameOptions));

	return chrome.runtime.sendMessage({
		type: 'download',
		url,
		filename: makeFilename(url, username, datetime, filenameOptions),
	});
}

export type FilenameOptions = {
	isPoster?: boolean
	suffix?: string | Array<string>
};

function makeFilename(url: string, username: string, datetime: string, options: FilenameOptions = {}) {
	const basenameParts: Array<string> = [ 'instagram', username, formatDatetimeToBasenamePart(datetime) ];
	const ext = getFileExtension(url);

	if (options.suffix) {
		if (Array.isArray(options.suffix)) {
			basenameParts.push(...options.suffix);
		} else {
			basenameParts.push(options.suffix);
		}
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

function getFileExtension(url: string) {
	return new URL(url).pathname.split('.').pop() || 'jpg';
}
