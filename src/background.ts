import type { Message } from './messages';

import { INSTAGRAM_ORIGIN } from './lib/constants';

chrome.runtime.onMessage.addListener(
	(message: Message, _sender, sendResponse) => {
		if (message.type === 'download') {
			chrome.downloads.download(
				{ url: message.url, filename: message.filename, saveAs: false, conflictAction: 'overwrite' },
				() => sendResponse({ success: !chrome.runtime.lastError }),
			);

			return true;
		}
	},
);

const GRAPHQL_QUERY_NAMES: Record<string, string> = {
	PolarisProfileTaggedTabContentQuery: 'igTaggedQuery',
};

chrome.webRequest.onBeforeRequest.addListener(
	details => {
		const formData = details.requestBody?.formData;
		if (!formData) {
			return;
		}

		const getString = (key: string): string | undefined => {
			const val = formData[ key ];

			return val instanceof ArrayBuffer ? undefined : (val as string[] | undefined)?.[ 0 ];
		};

		const friendlyName = getString('fb_api_req_friendly_name');
		const storageKey = friendlyName && GRAPHQL_QUERY_NAMES[ friendlyName ];
		if (!storageKey) {
			return;
		}

		const docId = getString('doc_id');
		const fbDtsg = getString('fb_dtsg');
		const lsd = getString('lsd');
		const av = getString('av');

		if (docId && fbDtsg && lsd) {
			void chrome.storage.local.set({ [ storageKey ]: { docId, fbDtsg, lsd, av } });
		}
	},
	{ urls: [ `${INSTAGRAM_ORIGIN}/graphql/query*` ], types: [ 'xmlhttprequest' ] },
	[ 'requestBody' ],
);
