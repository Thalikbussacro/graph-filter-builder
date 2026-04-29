export type FilterType = 'tag' | 'path' | 'file';

export interface FilterLine {
  /** null until the user picks a type. Lines with null type are ignored. */
  type: FilterType | null;
  value: string;
  negated: boolean;
}

export interface Settings {
  collapsed: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  collapsed: false,
};

export interface Suggestion {
  value: string;
  detail?: string;
}

export const FILTER_TYPES: FilterType[] = ['tag', 'path', 'file'];
