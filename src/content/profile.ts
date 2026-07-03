import type { GetWebProfileInfoMessage, GetWebProfileInfoMessageResponse } from '../messages';

import { sendMessage } from './utils';

const BTN_STACK_CLASS_NAME = 'ig-dl-btn-stack';

// MESSAGE \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

const webProfileInfoMap: Map<string, GetWebProfileInfoMessageResponse> = new Map();

export async function getWebProfileInfo(username: string) {
	const webProfileInfo = webProfileInfoMap.get(username);
	if (webProfileInfo) {
		return webProfileInfo;
	}

	const sendMessageResult = await sendMessage<GetWebProfileInfoMessageResponse>({
		type: 'get_web_profile_info',
		username,
	} satisfies GetWebProfileInfoMessage);
	if (!sendMessageResult.success) {
		throw sendMessageResult.error;
	}

	webProfileInfoMap.set(username, sendMessageResult.data);

	return sendMessageResult.data;
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
