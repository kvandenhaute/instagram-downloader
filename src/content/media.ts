import pMap from 'p-map';

import type { MediaItem, Url } from '../lib/types';
import type { FilenameOptions } from './download';

import { logDebug, logError } from '../lib/logger';
import { fetchPost } from './api';
import { downloadFile } from './download';
import { getDatetime } from './utils';

// FETCH \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

const mediaInfoMap: Map<string, MediaItem> = new Map();

export async function getMediaInfo(shortcode: string) {
	const mediaInfo = mediaInfoMap.get(shortcode);
	if (mediaInfo) {
		logDebug('MediaInfo', mediaInfo);

		return mediaInfo;
	}

	const mediaItem = await fetchPost(shortcode);

	logDebug('MediaInfo', mediaItem);

	mediaInfoMap.set(shortcode, mediaItem);

	return mediaItem;
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

export function mapPostIdToShortcode(postId: string) {
	let id = BigInt(postId);
	let shortcode = '';

	while (id > BigInt(0)) {
		shortcode = CHARS.charAt(Number(id % BigInt(64))) + shortcode;
		id /= BigInt(64);
	}

	return shortcode;
}

// HELPERS \\\\

export function hasCarousel(item: MediaItem): item is SetRequired<MediaItem, 'carousel_media'> {
	return !!item.carousel_media;
}
