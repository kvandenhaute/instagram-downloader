import { sendMessage } from './utils';

type WebProfileInfoResponse = {
	userId: number
};
const webProfileInfoMap: Map<string, WebProfileInfoResponse> = new Map();

export async function getWebProfileInfo(username: string) {
	const webProfileInfo = webProfileInfoMap.get(username);
	if (webProfileInfo) {
		return webProfileInfo;
	}

	const sendMessageResult = await sendMessage<WebProfileInfoResponse>({ type: 'get_web_profile_info', username });
	if (!sendMessageResult.success) {
		throw sendMessageResult.error;
	}

	webProfileInfoMap.set(username, sendMessageResult.data);

	return sendMessageResult.data;
}
