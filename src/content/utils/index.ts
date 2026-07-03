import type { Result } from '../../lib/types';

import { logDebug } from '../../lib/logger';

export function getDatetime(takenAt: number) {
	return new Date(takenAt).toISOString();
}

export function sendMessage<T>(message: Record<string, unknown>): Promise<Result<T>> {
	logDebug('sendMessage', message);

	return chrome.runtime.sendMessage(message);
}
