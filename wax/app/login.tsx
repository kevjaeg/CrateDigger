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
import { useColors } from '@/lib/theme';

const CALLBACK_URL = Linking.createURL('oauth');

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const pendingToken = useRef<OAuthRequestToken | null>(null);
  const c = useColors();

  useEffect(() => {
    const sub = Linking.addEventListener('url', async (event) => {
      const token = pendingToken.current;
      if (!token) return;
      pendingToken.current = null;

      try {
        const url = new URL(event.url);
        const verifier = url.searchParams.get('oauth_verifier');
        if (!verifier) {
          setError('No verifier received from Discogs.');
          setLoading(false);
          return;
        }

        const accessTokenData = await getAccessToken(
          token.oauth_token,
          token.oauth_token_secret,
          verifier
        );

        await saveTokens(
          accessTokenData.oauth_token,
          accessTokenData.oauth_token_secret,
          ''
        );

        const identity = await api.getIdentity();
        const profile = await api.getProfile(identity.username);

        await saveTokens(
          accessTokenData.oauth_token,
          accessTokenData.oauth_token_secret,
          identity.username
        );

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
      const requestToken = await getRequestToken(CALLBACK_URL);
      pendingToken.current = requestToken;

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
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <Text style={{ color: c.text, fontSize: 48, fontWeight: 'bold', marginBottom: 8 }}>Wax</Text>
      <Text style={{ color: c.textSecondary, fontSize: 18, marginBottom: 48, textAlign: 'center' }}>
        Your vinyl collection,{'\n'}beautifully organized.
      </Text>

      <Pressable
        onPress={handleLogin}
        disabled={loading}
        style={{
          backgroundColor: c.accent,
          borderRadius: 16,
          paddingHorizontal: 32,
          paddingVertical: 16,
          width: '100%',
          alignItems: 'center',
          opacity: loading ? 0.8 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
            Sign in with Discogs
          </Text>
        )}
      </Pressable>

      {error && (
        <Text style={{ color: c.danger, marginTop: 16, textAlign: 'center' }}>{error}</Text>
      )}

      <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 32, textAlign: 'center', paddingHorizontal: 16 }}>
        This application uses Discogs' API but is not affiliated with,{'\n'}
        sponsored or endorsed by Discogs.
      </Text>
    </View>
  );
}
