import { App, TFile, TFolder } from "obsidian";
import { getTagCounts } from "./tag-cache";
import { FilterType, Suggestion } from "./types";

export function getSuggestions(
	app: App,
	type: FilterType,
	query: string,
	limit = 30,
): Suggestion[] {
	const q = query.toLowerCase();

	switch (type) {
		case "tag":
			return suggestTags(app, q, limit);
		case "path":
			return suggestPaths(app, q, limit);
		case "file":
			return suggestFiles(app, q, limit);
	}
}

function suggestTags(app: App, q: string, limit: number): Suggestion[] {
	const counts = getTagCounts(app);
	const qNoHash = q.startsWith("#") ? q.slice(1) : q;

	return Array.from(counts.entries())
		.filter(([tag]) => tag.slice(1).toLowerCase().includes(qNoHash))
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([tag, count]) => ({ value: tag, detail: String(count) }));
}

function suggestPaths(app: App, q: string, limit: number): Suggestion[] {
	const folders: TFolder[] = [];
	const collect = (folder: TFolder) => {
		// Skip the vault root (path is "").
		if (folder.path) folders.push(folder);
		for (const child of folder.children) {
			if (child instanceof TFolder) collect(child);
		}
	};
	collect(app.vault.getRoot());

	return folders
		.filter((f) => f.path.toLowerCase().includes(q))
		.sort((a, b) => a.path.localeCompare(b.path))
		.slice(0, limit)
		.map((f) => ({ value: f.path }));
}

function suggestFiles(app: App, q: string, limit: number): Suggestion[] {
	// `file:` in Obsidian search matches any file in the vault (markdown, canvas,
	// images, PDFs, etc.) by filename. Use `getFiles()` and the full name (with
	// extension) so the inserted value is unambiguous — `meu.canvas` won't be
	// collapsed to `meu` and accidentally also match `meu.md`.
	const files: TFile[] = app.vault.getFiles();
	return files
		.filter((f) => f.name.toLowerCase().includes(q))
		.sort((a, b) => a.name.localeCompare(b.name))
		.slice(0, limit)
		.map((f) => ({ value: f.name, detail: f.parent?.path ?? "" }));
}

export class AutocompletePopup {
	private el: HTMLElement;
	private input: HTMLInputElement;
	private suggestions: Suggestion[] = [];
	private selectedIdx = 0;
	private onAccept: (s: Suggestion) => void;

	constructor(input: HTMLInputElement, onAccept: (s: Suggestion) => void) {
		this.input = input;
		this.onAccept = onAccept;

		this.el = document.createElement("div");
		this.el.addClass("gfb-autocomplete");
		document.body.appendChild(this.el);
	}

	show(suggestions: Suggestion[]) {
		if (suggestions.length === 0) {
			this.hide();
			return;
		}
		this.suggestions = suggestions;
		this.selectedIdx = 0;
		this.render();
		this.position();
		this.el.addClass("is-visible");
	}

	hide() {
		this.el.removeClass("is-visible");
		this.suggestions = [];
	}

	isVisible(): boolean {
		return this.el.hasClass("is-visible");
	}

	moveDown() {
		if (this.suggestions.length === 0) return;
		this.selectedIdx = (this.selectedIdx + 1) % this.suggestions.length;
		this.render();
	}

	moveUp() {
		if (this.suggestions.length === 0) return;
		this.selectedIdx =
			(this.selectedIdx - 1 + this.suggestions.length) %
			this.suggestions.length;
		this.render();
	}

	acceptSelected(): Suggestion | null {
		const s = this.suggestions[this.selectedIdx];
		if (s) {
			this.onAccept(s);
			this.hide();
			return s;
		}
		return null;
	}

	destroy() {
		this.el.remove();
	}

	private render() {
		this.el.empty();
		this.suggestions.forEach((s, idx) => {
			const item = this.el.createDiv("gfb-ac-item");
			if (idx === this.selectedIdx) item.addClass("is-selected");

			item.createSpan({ text: s.value, cls: "gfb-ac-value" });
			if (s.detail) {
				item.createSpan({ text: s.detail, cls: "gfb-ac-detail" });
			}

			item.addEventListener("mousedown", (e) => {
				e.preventDefault();
				this.selectedIdx = idx;
				this.acceptSelected();
			});
		});
	}

	private position() {
		const rect = this.input.getBoundingClientRect();
		// If the input has been detached or hidden (zero-sized rect), don't
		// position — would land at (0,0). Hide instead.
		if (rect.width === 0 && rect.height === 0) {
			this.hide();
			return;
		}
		this.el.style.left = `${rect.left}px`;
		this.el.style.top = `${rect.bottom + 2}px`;
		this.el.style.width = `${Math.max(rect.width, 200)}px`;
	}
}
