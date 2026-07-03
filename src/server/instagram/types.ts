export type InstagramMediaItem = {
	carousel_media?: Array<InstagramCarouselMediaItem>
	image_versions2?: {
		candidates: Array<InstagramMediaVersion>
	}
	pk: number
	taken_at: number
	user: {
		username: string
	}
	video_url?: string
	video_versions?: Array<InstagramMediaVersion>
};

export type InstagramCarouselMediaItem = {
	image_versions2?: {
		candidates: Array<InstagramMediaVersion>
	}
	pk: number
	taken_at: number
	video_url?: string
	video_versions?: Array<InstagramMediaVersion>
};

export type InstagramMediaVersion = {
	url: string
	width: number
	height: number
};

export type MediaItemResult = MediaVersion & {
	carousel_media?: Array<MediaVersion>
	username: string
};

type MediaVersion = {
	image?: string
	taken_at: number
	video?: string
};
