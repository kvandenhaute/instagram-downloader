import type { PageType } from './types';

export const BTN_CLASS_NAME = 'ig-dl-btn';

export function makeDownloadButton(...pageTypes: [PageType, ...PageType[]]) {
	const button = document.createElement('button');
	button.classList.add(BTN_CLASS_NAME, ...pageTypes.map(pageType => `${BTN_CLASS_NAME}--${pageType}`));
	button.appendChild(makeDownloadIcon());

	return button;
}

function makeDownloadIcon(): SVGSVGElement {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('width', '24');
	svg.setAttribute('height', '24');
	svg.innerHTML = '<path d="M19.5 17V19.5H5.5V17M17.5 11L12.5 16L7.5 11M12.5 16V4.99998" stroke="#fff" stroke-width="1.2"/>';

	return svg;
}
