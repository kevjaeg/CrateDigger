import { useColorScheme } from 'react-native';
import { useUIStore } from './store/ui-store';

export interface ThemeColors {
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string;
  accentMuted: string;
  skeleton: string;
  danger: string;
}

const dark: ThemeColors = {
  bg: '#0a0a0a',
  card: '#141414',
  cardAlt: '#1a1a1a',
  text: '#ffffff',
  textSecondary: '#a0a0a0',
  textMuted: '#6b6b6b',
  border: '#2a2a2a',
  accent: '#c4882a',
  accentMuted: 'rgba(196,136,42,0.2)',
  skeleton: '#1a1a1a',
  danger: '#ef4444',
};

const light: ThemeColors = {
  bg: '#f5f5f5',
  card: '#ffffff',
  cardAlt: '#f0f0f0',
  text: '#1a1a1a',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#e0e0e0',
  accent: '#c4882a',
  accentMuted: 'rgba(196,136,42,0.15)',
  skeleton: '#e8e8e8',
  danger: '#dc2626',
};

export function useColors(): ThemeColors {
  const scheme = useUIStore((s) => s.colorScheme);
  const systemScheme = useColorScheme();

  if (scheme === 'system') {
    return systemScheme === 'light' ? light : dark;
  }
  return scheme === 'light' ? light : dark;
}

export function useIsDark(): boolean {
  const scheme = useUIStore((s) => s.colorScheme);
  const systemScheme = useColorScheme();

  if (scheme === 'system') return systemScheme !== 'light';
  return scheme !== 'light';
}
