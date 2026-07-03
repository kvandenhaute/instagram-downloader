import type { Url } from '../lib/types';
import type { FilenameOptions } from './download';

import { logDebug, logError } from '../lib/logger';
import { downloadFile } from './download';
import { getDatetime, sendMessage } from './utils';

export type MediaItem = {
	carousel_media?: Array<MediaCarouselItem>
	image?: Url
	taken_at: number
	username: string
	video?: Url
};

export type MediaCarouselItem = { image?: Url, taken_at: number, video?: Url };

// MESSAGE \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

type MediaInfoResponse = MediaItem;

const mediaInfoMap: Map<string, MediaInfoResponse> = new Map();

async function getMediaInfo(shortcode: string) {
	const mediaInfo = mediaInfoMap.get(shortcode);
	if (mediaInfo) {
		logDebug('MediaInfo', mediaInfo);

		return mediaInfo;
	}

	const postId = mapShortcodeToPostId(shortcode);
	const sendMessageResult = await sendMessage<MediaInfoResponse>({ type: 'get_media_info', postId });
	if (!sendMessageResult.success) {
		throw sendMessageResult.error;
	}

	logDebug('MediaInfo', sendMessageResult.data);

	mediaInfoMap.set(shortcode, sendMessageResult.data);

	return sendMessageResult.data;
}

// DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export async function downloadOne(url?: Url) {
	const shortcode = findShortcodeInUrl(url);
	if (!shortcode) {
		return logError('Could not find shortcode in url');
	}

	const mediaInfo = await getMediaInfo(shortcode);

	return download(mediaInfo);
}

export async function downloadOneFromCarousel(index: number, url?: Url) {
	const shortcode = findShortcodeInUrl(url);
	if (!shortcode) {
		return logError('Could not find shortcode in url');
	}

	const mediaInfo = await getMediaInfo(shortcode);
	const carouselMedia = mediaInfo.carousel_media;
	if (!carouselMedia) {
		return logError(`Could not find carousel media for shortcode ${shortcode}`);
	}

	const mediaItem = carouselMedia.at(index);
	if (!mediaItem) {
		return logError(`Could not find carousel media item ${index} for shortcode ${shortcode}`);
	}

	return download({
		...mediaItem,
		username: mediaInfo.username,
	}, { index });
}

async function download(media: MediaItem, filenameOptions: FilenameOptions = {}) {
	const datetime = getDatetime(media.taken_at);

	if (media.video) {
		if (media.image) {
			console.log(media.taken_at);

			await downloadFile(media.image, media.username, datetime, { ...filenameOptions, isPoster: true });
		}

		return downloadFile(media.video, media.username, datetime, filenameOptions);
	} else if (media.image) {
		return downloadFile(media.image, media.username, datetime, filenameOptions);
	}
}

// SHORT CODE \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function findShortcodeInUrl(url?: Url) {
	const urlMatch = (url || window.location.href).match(/\/(p|reel|reels)\/([A-Za-z0-9_-]+)/);

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
