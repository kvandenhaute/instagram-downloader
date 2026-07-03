const DEBUG = true;

export function logDebug(...data: Array<unknown>) {
	DEBUG && console.debug('[ig-dl]', ...data);
}

export function logError(...data: Array<unknown>) {
	console.error('[ig-dl]', ...data);
}
