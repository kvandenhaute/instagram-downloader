import type { Message } from './messages';
import type { StoredHeaders } from './server/lib/types';

import { AUTH_HEADER_NAMES, INSTAGRAM_ORIGIN } from './server/instagram/api';
import { fetchPost } from './server/instagram/posts';
import { fetchInstagramHighlightReels, fetchReels } from './server/instagram/reels';
import { fetchUserClips } from './server/instagram/user-clips';
import { fetchUserFeed } from './server/instagram/user-feed';
import { fetchUserTagsFeed } from './server/instagram/user-tags-feed';
import { fetchWebProfileInfo } from './server/instagram/web-profile';

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
			void fetchUserClips(message.userId, message.next)
				.then(result => sendResponse(result));

			return true;
		} else if (message.type === 'get_user_feed') {
			void fetchUserFeed(message.userId, message.next)
				.then(result => sendResponse(result));

			return true;
		} else if (message.type === 'get_user_tags_feed') {
			void fetchUserTagsFeed(message.userId, message.next)
				.then(result => sendResponse(result));

			return true;
		} else if (message.type === 'get_user_reels') {
			void fetchReels(message.userId)
				.then(result => sendResponse(result));

			return true;
		} else if (message.type === 'get_web_profile_info') {
			void fetchWebProfileInfo(message.username)
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
