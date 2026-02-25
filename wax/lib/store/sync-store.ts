import { create } from 'zustand';

type SyncStatus = 'idle' | 'syncing' | 'error' | 'complete';

interface SyncState {
  status: SyncStatus;
  progress: number;
  totalItems: number;
  syncedItems: number;
  lastSyncAt: string | null;
  error: string | null;
  setProgress: (synced: number, total: number) => void;
  setSyncing: () => void;
  setComplete: () => void;
  setError: (error: string) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  progress: 0,
  totalItems: 0,
  syncedItems: 0,
  lastSyncAt: null,
  error: null,
  setProgress: (synced, total) =>
    set({
      syncedItems: synced,
      totalItems: total,
      progress: total > 0 ? synced / total : 0,
    }),
  setSyncing: () => set({ status: 'syncing', error: null }),
  setComplete: () =>
    set({
      status: 'complete',
      progress: 1,
      lastSyncAt: new Date().toISOString(),
    }),
  setError: (error) => set({ status: 'error', error }),
}));
