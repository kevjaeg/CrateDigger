import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  avatarUrl: string | null;
  accessToken: string | null;
  accessTokenSecret: string | null;
  setAuth: (data: {
    username: string;
    avatarUrl: string | null;
    accessToken: string;
    accessTokenSecret: string;
  }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  username: null,
  avatarUrl: null,
  accessToken: null,
  accessTokenSecret: null,
  setAuth: (data) =>
    set({
      isAuthenticated: true,
      username: data.username,
      avatarUrl: data.avatarUrl,
      accessToken: data.accessToken,
      accessTokenSecret: data.accessTokenSecret,
    }),
  clearAuth: () =>
    set({
      isAuthenticated: false,
      username: null,
      avatarUrl: null,
      accessToken: null,
      accessTokenSecret: null,
    }),
}));
