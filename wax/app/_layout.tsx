import '../global.css';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { View, ActivityIndicator } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth-store';
import { loadStoredAuth, NetworkError } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { useColors, useIsDark } from '@/lib/theme';
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
      staleTime: 5 * 60 * 1000,
      gcTime: 6 * 60 * 60 * 1000,
      retry: 2,
    },
  },
});

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
      <RootLayoutNav />
    </QueryClientProvider>
  );
}

function RootLayoutNav() {
  const [isReady, setIsReady] = useState(false);
  const { isAuthenticated, setAuth } = useAuthStore();
  const isDark = useIsDark();
  const c = useColors();

  const navTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: c.bg,
          card: c.bg,
          border: c.border,
          primary: c.accent,
          text: c.text,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: c.bg,
          card: c.bg,
          border: c.border,
          primary: c.accent,
          text: c.text,
        },
      };

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
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.accent} size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={navTheme}>
      <View style={{ flex: 1 }}>
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
          <Stack.Screen
            name="release/[id]"
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: c.bg },
              headerTintColor: c.text,
              headerTitle: '',
              presentation: 'card',
            }}
          />
          <Stack.Screen name="+not-found" />
        </Stack>
        {!isAuthenticated && isReady && <Redirect href="/login" />}
        <Toast />
      </View>
    </ThemeProvider>
  );
}
