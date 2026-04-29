import { Plugin, WorkspaceLeaf } from 'obsidian';
import { FilterBuilderSection } from './builder-section';
import { findGraphLeaves, findGraphViewContent } from './graph-utils';
import { clearTagCache, initTagCache } from './tag-cache';
import { DEFAULT_SETTINGS, Settings } from './types';

export default class GraphFilterBuilderPlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };
  private sections = new Map<WorkspaceLeaf, FilterBuilderSection>();

  async onload() {
    await this.loadSettings();

    this.registerEvent(initTagCache(this.app));

    this.registerEvent(
      this.app.workspace.on('layout-change', () => this.syncSections()),
    );

    this.app.workspace.onLayoutReady(() => this.syncSections());
  }

  onunload() {
    for (const section of this.sections.values()) {
      section.destroy();
    }
    this.sections.clear();
    clearTagCache();
  }

  async loadSettings() {
    const data = (await this.loadData()) as Partial<Settings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private syncSections() {
    const currentLeaves = new Set(findGraphLeaves(this.app));

    for (const [leaf, section] of this.sections) {
      if (!currentLeaves.has(leaf)) {
        section.destroy();
        this.sections.delete(leaf);
      }
    }

    for (const leaf of currentLeaves) {
      if (this.sections.has(leaf)) continue;
      this.tryMountSection(leaf);
    }
  }

  private tryMountSection(leaf: WorkspaceLeaf, attempt = 0) {
    const container = findGraphViewContent(leaf);
    if (!container) {
      if (attempt < 10) {
        setTimeout(() => this.tryMountSection(leaf, attempt + 1), 100);
      }
      return;
    }
    if (this.sections.has(leaf)) return;

    const section = new FilterBuilderSection(
      this.app,
      leaf,
      this.settings,
      () => this.saveSettings(),
    );
    section.mount(container);
    this.sections.set(leaf, section);
  }
}
