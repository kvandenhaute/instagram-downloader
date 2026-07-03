import type { MediaItem, ReelItem } from './lib/types';

export type Message = DownloadMessage
  | GetMediaInfoMessage
  | GetHighlightReelsMessage
  | GetUserClipsMessage
  | GetUserFeedMessage
  | GetUserReelsMessage
  | GetUserTagsFeedMessage
  | GetWebProfileInfoMessage;

export type DownloadMessage = {
	type: 'download'
	url: string
	filename: string
};

export type GetHighlightReelsMessage = {
	type: 'get_highlight_reels'
	highlightId: string
};

export type GetMediaInfoMessage = {
	type: 'get_media_info'
	postId: string
};

export type GetMediaInfoMessageResponse = MediaItem;

export type GetUserClipsMessage = {
	next?: string
	type: 'get_user_clips'
	userId: number
};

export type GetUserClipsMessageResponse = {
	items: Array<MediaItem>
	next?: string
};

export type GetUserFeedMessage = {
	next?: string
	type: 'get_user_feed'
	userId: number
};

export type GetUserFeedMessageResponse = {
	items: Array<MediaItem>
	next?: string
};

export type GetUserTagsFeedMessage = {
	next?: string
	type: 'get_user_tags_feed'
	userId: number
};

export type GetUserTagsFeedMessageResponse = {
	items: Array<MediaItem>
	next?: string
};

export type GetUserReelsMessage = {
	type: 'get_user_reels'
	userId: number
};

export type GetUserReelsMessageResponse = {
	reels_by_pk: Record<string, ReelItem>
	reels: Array<ReelItem>
	username: string
};

export type GetWebProfileInfoMessage = {
	type: 'get_web_profile_info'
	username: string
};

export type GetWebProfileInfoMessageResponse = {
	userId: number
};
