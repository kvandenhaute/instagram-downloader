import type { GetWebProfileInfoMessageResponse } from '../messages';

import { INSTAGRAM_ORIGIN } from '../lib/constants';

const BTN_STACK_CLASS_NAME = 'ig-dl-btn-stack';

// PROFILE INFO \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

const webProfileInfoMap: Map<string, GetWebProfileInfoMessageResponse> = new Map();

// Instagram's /api/v1/users/web_profile_info/ endpoint is broken server-side, so
// we scrape the numeric user id straight from the profile page HTML instead. The
// content script shares the page origin and cookies, so a same-origin fetch works
// without any of the intercepted auth headers.
export async function getWebProfileInfo(username: string) {
	const cached = webProfileInfoMap.get(username);
	if (cached) {
		return cached;
	}

	const response = await fetch(`${INSTAGRAM_ORIGIN}/${encodeURIComponent(username)}/`, {
		credentials: 'include',
	});
	if (!response.ok) {
		throw new Error(`Profile page fetch for ${username} failed: ${response.status}`);
	}

	const html = await response.text();
	const match = html.match(/"profilePage_(\d+)"/) ?? html.match(/"profile_id":"(\d+)"/);
	if (!match) {
		throw new Error(`Could not find user id for ${username}`);
	}

	const webProfileInfo = { userId: Number(match[ 1 ]) } satisfies GetWebProfileInfoMessageResponse;
	webProfileInfoMap.set(username, webProfileInfo);

	return webProfileInfo;
}

// BUTTONS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export function createDownloadButtonStack() {
	const header = document.querySelector<HTMLElement>('section main div:has(> header)');
	if (!header) {
		return;
	}

	let stack = header.querySelector<HTMLElement>(`:scope > .${BTN_STACK_CLASS_NAME}`);
	if (stack) {
		return;
	}

	stack = document.createElement('div');
	stack.classList.add(BTN_STACK_CLASS_NAME);

	header.appendChild(stack);

	return stack;
}
