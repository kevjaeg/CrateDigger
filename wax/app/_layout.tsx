import '../global.css';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { View, ActivityIndicator } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth-store';
import { loadStoredAuth, NetworkError } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import Toast from '@/components/toast';
import OfflineBanner from '@/components/offline-banner';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 6 * 60 * 60 * 1000, // 6 hours (ToS compliance)
      retry: 2,
    },
  },
});

// Force dark theme for navigation chrome
const WaxDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0a0a0a',
    card: '#0a0a0a',
    border: '#2a2a2a',
    primary: '#c4882a',
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={WaxDarkTheme}>
        <RootLayoutNav />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RootLayoutNav() {
  const [isReady, setIsReady] = useState(false);
  const { isAuthenticated, setAuth } = useAuthStore();

  useEffect(() => {
    async function restoreAuth() {
      try {
        const stored = await loadStoredAuth();
        if (stored) {
          const profile = await api.getProfile(stored.username);
          setAuth({
            username: stored.username,
            avatarUrl: profile.avatar_url,
            accessToken: stored.accessToken,
            accessTokenSecret: stored.accessTokenSecret,
          });
        }
      } catch (e) {
        // Network error — still show login (cached data unavailable without auth)
        // Auth errors — show login
        if (e instanceof NetworkError) {
          console.log('[Auth] Offline during restore — showing login');
        }
      } finally {
        setIsReady(true);
      }
    }
    restoreAuth();
  }, []);

  if (!isReady) {
    return (
      <View className="flex-1 bg-[#0a0a0a] items-center justify-center">
        <ActivityIndicator color="#c4882a" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="release/[id]"
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: '#0a0a0a' },
                headerTintColor: '#f5f5f5',
                headerTitle: '',
                presentation: 'card',
              }}
            />
          </>
        ) : (
          <Stack.Screen name="login" />
        )}
      </Stack>
      <Toast />
    </View>
  );
}
