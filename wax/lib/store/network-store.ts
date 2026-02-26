import { create } from 'zustand';

interface NetworkState {
  isOffline: boolean;
  setOffline: (offline: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOffline: false,
  setOffline: (offline) => set({ isOffline: offline }),
}));

/** Called from API client on fetch success */
export function markOnline() {
  const { isOffline } = useNetworkStore.getState();
  if (isOffline) useNetworkStore.getState().setOffline(false);
}

/** Called from API client on network error */
export function markOffline() {
  useNetworkStore.getState().setOffline(true);
}
