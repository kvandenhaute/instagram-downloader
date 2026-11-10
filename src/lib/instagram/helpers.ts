import type { DashVideo, MediaCarouselItem, MediaItem, Url } from '../types';
import type { InstagramCarouselMediaItem, InstagramMediaItem, InstagramMediaVersion } from './types';

export function findBestCandidate(candidates: Array<InstagramMediaVersion>) {
	return [ ...candidates ].sort((a, b) => b.width - a.width)[ 0 ];
}

export function makeMediaItem(item: InstagramMediaItem) {
	return {
		carousel_media: item.carousel_media?.map(media => makeMediaCarouselItem(media, item.taken_at)),
		dash: getDashVideo(item),
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
		dash: getDashVideo(item),
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

// The stories query has no width on video_versions.
const VIDEO_VERSIONS_MAX_WIDTH = 720;

// video_versions tops out at 720px wide; the DASH manifest often has a larger
// version, with video and audio as separate files. Only returned when it is
// larger than the best of video_versions.
export function getDashVideo(item: InstagramMediaItem | InstagramCarouselMediaItem): DashVideo | undefined {
	if (!item.video_dash_manifest) {
		return;
	}

	const doc = new DOMParser().parseFromString(item.video_dash_manifest, 'application/xml');
	const videos: Array<InstagramMediaVersion> = [];
	const audios: Array<{ bandwidth: number, url: string }> = [];

	for (const representation of doc.querySelectorAll('Representation')) {
		const mimeType = representation.getAttribute('mimeType') ?? representation.parentElement?.getAttribute('mimeType');
		const url = representation.querySelector('BaseURL')?.textContent;
		if (!url) {
			continue;
		}

		if (mimeType?.startsWith('video/')) {
			const width = Number(representation.getAttribute('width'));
			const height = Number(representation.getAttribute('height'));
			width && videos.push({ url, width, height });
		} else if (mimeType?.startsWith('audio/')) {
			audios.push({ url, bandwidth: Number(representation.getAttribute('bandwidth')) });
		}
	}

	const video = videos.length ? findBestCandidate(videos) : undefined;
	const best = item.video_versions ? findBestCandidate(item.video_versions) : undefined;
	if (!video || (best && video.width <= (best.width || VIDEO_VERSIONS_MAX_WIDTH))) {
		return;
	}

	const audio = audios.sort((a, b) => b.bandwidth - a.bandwidth).at(0);

	return { audio: audio?.url as Url | undefined, video: video.url as Url };
}
