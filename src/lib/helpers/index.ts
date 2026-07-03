import type { MediaElement } from '../types';

export function isValidMedia(media: MediaElement) {
	if (media instanceof HTMLImageElement && media.alt.endsWith('profile picture')) {
		return false;
	}

	if (media.offsetWidth < 300 || media.offsetHeight < 300) {
		return false;
	}

	const anchorAncestor = media.closest('a');
	if (anchorAncestor) {
		const pathname = new URL(anchorAncestor.href).pathname;

		return !(/^\/[^/]+\/?$/).test(pathname);
	}

	return true;
}
