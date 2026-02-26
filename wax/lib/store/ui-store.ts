import { create } from 'zustand';

type ViewMode = 'grid' | 'list';
type ColorScheme = 'dark' | 'light' | 'system';
type SortBy = 'dateAdded' | 'title' | 'artist' | 'year';

interface UIState {
  viewMode: ViewMode;
  colorScheme: ColorScheme;
  sortBy: SortBy;
  setViewMode: (mode: ViewMode) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setSortBy: (sort: SortBy) => void;
}

export type { SortBy, ColorScheme };

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'grid',
  colorScheme: 'dark',
  sortBy: 'dateAdded',
  setViewMode: (mode) => set({ viewMode: mode }),
  setColorScheme: (scheme) => set({ colorScheme: scheme }),
  setSortBy: (sort) => set({ sortBy: sort }),
}));
