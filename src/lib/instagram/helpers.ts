import type { InstagramMediaVersion } from './types';

export function findBestCandidate(candidates: Array<InstagramMediaVersion>) {
	return [ ...candidates ].sort((a, b) => b.width - a.width)[ 0 ];
}
