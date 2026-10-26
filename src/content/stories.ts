import { logDebug, logError } from '../lib/logger';
import { BTN_CLASS_NAME, makeDownloadButton } from './helpers/buttons';
import { getWebProfileInfo } from './profile';
import { downloadReel } from './reels';
import { fetchUserStories } from './reels-media';

// DOWNLOAD \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

async function downloadStory() {
	const username = findUsernameInUrl();
	if (!username) {
		return logError('No username found in url');
	}

	const match = window.location.href.match(/\/stories\/[^/]+\/(\d+)/);
	const storyId = match?.at(1);

	const webProfileInfo = await getWebProfileInfo(username);
	const reels = await fetchUserStories(webProfileInfo.userId);

	if (!storyId) {
		const firstReel = reels.reels.at(0);
		if (!firstReel) {
			return logError('No reels found');
		}

		return downloadReel(firstReel, username);
	}

	const reel = reels.reels_by_pk[ storyId.toString() ];
	if (!reel) {
		logDebug(reels);
		logError(`No reel found for story ${storyId}`);

		return;
	}

	return downloadReel(reel, username);
}

// BUTTONS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

export function addStoryDownloadButton(pageType: 'stories') {
	const root = document.querySelector('section:has([aria-label="Instagram"])');
	if (!root || root.querySelector(`:scope > .${BTN_CLASS_NAME}`)) {
		return;
	}

	const downloadButton = makeDownloadButton(pageType);
	downloadButton.addEventListener('click', evt => {
		evt.preventDefault();
		evt.stopPropagation();

		downloadButton.disabled = true;

		void downloadStory()
			.catch(logError)
			.finally(() => (downloadButton.disabled = false));
	});

	root.appendChild(downloadButton);
}

// HELPERS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

function findUsernameInUrl() {
	const match = window.location.href.match(/\/stories\/([^/]+)\//);
	if (match && match[ 1 ]) {
		return match[ 1 ];
	}
}
