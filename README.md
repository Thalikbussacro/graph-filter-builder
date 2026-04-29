# Graph Filter Builder

A Filter Builder panel for Obsidian's graph view.

Build graph filters as structured Include/Exclude lines with type selection (tag, path, file) and autocomplete. Lines are combined with AND and written into the native filter input — so native bookmarks save them normally.

## Why

The native graph filter is a single text input. Long expressions are hard to read and edit, and remembering the syntax (`path:`, `tag:`, `-tag:`, etc.) is friction. This plugin gives you a structured panel where each clause is its own line.

It does **not** replace the native filter — it generates the filter string and writes it into the existing input.

## Usage

1. Open the global graph view.
2. A filter icon appears at the top-left of the graph.
3. Click to expand the Filter Builder panel.
4. Each line: `[Include/Exclude]` `[type]` `[value]` `[trash]`
5. Pick a type (tag, path, file). The value field becomes editable, with autocomplete for that type.
6. Toggle Include/Exclude per line.
7. The native filter input updates live as you edit. Save bookmarks normally from Obsidian.

### Reset

The reload icon in the panel header clears all lines.

## Limitations

- **Global graph only** — local graphs are not targeted.
- **No reverse parsing** — opening the panel doesn't reconstruct lines from a filter that was typed manually into the native input. The panel always starts from a clean state.
- **Mobile not officially supported** — the plugin relies on internal DOM structure of the graph view that may differ on mobile.
- **Internal API usage** — the plugin queries internal DOM (`.graph-controls`, `.suggestion-container`) that aren't part of Obsidian's public API. A future Obsidian update could break it. Issues welcome.

## Installation

### Via BRAT (beta)

1. Install the BRAT plugin in Obsidian.
2. Add `Thalikbussacro/graph-filter-builder` as a beta plugin.
3. Enable it.

### Manual

1. Download `main.js`, `manifest.json`, `styles.css` from the latest [release](https://github.com/Thalikbussacro/graph-filter-builder/releases).
2. Copy them into `<vault>/.obsidian/plugins/graph-filter-builder/`.
3. Enable the plugin in Settings → Community plugins.

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
```

Build output goes to the project root: `main.js`. Copy that, plus `manifest.json` and `styles.css`, into your test vault under `.obsidian/plugins/graph-filter-builder/`.

## License

MIT — see [LICENSE](LICENSE).
