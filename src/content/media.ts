import pMap from 'p-map';

import type { MediaCarouselItem, MediaItem, Url } from '../lib/types';
import type { GetMediaInfoMessage, GetMediaInfoMessageResponse } from '../messages';
import type { FilenameOptions } from './download';

import { logDebug, logError } from '../lib/logger';
import { downloadFile } from './download';
import { getDatetime, sendMessage } from './utils';

// MESSAGE \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

const mediaInfoMap: Map<string, GetMediaInfoMessageResponse> = new Map();

async function getMediaInfo(shortcode: string) {
	const mediaInfo = mediaInfoMap.get(shortcode);
	if (mediaInfo) {
		logDebug('MediaInfo', mediaInfo);

		return mediaInfo;
	}

	const postId = mapShortcodeToPostId(shortcode);
	const sendMessageResult = await sendMessage<GetMediaInfoMessageResponse>({
		type: 'get_media_info',
		postId,
	} satisfies GetMediaInfoMessage);
	if (!sendMessageResult.success) {
		throw sendMessageResult.error;
	}

	logDebug('MediaInfo', sendMessageResult.data);

	mediaInfoMap.set(shortcode, sendMessageResult.data);

	return sendMessageResult.data;
}

// DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export async function downloadOneByShortcode(url?: Url) {
	const shortcode = findShortcodeInUrl(url);
	if (!shortcode) {
		return logError('Could not find shortcode in url');
	}

	const mediaInfo = await getMediaInfo(shortcode);

	return downloadOne(mediaInfo);
}

export async function downloadOneFromCarouselByShortcode(index: number, url?: Url) {
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

	return downloadOne({
		...mediaItem,
		username: mediaInfo.username,
	}, { index });
}

export async function downloadOne(media: MediaItem, filenameOptions: FilenameOptions = {}) {
	const datetime = getDatetime(media.taken_at);

	if (media.video) {
		if (media.image) {
			await downloadFile(media.image, media.username, datetime, { ...filenameOptions, isPoster: true });
		}

		return downloadFile(media.video, media.username, datetime, filenameOptions);
	} else if (media.image) {
		return downloadFile(media.image, media.username, datetime, filenameOptions);
	}
}

export async function downloadManyFromCarousel(media: SetRequired<MediaItem, 'carousel_media'>) {
	return pMap(media.carousel_media, (item, index) => {
		return downloadOne({
			...item,
			username: media.username,
		}, { index });
	}, { concurrency: 2 });
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

// HELPERS \\\\

export function hasCarousel(item: MediaItem): item is SetRequired<MediaItem, 'carousel_media'> {
	return !!item.carousel_media;
}
