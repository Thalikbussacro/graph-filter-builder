import { App, setIcon, WorkspaceLeaf } from "obsidian";
import { AutocompletePopup, getSuggestions } from "./autocomplete";
import { findFilterInput, setNativeInputValue } from "./graph-utils";
import {
	FILTER_TYPES,
	FilterLine,
	FilterType,
	Settings,
	Suggestion,
} from "./types";

const APPLY_DEBOUNCE_MS = 150;

const newLine = (): FilterLine => ({ type: null, value: "", negated: false });

/**
 * Floating Filter Builder panel mounted at the top-left of a graph view.
 * Two states only:
 *   - collapsed: a small icon button
 *   - expanded:  full card with header (collapse arrow + title + reload) and body
 */
export class FilterBuilderSection {
	private app: App;
	private leaf: WorkspaceLeaf;
	private settings: Settings;
	private saveSettings: () => Promise<void>;

	private rootEl!: HTMLElement;
	private cardEl!: HTMLElement;
	private collapsedBtn!: HTMLButtonElement;
	private linesContainer!: HTMLElement;

	private lines: FilterLine[] = [newLine()];
	private dirty = false;

	private autocomplete: AutocompletePopup | null = null;
	private activeInput: HTMLInputElement | null = null;
	private activeLineIdx = -1;

	private applyTimer: number | null = null;

	constructor(
		app: App,
		leaf: WorkspaceLeaf,
		settings: Settings,
		saveSettings: () => Promise<void>,
	) {
		this.app = app;
		this.leaf = leaf;
		this.settings = settings;
		this.saveSettings = saveSettings;
	}

	// -------- public API --------

	mount(parent: HTMLElement) {
		this.rootEl = parent.createDiv("gfb-floating");

		this.buildExpandedCard();
		this.buildCollapsedButton();

		this.applyCollapseState();
	}

	destroy() {
		if (this.applyTimer != null) {
			clearTimeout(this.applyTimer);
			this.applyTimer = null;
		}
		this.autocomplete?.destroy();
		this.autocomplete = null;
		this.rootEl?.remove();
	}

	// -------- expanded card --------

	private buildExpandedCard() {
		this.cardEl = this.rootEl.createDiv("gfb-card");

		// Header
		const header = this.cardEl.createDiv("gfb-header");
		header.createSpan({ cls: "gfb-collapse-icon", text: "▾" });
		header.createSpan({ cls: "gfb-title", text: "Filter Builder" });

		const reloadBtn = header.createEl("button", { cls: "gfb-reload-btn" });
		setIcon(reloadBtn, "rotate-ccw");
		reloadBtn.setAttr("aria-label", "Reset all lines");
		reloadBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.resetLines();
		});

		header.addEventListener("click", () => this.toggleCollapsed());

		// Body
		const body = this.cardEl.createDiv("gfb-body");
		this.linesContainer = body.createDiv("gfb-lines");
		this.renderLines();

		const addBtn = body.createEl("button", {
			text: "Add line",
			cls: "gfb-add-btn",
		});
		addBtn.addEventListener("click", () => {
			this.lines.push(newLine());
			this.renderLines();
			// No apply needed — new line has no type/value, so it doesn't change the filter.
			this.focusLastSelect();
		});
	}

	// -------- collapsed icon button --------

	private buildCollapsedButton() {
		this.collapsedBtn = this.rootEl.createEl("button", {
			cls: "gfb-collapsed-btn",
		});
		setIcon(this.collapsedBtn, "filter");
		this.collapsedBtn.setAttr("aria-label", "Expand Filter Builder");
		this.collapsedBtn.addEventListener("click", () =>
			this.toggleCollapsed(),
		);
	}

	// -------- collapse state --------

	private toggleCollapsed() {
		this.settings.collapsed = !this.settings.collapsed;
		this.applyCollapseState();
		void this.saveSettings();
	}

	private applyCollapseState() {
		this.rootEl.toggleClass("is-collapsed", this.settings.collapsed);
	}

	private resetLines() {
		this.lines = [newLine()];
		this.renderLines();
		this.applyImmediately();
	}

	// -------- lines --------

	private renderLines() {
		// Closing here avoids leaving the popup positioned against an input that's
		// about to be removed from the DOM.
		this.autocomplete?.hide();
		this.linesContainer.empty();
		this.lines.forEach((line, idx) => this.renderLineRow(line, idx));
	}

	private renderLineRow(line: FilterLine, idx: number) {
		const row = this.linesContainer.createDiv("gfb-line-row");

		// Include / Exclude toggle
		const inclBtn = row.createEl("button", { cls: "gfb-incl-btn" });
		this.syncInclButton(inclBtn, line);
		inclBtn.addEventListener("click", () => {
			line.negated = !line.negated;
			this.syncInclButton(inclBtn, line);
			this.applyImmediately();
		});

		// Type select (with placeholder option)
		const select = row.createEl("select", { cls: "gfb-line-type" });
		const placeholderOpt = select.createEl("option", {
			text: "Type",
			value: "",
		});
		placeholderOpt.disabled = true;
		placeholderOpt.hidden = true;
		if (line.type === null) placeholderOpt.selected = true;
		for (const t of FILTER_TYPES) {
			const opt = select.createEl("option", { text: t, value: t });
			if (t === line.type) opt.selected = true;
		}

		// Value input
		const input = row.createEl("input", { cls: "gfb-line-value" });
		input.type = "text";
		input.value = line.value;
		input.disabled = line.type === null;
		input.placeholder = line.type ? placeholderFor(line.type) : "";

		select.addEventListener("change", () => {
			line.type = (select.value as FilterType) || null;
			input.disabled = line.type === null;
			input.placeholder = line.type ? placeholderFor(line.type) : "";
			if (line.type) input.focus();
			this.applyImmediately();
		});

		input.addEventListener("input", () => {
			line.value = input.value;
			this.maybeShowAutocomplete(input);
			this.scheduleApply();
		});
		input.addEventListener("focus", () => {
			this.activeInput = input;
			this.activeLineIdx = idx;
			this.maybeShowAutocomplete(input);
		});
		input.addEventListener("blur", () => {
			setTimeout(() => {
				if (document.activeElement !== input) this.autocomplete?.hide();
			}, 100);
		});
		input.addEventListener("keydown", (e) => this.onValueKeydown(e));

		// Remove (trash)
		const removeBtn = row.createEl("button", { cls: "gfb-remove-btn" });
		setIcon(removeBtn, "trash-2");
		removeBtn.setAttr("aria-label", "Remove line");
		removeBtn.addEventListener("click", () => {
			if (this.lines.length === 1) {
				this.lines[0] = newLine();
			} else {
				this.lines.splice(idx, 1);
			}
			this.renderLines();
			this.applyImmediately();
		});
	}

	private syncInclButton(btn: HTMLButtonElement, line: FilterLine) {
		btn.setText(line.negated ? "Exclude" : "Include");
		btn.setAttr(
			"aria-label",
			line.negated
				? "Excluding. Click to include."
				: "Including. Click to exclude.",
		);
	}

	private focusLastSelect() {
		const selects = this.linesContainer.querySelectorAll<HTMLSelectElement>(
			"select.gfb-line-type",
		);
		selects[selects.length - 1]?.focus();
	}

	// -------- autocomplete --------

	private ensureAutocomplete(input: HTMLInputElement) {
		this.autocomplete?.destroy();
		this.autocomplete = new AutocompletePopup(input, (s) =>
			this.acceptSuggestion(s),
		);
	}

	private maybeShowAutocomplete(input: HTMLInputElement) {
		const line = this.lines[this.activeLineIdx];
		if (!line || line.type === null) {
			this.autocomplete?.hide();
			return;
		}
		this.ensureAutocomplete(input);
		const sugg = getSuggestions(this.app, line.type, input.value);
		this.autocomplete!.show(sugg);
	}

	private acceptSuggestion(s: Suggestion) {
		if (!this.activeInput || this.activeLineIdx < 0) return;
		const line = this.lines[this.activeLineIdx];
		if (!line) return;

		line.value = s.value;
		this.activeInput.value = s.value;
		this.activeInput.focus();
		const len = s.value.length;
		this.activeInput.setSelectionRange(len, len);
		this.applyImmediately();
	}

	private onValueKeydown(e: KeyboardEvent) {
		const ac = this.autocomplete;
		if (!ac?.isVisible()) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			ac.moveDown();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			ac.moveUp();
		} else if (e.key === "Enter" || e.key === "Tab") {
			e.preventDefault();
			ac.acceptSelected();
		} else if (e.key === "Escape") {
			e.preventDefault();
			ac.hide();
		}
	}

	// -------- apply --------

	/** Use for typing in the value input — debounced. */
	private scheduleApply() {
		this.dirty = true;
		if (this.applyTimer != null) clearTimeout(this.applyTimer);
		this.applyTimer = window.setTimeout(() => {
			this.applyTimer = null;
			this.applyNow();
		}, APPLY_DEBOUNCE_MS);
	}

	/** Use for structural changes (add/remove line, change type, toggle, reset). */
	private applyImmediately() {
		if (this.applyTimer != null) {
			clearTimeout(this.applyTimer);
			this.applyTimer = null;
		}
		this.dirty = true;
		this.applyNow();
	}

	private applyNow() {
		if (!this.dirty) return;
		const input = findFilterInput(this.leaf);
		if (!input) return;

		const filterString = this.buildFilterString();
		setNativeInputValue(input, filterString);
	}

	private buildFilterString(): string {
		const parts = this.lines
			.filter((l) => l.type !== null && l.value.trim().length > 0)
			.map((l) => lineToString(l));

		if (parts.length === 0) return "";
		if (parts.length === 1) return parts[0]!;
		return parts.map((p) => `(${p})`).join(" AND ");
	}
}

function lineToString(line: FilterLine): string {
	const prefix = line.negated ? "-" : "";
	const value = line.value.trim();
	const quoted = /\s/.test(value) ? `"${value}"` : value;
	return `${prefix}${line.type!}:${quoted}`;
}

function placeholderFor(type: FilterType): string {
	switch (type) {
		case "tag":
			return "#tagname";
		case "path":
			return "Folder/Subfolder";
		case "file":
			return "filename";
	}
}
