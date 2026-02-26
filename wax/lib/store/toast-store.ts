import { create } from 'zustand';

export type ToastType = 'error' | 'success' | 'info';

interface ToastState {
  message: string | null;
  type: ToastType;
  visible: boolean;
  show: (message: string, type?: ToastType) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => {
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    message: null,
    type: 'info',
    visible: false,
    show: (message, type = 'error') => {
      if (hideTimer) clearTimeout(hideTimer);
      set({ message, type, visible: true });
      hideTimer = setTimeout(() => {
        set({ visible: false });
        hideTimer = null;
      }, 3000);
    },
    hide: () => {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = null;
      set({ visible: false });
    },
  };
});

/** Convenience function — call from anywhere without hooks */
export function showToast(message: string, type: ToastType = 'error') {
  useToastStore.getState().show(message, type);
}
