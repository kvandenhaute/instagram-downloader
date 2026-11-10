export type Message = DownloadMessage
  | DownloadMergedMessage;

export type DownloadMessage = {
	type: 'download'
	url: string
	filename: string
};

export type DownloadMergedMessage = {
	type: 'download_merged'
	audioUrl: string
	filename: string
	videoUrl: string
};

export type OffscreenMessage = {
	target: 'offscreen'
	type: 'mux'
	audioUrl: string
	videoUrl: string
} | {
	target: 'offscreen'
	type: 'revoke'
	url: string
};

export type MuxResponse = { success: true, url: string } | { success: false, error: string };
