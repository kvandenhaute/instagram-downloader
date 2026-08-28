import type { Result } from '../../lib/types';
import type { StoredHeaders } from '../lib/types';

import { INSTAGRAM_ORIGIN } from '../../lib/constants';
import { makeErrorResult, makeSuccessResult } from '../lib/helpers';

export { INSTAGRAM_ORIGIN };

export const AUTH_HEADER_NAMES = [ 'x-ig-app-id', 'x-ig-www-claim', 'x-asbd-id', 'x-instagram-ajax' ];

export async function fetchApi<T>(path: `/api/v1/${string}` | `/graphql/${string}`, body?: string): Promise<Result<T>> {
	const headers = await getAuthHeaders();
	if (body) {
		headers[ 'content-type' ] = 'application/x-www-form-urlencoded';
	}

	try {
		const response = await fetch(INSTAGRAM_ORIGIN + path, {
			headers,
			credentials: 'include',
			method: body ? 'POST' : 'GET',
			body,
		});
		if (!response.ok) {
			return makeErrorResult(response.statusText);
		}

		const data = await response.json() as T;

		return makeSuccessResult(data);
	} catch (err) {
		return makeErrorResult(err, 'Instagram fetch: ');
	}
}

export async function getAuthHeaders() {
	const [ storage, cookie ] = await Promise.all([
		chrome.storage.local.get('igHeaders'),
		chrome.cookies.get({
			url: INSTAGRAM_ORIGIN,
			name: 'csrftoken',
		}),
	]);
	const headers: Record<string, string> = {
		'x-requested-with': 'XMLHttpRequest',
		...((storage[ 'igHeaders' ] as StoredHeaders | undefined) ?? {}),
	};

	if (cookie?.value) {
		headers[ 'x-csrftoken' ] = cookie.value;
	}

	return headers;
}
