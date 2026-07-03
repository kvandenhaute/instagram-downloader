import type { FailureResult, SuccessResult } from '../../lib/types';

export function makeErrorResult(err: unknown, prefix?: `${string}: `): FailureResult {
	return { success: false, error: getError(err, prefix) };
}

export function makeSuccessResult<T>(data: T): SuccessResult<typeof data> {
	return { success: true, data };
}

function getError(err: unknown, prefix?: `${string}: `) {
	if (err instanceof Error) {
		if (prefix) {
			return new Error(prefix + err.message, { cause: err });
		}

		return err;
	} else if (typeof err === 'string') {
		return new Error(prefix ? prefix + err : err);
	}

	return new Error(prefix ? prefix + 'Something unexpected occurred.' : 'Something unexpected occurred.');
}
