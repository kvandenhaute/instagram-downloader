import type { FailureResult, MediaCarouselItem, MediaItem, SuccessResult, Url } from '../../lib/types';
import type { InstagramCarouselMediaItem, InstagramMediaItem } from '../instagram/types';

import { findBestCandidate } from '../instagram/helpers';

export function makeErrorResult(err: unknown, prefix?: `${string}: `): FailureResult {
	return { success: false, error: getError(err, prefix) };
}

export function makeSuccessResult<T>(data: T): SuccessResult<typeof data> {
	return { success: true, data };
}

function getError(err: unknown, prefix?: `${string}: `) {
	if (err instanceof Error) {
		if (prefix) {
			return new Error(prefix + err.message, { cause: err });
		}

		return err;
	} else if (typeof err === 'string') {
		return new Error(prefix ? prefix + err : err);
	}

	return new Error(prefix ? prefix + 'Something unexpected occurred.' : 'Something unexpected occurred.');
}

export function makeMediaItem(item: InstagramMediaItem) {
	return {
		carousel_media: makeMediaCarouselItem(item.carousel_media),
		image: getImageUrl(item),
		taken_at: item.taken_at * 1000,
		username: item.user.username,
		video: getVideoUrl(item),
	} satisfies MediaItem;
}

function makeMediaCarouselItem(items?: Array<InstagramCarouselMediaItem>) {
	return items?.map(media => ({
		image: media.image_versions2 && findBestCandidate(media.image_versions2.candidates).url as Url,
		taken_at: media.taken_at * 1000,
		video: (media.video_versions ? findBestCandidate(media.video_versions).url : media.video_url) as Url | undefined,
	} satisfies MediaCarouselItem));
}

function getImageUrl(item: InstagramMediaItem) {
	return item.image_versions2 && findBestCandidate(item.image_versions2.candidates).url as Url | undefined;
}

function getVideoUrl(item: InstagramMediaItem) {
	return (item.video_versions ? findBestCandidate(item.video_versions).url : item.video_url) as Url | undefined;
}
