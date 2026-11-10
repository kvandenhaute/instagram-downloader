export type MediaElement = HTMLImageElement | HTMLVideoElement;
export type PageType = 'highlights' | 'home-feed' | 'post' | 'profile' | 'reels' | 'reel' | 'stories';
export type Url = `https://${string}`;

export type MediaItem = {
	carousel_media?: Array<MediaCarouselItem>
	image?: Url
	taken_at: number
	username: string
	video?: Url
};

export type MediaFeedPage = {
	items: Array<MediaItem>
	next?: string
};

export type ShortcodeFeedPage = {
	next?: string
	shortcodes: Array<string>
};

export type MediaCarouselItem = {
	image?: Url
	taken_at: number
	video?: Url
};

export type ReelItem = {
	poster?: Url
	taken_at: number
	url: Url
};

export type ReelsMedia = {
	reels_by_pk: Record<string, ReelItem>
	reels: Array<ReelItem>
	username: string
};
