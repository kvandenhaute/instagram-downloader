import type { MediaItem } from './lib/types';

export type Message = DownloadMessage
  | GetMediaInfoMessage
  | GetUserClipsMessage
  | GetUserFeedMessage
  | GetUserTagsFeedMessage;

export type DownloadMessage = {
	type: 'download'
	url: string
	filename: string
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

export type GetWebProfileInfoMessageResponse = {
	userId: number
};
