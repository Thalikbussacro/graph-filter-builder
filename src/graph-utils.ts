import { App, WorkspaceLeaf } from "obsidian";

export function findGraphLeaves(app: App): WorkspaceLeaf[] {
	return app.workspace.getLeavesOfType("graph");
}

export function findFilterInput(leaf: WorkspaceLeaf): HTMLInputElement | null {
	const containerEl = leaf.view.containerEl;

	const selectors = [
		'.graph-controls .mod-filter input[type="search"]',
		'.graph-controls .graph-control-section.mod-filter input[type="search"]',
		'.graph-controls input[type="search"]',
	];

	for (const sel of selectors) {
		const el = containerEl.querySelector<HTMLInputElement>(sel);
		if (el) return el;
	}
	return null;
}

/**
 * Returns the .view-content of the graph leaf — the same container that hosts
 * the native .graph-controls. We mount our floating panel there as a sibling.
 */
export function findGraphViewContent(leaf: WorkspaceLeaf): HTMLElement | null {
	return leaf.view.containerEl.querySelector<HTMLElement>(".view-content");
}

export function setNativeInputValue(
	input: HTMLInputElement,
	value: string,
): void {
	// Skip if nothing actually changes — avoids dispatching an event that would
	// open the native popup unnecessarily.
	if (input.value === value) return;

	const desc = Object.getOwnPropertyDescriptor(
		HTMLInputElement.prototype,
		"value",
	);

	if (desc?.set) {
		desc.set.call(input, value);
	} else {
		input.value = value;
	}
	input.dispatchEvent(new Event("input", { bubbles: true }));

	// The native filter creates a `.suggestion-container.mod-search-suggestion`
	// popup with internal timing that varies (sync, microtask, or a few frames
	// later). Poll at frame rate for half a second to hide it whenever it shows.
	hideSearchSuggestionsForAWhile();
}

function hideSearchSuggestionsForAWhile() {
	const hideAll = () => {
		document
			.querySelectorAll<HTMLElement>(
				".suggestion-container.mod-search-suggestion",
			)
			.forEach(hideEl);
	};
	hideAll(); // synchronous case
	const interval = window.setInterval(hideAll, 16);
	setTimeout(() => clearInterval(interval), 500);
}

function hideEl(el: HTMLElement) {
	// CSS class with !important resists Obsidian re-applying inline styles.
	el.addClass("gfb-hidden");
}
