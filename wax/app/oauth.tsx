import { Redirect } from 'expo-router';

// This route exists only to catch the OAuth callback deep link.
// The actual OAuth logic is handled by the Linking listener in login.tsx.
export default function OAuthCallback() {
  return <Redirect href="/login" />;
}
