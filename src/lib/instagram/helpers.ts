import type { MediaCarouselItem, MediaItem, Url } from '../types';
import type { InstagramCarouselMediaItem, InstagramMediaItem, InstagramMediaVersion } from './types';

export function findBestCandidate(candidates: Array<InstagramMediaVersion>) {
	return [ ...candidates ].sort((a, b) => b.width - a.width)[ 0 ];
}

export function makeMediaItem(item: InstagramMediaItem) {
	return {
		carousel_media: item.carousel_media?.map(media => makeMediaCarouselItem(media, item.taken_at)),
		image: getImageUrl(item),
		taken_at: item.taken_at * 1000,
		username: item.user.username,
		video: getVideoUrl(item),
	} satisfies MediaItem;
}

// The GraphQL post query has no taken_at on carousel items, so fall back to the
// post's own.
function makeMediaCarouselItem(item: InstagramCarouselMediaItem, parentTakenAt: number) {
	return {
		image: getImageUrl(item),
		taken_at: (item.taken_at ?? parentTakenAt) * 1000,
		video: getVideoUrl(item),
	} satisfies MediaCarouselItem;
}

function getImageUrl(item: InstagramMediaItem | InstagramCarouselMediaItem) {
	return item.image_versions2 && findBestCandidate(item.image_versions2.candidates).url as Url | undefined;
}

function getVideoUrl(item: InstagramMediaItem | InstagramCarouselMediaItem) {
	return (item.video_versions ? findBestCandidate(item.video_versions).url : item.video_url) as Url | undefined;
}
