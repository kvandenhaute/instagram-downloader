export type FailureResult = { success: false, error: Error };
export type SuccessResult<Data = unknown> = { success: true, data: Data };
export type Result<Data = unknown> = SuccessResult<Data> | FailureResult;
