import type { StoredHeaders } from './server/types';

import { AUTH_HEADER_NAMES, INSTAGRAM_ORIGIN } from './server/instagram/api';
import { fetchPost } from './server/instagram/posts';
import { fetchInstagramHighlightReels, fetchInstagramUserReels } from './server/instagram/reels';
import { fetchInstagramUserClips } from './server/instagram/user-clips';
import { fetchInstagramUserFeed } from './server/instagram/user-feed';
import { fetchInstagramUserTagsFeed } from './server/instagram/user-tags-feed';
import { fetchInstagramWebProfileInfo } from './server/instagram/web-profile';

type DownloadMessage = {
	type: 'download'
	url: string
	filename: string
};

type GetHighlightReelsMessage = {
	type: 'get_highlight_reels'
	highlightId: string
};

type GetMediaInfoMessage = {
	type: 'get_media_info'
	postId: string
};

type GetUserClipsMessage = {
	next?: string
	type: 'get_user_clips'
	userId: number
};

type GetUserFeedMessage = {
	next?: string
	type: 'get_user_feed'
	userId: number
};

type GetUserTagsFeedMessage = {
	next?: string
	type: 'get_user_tags_feed'
	userId: number
};

type GetUserReelsMessage = {
	type: 'get_user_reels'
	userId: number
};

type GetWebProfileInfoMessage = {
	type: 'get_web_profile_info'
	username: string
};

type Message = DownloadMessage | GetMediaInfoMessage | GetHighlightReelsMessage | GetUserClipsMessage | GetUserFeedMessage | GetUserReelsMessage | GetUserTagsFeedMessage | GetWebProfileInfoMessage;

chrome.runtime.onMessage.addListener(
	(message: Message, _sender, sendResponse) => {
		if (message.type === 'download') {
			chrome.downloads.download(
				{ url: message.url, filename: message.filename, saveAs: false, conflictAction: 'overwrite' },
				() => sendResponse({ success: !chrome.runtime.lastError }),
			);

			return true;
		} else if (message.type === 'get_media_info') {
			void fetchPost(message.postId)
				.then(result => sendResponse(result));

			return true;
		} else if (message.type === 'get_highlight_reels') {
			void fetchInstagramHighlightReels(message.highlightId)
				.then(result => sendResponse(result));

			return true;
		} else if (message.type === 'get_user_clips') {
			void fetchInstagramUserClips(message.userId, message.next)
				.then(result => sendResponse(result));

			return true;
		} else if (message.type === 'get_user_feed') {
			void fetchInstagramUserFeed(message.userId, message.next)
				.then(result => sendResponse(result));

			return true;
		} else if (message.type === 'get_user_tags_feed') {
			void fetchInstagramUserTagsFeed(message.userId, message.next)
				.then(result => sendResponse(result));

			return true;
		} else if (message.type === 'get_user_reels') {
			void fetchInstagramUserReels(message.userId)
				.then(result => sendResponse(result));

			return true;
		} else if (message.type === 'get_web_profile_info') {
			void fetchInstagramWebProfileInfo(message.username)
				.then(result => sendResponse(result));

			return true;
		}
	},
);

chrome.webRequest.onBeforeSendHeaders.addListener(
	details => {
		if (!details.requestHeaders?.length) {
			return;
		}

		const updates: StoredHeaders = {};
		for (const header of details.requestHeaders) {
			if (AUTH_HEADER_NAMES.includes(header.name.toLowerCase()) && header.value) {
				updates[ header.name.toLowerCase() ] = header.value;
			}
		}

		if (!Object.keys(updates).length) {
			return;
		}

		void chrome.storage.local.get('igHeaders').then(data => {
			const current = (data[ 'igHeaders' ] as StoredHeaders | undefined) ?? {};
			void chrome.storage.local.set({
				igHeaders: { ...current, ...updates },
			});
		});
	},
	{ urls: [ `${INSTAGRAM_ORIGIN}/*` ], types: [ 'xmlhttprequest' ] },
	[ 'requestHeaders', 'extraHeaders' ],
);
