import type { Result } from '../../lib/types';

import { logDebug } from '../../lib/logger';

export function getDatetime(takenAt: number) {
	return new Date(takenAt).toISOString();
}

export async function sendMessage<T>(message: Record<string, unknown>): Promise<Result<T>> {
	logDebug('sendMessage', message);

	const result = await chrome.runtime.sendMessage<Record<string, unknown>, Result<T>>(message);
	if (!result.success) {
		return { success: false, error: new Error((result.error as { message?: string }).message) };
	}

	return result;
}
