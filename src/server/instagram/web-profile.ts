import { makeSuccessResult } from '../lib/helpers';
import { fetchApi } from './api';

type InstagramWebProfileInfoResponse = {
	data: {
		user: {
			id: number
		}
	}
};

type InstagramWebProfileInfoResult = {
	userId: number
};

export async function fetchInstagramWebProfileInfo(username: string) {
	const fetchResult = await fetchApi<InstagramWebProfileInfoResponse>(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`);
	if (!fetchResult.success) {
		return fetchResult;
	}

	return makeSuccessResult({
		userId: fetchResult.data.data.user.id,
	} satisfies InstagramWebProfileInfoResult);
}
