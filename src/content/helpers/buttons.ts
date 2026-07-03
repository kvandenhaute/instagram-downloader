import type { PageType } from '../../lib/types';

export const BTN_CLASS_NAME = 'ig-dl-btn';

type DOWNLOAD_BUTTON_OPTIONS = {
	className?: string | Array<string>
	text?: string
};

export function makeDownloadButton(pageType: PageType, options: DOWNLOAD_BUTTON_OPTIONS = {}) {
	const button = document.createElement('button');
	button.classList.add(
		BTN_CLASS_NAME,
		`${BTN_CLASS_NAME}--${pageType}`,
	);

	if (Array.isArray(options.className)) {
		button.classList.add(...options.className.map(className => `${BTN_CLASS_NAME}--${className}`));
	} else if (typeof options.className === 'string') {
		button.classList.add(`${BTN_CLASS_NAME}--${options.className}`);
	}

	button.appendChild(makeDownloadIcon());

	if (options.text) {
		const span = document.createElement('span');
		span.textContent = options.text;
		button.appendChild(span);
	}

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
