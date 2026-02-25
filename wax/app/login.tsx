import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { router } from 'expo-router';
import { useAuthStore } from '@/lib/store/auth-store';
import {
  getRequestToken,
  getAccessToken,
  saveTokens,
} from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';

const CALLBACK_URL = makeRedirectUri({ scheme: 'wax' });

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleLogin() {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Get request token
      const requestToken = await getRequestToken(CALLBACK_URL);

      // Step 2: Open Discogs authorize page in system browser
      const result = await WebBrowser.openAuthSessionAsync(
        `https://discogs.com/oauth/authorize?oauth_token=${requestToken.oauth_token}`,
        CALLBACK_URL
      );

      if (result.type !== 'success') {
        setError('Authorization was cancelled.');
        setLoading(false);
        return;
      }

      // Step 3: Extract verifier from callback URL
      const url = new URL(result.url);
      const verifier = url.searchParams.get('oauth_verifier');
      if (!verifier) {
        setError('No verifier received from Discogs.');
        setLoading(false);
        return;
      }

      // Step 4: Exchange for access token
      const accessTokenData = await getAccessToken(
        requestToken.oauth_token,
        requestToken.oauth_token_secret,
        verifier
      );

      // Step 5: Save tokens temporarily (username set after identity call)
      await saveTokens(
        accessTokenData.oauth_token,
        accessTokenData.oauth_token_secret,
        ''
      );

      // Step 6: Fetch identity and profile
      const identity = await api.getIdentity();
      const profile = await api.getProfile(identity.username);

      // Save tokens with real username
      await saveTokens(
        accessTokenData.oauth_token,
        accessTokenData.oauth_token_secret,
        identity.username
      );

      // Update Zustand auth state
      setAuth({
        username: identity.username,
        avatarUrl: profile.avatar_url,
        accessToken: accessTokenData.oauth_token,
        accessTokenSecret: accessTokenData.oauth_token_secret,
      });

      // Navigate to main app (collection tab created in Task 10)
      router.replace('/(tabs)' as const);
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
    } finally {
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
