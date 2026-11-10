export type Message = DownloadMessage;

export type DownloadMessage = {
	type: 'download'
	url: string
	filename: string
};
