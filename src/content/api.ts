import type { InstagramMediaItem } from '../lib/instagram/types';
import type { MediaItem } from '../lib/types';

import { INSTAGRAM_ORIGIN, INSTAGRAM_WEB_APP_ID } from '../lib/constants';
import { makeMediaItem } from '../lib/instagram/helpers';

const POST_QUERY_NAME = 'PolarisPostRootQuery';
const DEFAULT_POST_DOC_ID = '29206052369006419';
const DEFAULT_POST_VARIABLES = {
	__relay_internal__pv__PolarisAdDebugToolEnabledrelayprovider: false,
	__relay_internal__pv__PolarisShortDramaEnabledrelayprovider: true,
	__relay_internal__pv__PolarisThreadsStyleCommentsEnabledrelayprovider: false,
	__relay_internal__pv__PolarisMultiCaptionCarouselEnabledrelayprovider: true,
};

type PostResponse = {
	data: {
		xdt_api__v1__media__shortcode__web_info: {
			items: Array<InstagramMediaItem>
		} | null
	} | null
	errors?: Array<{ message: string }>
};

// FETCH \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export async function fetchApi<T>(path: `/api/v1/${string}` | `/graphql/${string}`, body?: URLSearchParams, extraHeaders?: Record<string, string>): Promise<T> {
	const headers: Record<string, string> = {
		'x-csrftoken': document.cookie.match(/csrftoken=([^;]+)/)?.[ 1 ] ?? '',
		'x-ig-app-id': INSTAGRAM_WEB_APP_ID,
		'x-requested-with': 'XMLHttpRequest',
		...extraHeaders,
	};
	if (body) {
		headers[ 'content-type' ] = 'application/x-www-form-urlencoded';
	}

	const response = await fetch(INSTAGRAM_ORIGIN + path, {
		body,
		credentials: 'include',
		headers,
		method: body ? 'POST' : 'GET',
	});
	if (!response.ok) {
		throw new Error(`Instagram fetch ${path}: HTTP ${response.status}`);
	}

	return response.json() as Promise<T>;
}

// The REST endpoint /api/v1/media/{id}/info/ sometimes only returns the 1080px
// candidates. The web app's own GraphQL query consistently returns the full
// resolution, so we use that one.
export async function fetchPost(shortcode: string): Promise<MediaItem> {
	const { docId, fbDtsg, variables } = findPostQueryParams();
	if (!fbDtsg) {
		throw new Error('Could not find fb_dtsg in page');
	}

	const body = new URLSearchParams({
		doc_id: docId ?? DEFAULT_POST_DOC_ID,
		fb_dtsg: fbDtsg,
		variables: JSON.stringify({ ...(variables ?? DEFAULT_POST_VARIABLES), shortcode }),
		server_timestamps: 'true',
	});

	const data = await fetchApi<PostResponse>('/graphql/query', body, { 'x-fb-friendly-name': POST_QUERY_NAME });
	const item = data.data?.xdt_api__v1__media__shortcode__web_info?.items.at(0);
	if (!item) {
		throw new Error(`Post query: ${data.errors?.[ 0 ]?.message ?? `no post found for ${shortcode}`}`);
	}

	return makeMediaItem(item);
}

// HELPERS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

// doc_id and the relay variables are only in the page when it was loaded as a
// post page; after SPA navigation the defaults are used.
function findPostQueryParams() {
	let docId: string | undefined;
	let fbDtsg: string | undefined;
	let variables: Record<string, unknown> | undefined;

	for (const script of document.querySelectorAll('script[type="application/json"]')) {
		const text = script.textContent;
		fbDtsg ??= matchFbDtsg(text);

		const query = text.match(/"queryID":"(\d+)","variables":(\{[^}]*\}),"queryName":"PolarisPostRootQuery"/);
		if (query && !docId) {
			docId = query[ 1 ];
			variables = JSON.parse(query[ 2 ] ?? '{}') as Record<string, unknown>;
		}

		if (docId && fbDtsg) {
			break;
		}
	}

	return { docId, fbDtsg, variables };
}

export function findFbDtsg() {
	for (const script of document.querySelectorAll('script[type="application/json"]')) {
		const fbDtsg = matchFbDtsg(script.textContent);
		if (fbDtsg) {
			return fbDtsg;
		}
	}
}

function matchFbDtsg(text: string) {
	return text.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/)?.[ 1 ];
}
