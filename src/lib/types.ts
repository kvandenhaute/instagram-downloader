export type MediaElement = HTMLImageElement | HTMLVideoElement;
export type PageType = 'highlights' | 'home-feed' | 'post' | 'profile' | 'reels' | 'reel' | 'stories';
export type Url = `https://${string}`;

export type FailureResult = { success: false, error: Error };
export type SuccessResult<Data = unknown> = { success: true, data: Data };
export type Result<Data = unknown> = SuccessResult<Data> | FailureResult;
