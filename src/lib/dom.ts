export function findFirstRelativeAncestor(from: HTMLElement, root: HTMLElement) {
	let current = from.parentElement;
	while (current) {
		if (getComputedStyle(current).position === 'relative') {
			return current;
		} else if (current === root) {
			return current;
		}

		current = current.parentElement;
	}

	return null;
}

export function findFirstRelativeDescendant(root: HTMLElement) {
	for (const el of root.querySelectorAll<HTMLElement>('*')) {
		if (getComputedStyle(el).position === 'relative') {
			return el;
		}
	}

	return null;
}

export function queryFirst<T extends Element>(root: ParentNode, ...selectors: [string, ...string[]]): T | null {
	for (const selector of selectors) {
		const el = root.querySelector<T>(selector);
		if (el) {
			return el;
		}
	}

	return null;
}
