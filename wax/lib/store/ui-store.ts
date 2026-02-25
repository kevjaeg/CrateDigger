import { create } from 'zustand';

type ViewMode = 'grid' | 'list';
type ColorScheme = 'dark' | 'light' | 'system';

interface UIState {
  viewMode: ViewMode;
  colorScheme: ColorScheme;
  setViewMode: (mode: ViewMode) => void;
  setColorScheme: (scheme: ColorScheme) => void;
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'grid',
  colorScheme: 'dark',
  setViewMode: (mode) => set({ viewMode: mode }),
  setColorScheme: (scheme) => set({ colorScheme: scheme }),
}));
