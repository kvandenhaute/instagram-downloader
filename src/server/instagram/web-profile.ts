import type { GetWebProfileInfoMessageResponse } from '../../messages';

import { makeSuccessResult } from '../lib/helpers';
import { fetchApi } from './api';

type WebProfileInfoResponse = {
	data: {
		user: {
			id: number
		}
	}
};

export async function fetchWebProfileInfo(username: string) {
	const fetchResult = await fetchApi<WebProfileInfoResponse>(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`);
	if (!fetchResult.success) {
		return fetchResult;
	}

	return makeSuccessResult({
		userId: fetchResult.data.data.user.id,
	} satisfies GetWebProfileInfoMessageResponse);
}
