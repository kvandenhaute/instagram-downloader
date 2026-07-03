import { logDebug, logError } from './logger';
import { getDatetime, sendMessage } from './utils';
import type { MediaElement } from './types';
import { download } from './download';

export type MediaItem = {
	carousel_media?: Array<MediaCarouselItem>
	image?: string
	taken_at: number
	username: string
	video?: string
};

export type MediaCarouselItem = { image?: string, taken_at: number, video?: string };

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

export async function downloadByShortcode(media: MediaElement, url?: string, index?: number) {
	const shortcode = findShortcodeInUrl(url);
	if (!shortcode) {
		return logError('Could not find shortcode in url');
	}

	const mediaInfo = await getMediaInfo(shortcode);
	let urls: Pick<MediaInfoResponse, 'image' | 'video'> | undefined;

	if (typeof index !== 'undefined') {
		urls = mediaInfo.carousel_media?.at(index);
	} else {
		urls = mediaInfo;
	}

	if (!urls) {
		return logError('Could not find media item url');
	}

	if (media instanceof HTMLImageElement) {
		if (!urls.image) {
			return logError('Expected to have an image URL within the mediaInfo response');
		}

		return download(urls.image, mediaInfo.username, getDatetime(mediaInfo.taken_at));
	} else if (!urls.video) {
		return logError('Expected to have a video URL within the mediaInfo response');
	}

	if (urls.image) {
		await download(urls.image, mediaInfo.username, getDatetime(mediaInfo.taken_at), { isPoster: true });
	}

	return download(urls.video, mediaInfo.username, getDatetime(mediaInfo.taken_at));
}

// SHORT CODE \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function findShortcodeInUrl(url: string = window.location.href) {
	const urlMatch = url.match(/\/(p|reel|reels)\/([A-Za-z0-9_-]+)/);

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
