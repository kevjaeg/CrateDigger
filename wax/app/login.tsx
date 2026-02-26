import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useAuthStore } from '@/lib/store/auth-store';
import {
  getRequestToken,
  getAccessToken,
  saveTokens,
  type OAuthRequestToken,
} from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';

// Works in both Expo Go (exp://...) and standalone builds (wax://...)
const CALLBACK_URL = Linking.createURL('oauth');

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const pendingToken = useRef<OAuthRequestToken | null>(null);

  // Listen for the OAuth callback deep link
  useEffect(() => {
    const sub = Linking.addEventListener('url', async (event) => {
      const token = pendingToken.current;
      if (!token) return;
      pendingToken.current = null;

      try {
        // Parse verifier from callback URL
        const url = new URL(event.url);
        const verifier = url.searchParams.get('oauth_verifier');
        if (!verifier) {
          setError('No verifier received from Discogs.');
          setLoading(false);
          return;
        }

        // Exchange for access token
        const accessTokenData = await getAccessToken(
          token.oauth_token,
          token.oauth_token_secret,
          verifier
        );

        // Save tokens temporarily
        await saveTokens(
          accessTokenData.oauth_token,
          accessTokenData.oauth_token_secret,
          ''
        );

        // Fetch identity and profile
        const identity = await api.getIdentity();
        const profile = await api.getProfile(identity.username);

        // Save tokens with real username
        await saveTokens(
          accessTokenData.oauth_token,
          accessTokenData.oauth_token_secret,
          identity.username
        );

        // Update Zustand auth state → triggers redirect to (tabs)
        setAuth({
          username: identity.username,
          avatarUrl: profile.avatar_url,
          accessToken: accessTokenData.oauth_token,
          accessTokenSecret: accessTokenData.oauth_token_secret,
        });
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError('Login failed. Please try again.');
      } finally {
        setLoading(false);
        WebBrowser.dismissBrowser();
      }
    });

    return () => sub.remove();
  }, [setAuth]);

  async function handleLogin() {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Get request token
      const requestToken = await getRequestToken(CALLBACK_URL);
      pendingToken.current = requestToken;

      // Step 2: Open Discogs authorize page — don't await, the link listener handles the rest
      await WebBrowser.openBrowserAsync(
        `https://discogs.com/oauth/authorize?oauth_token=${requestToken.oauth_token}`,
        { showInRecents: true }
      );
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-[#0a0a0a] items-center justify-center px-8">
      <Text className="text-white text-5xl font-bold mb-2">Wax</Text>
      <Text className="text-neutral-400 text-lg mb-12 text-center">
        Your vinyl collection,{'\n'}beautifully organized.
      </Text>

      <Pressable
        onPress={handleLogin}
        disabled={loading}
        className="bg-[#c4882a] rounded-2xl px-8 py-4 w-full items-center active:opacity-80"
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-lg font-semibold">
            Sign in with Discogs
          </Text>
        )}
      </Pressable>

      {error && (
        <Text className="text-red-400 mt-4 text-center">{error}</Text>
      )}

      <Text className="text-neutral-600 text-xs mt-8 text-center px-4">
        This application uses Discogs' API but is not affiliated with,{'\n'}
        sponsored or endorsed by Discogs.
      </Text>
    </View>
  );
}
