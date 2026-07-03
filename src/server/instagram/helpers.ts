import type { MediaCarouselItem, MediaItem, Url } from '../../lib/types';
import type { InstagramCarouselMediaItem, InstagramMediaItem, InstagramMediaVersion } from './types';

export function findBestCandidate(candidates: Array<InstagramMediaVersion>) {
	return [ ...candidates ].sort((a, b) => b.width - a.width)[ 0 ];
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
