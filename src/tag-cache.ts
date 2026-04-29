import { App, EventRef } from "obsidian";

let cache: Map<string, number> | null = null;

export function getTagCounts(app: App): Map<string, number> {
	if (cache) return cache;
	cache = collectAllTags(app);
	return cache;
}

export function initTagCache(app: App): EventRef {
	return app.metadataCache.on("changed", () => {
		cache = null;
	});
}

export function clearTagCache(): void {
	cache = null;
}

function collectAllTags(app: App): Map<string, number> {
	const counts = new Map<string, number>();
	for (const file of app.vault.getMarkdownFiles()) {
		const fileCache = app.metadataCache.getFileCache(file);
		if (!fileCache) continue;

		if (fileCache.tags) {
			for (const t of fileCache.tags) {
				counts.set(t.tag, (counts.get(t.tag) ?? 0) + 1);
			}
		}

		const fmTags: unknown = fileCache.frontmatter?.tags;
		if (fmTags != null) {
			const arr: unknown[] = Array.isArray(fmTags) ? fmTags : [fmTags];
			for (const raw of arr) {
				if (typeof raw !== "string") continue;
				const tag = raw.startsWith("#") ? raw : "#" + raw;
				counts.set(tag, (counts.get(tag) ?? 0) + 1);
			}
		}
	}
	return counts;
}
