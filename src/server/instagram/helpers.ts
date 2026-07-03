import type { InstagramCarouselMediaItem, InstagramMediaItem, InstagramMediaVersion, MediaItemResult } from './types';

export function findBestCandidate(candidates: Array<InstagramMediaVersion>) {
	return [ ...candidates ].sort((a, b) => b.width - a.width)[ 0 ];
}

export function makeMediaItemResult(item: InstagramMediaItem) {
	return {
		carousel_media: makeCarouselResult(item.carousel_media),
		image: makeImageResult(item),
		taken_at: item.taken_at * 1000,
		username: item.user.username,
		video: makeVideoResult(item),
	} satisfies MediaItemResult;
}

function makeCarouselResult(items?: Array<InstagramCarouselMediaItem>) {
	return items?.map(media => ({
		image: media.image_versions2 && findBestCandidate(media.image_versions2.candidates).url,
		taken_at: media.taken_at * 1000,
		video: media.video_versions ? findBestCandidate(media.video_versions).url : media.video_url,
	}));
}

function makeImageResult(item: InstagramMediaItem) {
	return item.image_versions2 && findBestCandidate(item.image_versions2.candidates).url;
}

function makeVideoResult(item: InstagramMediaItem) {
	return item.video_versions ? findBestCandidate(item.video_versions).url : item.video_url;
}
