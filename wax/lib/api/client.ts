import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://api.discogs.com';
const USER_AGENT = 'Wax/1.0 +https://github.com/wax-app';

// TODO: Replace with real credentials from discogs.com/settings/developers
const CONSUMER_KEY = 'YOUR_CONSUMER_KEY';
const CONSUMER_SECRET = 'YOUR_CONSUMER_SECRET';

const SECURE_STORE_KEYS = {
  accessToken: 'discogs_access_token',
  accessTokenSecret: 'discogs_access_token_secret',
  username: 'discogs_username',
} as const;

async function generateNonce(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function buildOAuthHeader(params: Record<string, string>): string {
  const parts = Object.entries(params)
    .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
    .join(', ');
  return `OAuth ${parts}`;
}

export interface DiscogsRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  authenticated?: boolean;
}

export async function discogsRequest<T>(
  path: string,
  options: DiscogsRequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, authenticated = true } = options;

  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Content-Type': 'application/json',
  };

  if (authenticated) {
    const accessToken = await SecureStore.getItemAsync(
      SECURE_STORE_KEYS.accessToken
    );
    const accessTokenSecret = await SecureStore.getItemAsync(
      SECURE_STORE_KEYS.accessTokenSecret
    );

    if (accessToken && accessTokenSecret) {
      const nonce = await generateNonce();
      const timestamp = Math.floor(Date.now() / 1000).toString();

      headers['Authorization'] = buildOAuthHeader({
        oauth_consumer_key: CONSUMER_KEY,
        oauth_nonce: nonce,
        oauth_token: accessToken,
        oauth_signature: `${CONSUMER_SECRET}&${accessTokenSecret}`,
        oauth_signature_method: 'PLAINTEXT',
        oauth_timestamp: timestamp,
      });
    } else {
      headers['Authorization'] =
        `Discogs key=${CONSUMER_KEY}, secret=${CONSUMER_SECRET}`;
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const remaining = response.headers.get('X-Discogs-Ratelimit-Remaining');
  if (remaining !== null) {
    // Rate limiter integration will be added in Task 5
    console.log(`[Discogs] Rate limit remaining: ${remaining}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new DiscogsApiError(response.status, errorBody, url);
  }

  // Handle 204 No Content (e.g., DELETE responses)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export class DiscogsApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    public url: string
  ) {
    super(`Discogs API error ${status}: ${body} (${url})`);
    this.name = 'DiscogsApiError';
  }
}

// --- OAuth Flow ---

export interface OAuthRequestToken {
  oauth_token: string;
  oauth_token_secret: string;
}

export async function getRequestToken(
  callbackUrl: string
): Promise<OAuthRequestToken> {
  const nonce = await generateNonce();
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const response = await fetch(`${BASE_URL}/oauth/request_token`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
      Authorization: buildOAuthHeader({
        oauth_consumer_key: CONSUMER_KEY,
        oauth_nonce: nonce,
        oauth_signature: `${CONSUMER_SECRET}&`,
        oauth_signature_method: 'PLAINTEXT',
        oauth_timestamp: timestamp,
        oauth_callback: callbackUrl,
      }),
    },
  });

  if (!response.ok) {
    throw new Error(`Request token failed: ${response.status}`);
  }

  const text = await response.text();
  const params = new URLSearchParams(text);

  return {
    oauth_token: params.get('oauth_token')!,
    oauth_token_secret: params.get('oauth_token_secret')!,
  };
}

export async function getAccessToken(
  requestToken: string,
  requestTokenSecret: string,
  verifier: string
): Promise<{ oauth_token: string; oauth_token_secret: string }> {
  const nonce = await generateNonce();
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const response = await fetch(`${BASE_URL}/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
      Authorization: buildOAuthHeader({
        oauth_consumer_key: CONSUMER_KEY,
        oauth_nonce: nonce,
        oauth_token: requestToken,
        oauth_signature: `${CONSUMER_SECRET}&${requestTokenSecret}`,
        oauth_signature_method: 'PLAINTEXT',
        oauth_timestamp: timestamp,
        oauth_verifier: verifier,
      }),
    },
  });

  if (!response.ok) {
    throw new Error(`Access token failed: ${response.status}`);
  }

  const text = await response.text();
  const params = new URLSearchParams(text);

  return {
    oauth_token: params.get('oauth_token')!,
    oauth_token_secret: params.get('oauth_token_secret')!,
  };
}

export async function saveTokens(
  accessToken: string,
  accessTokenSecret: string,
  username: string
): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.accessToken, accessToken);
  await SecureStore.setItemAsync(
    SECURE_STORE_KEYS.accessTokenSecret,
    accessTokenSecret
  );
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.username, username);
}

export async function loadStoredAuth(): Promise<{
  accessToken: string;
  accessTokenSecret: string;
  username: string;
} | null> {
  const accessToken = await SecureStore.getItemAsync(
    SECURE_STORE_KEYS.accessToken
  );
  const accessTokenSecret = await SecureStore.getItemAsync(
    SECURE_STORE_KEYS.accessTokenSecret
  );
  const username = await SecureStore.getItemAsync(SECURE_STORE_KEYS.username);

  if (accessToken && accessTokenSecret && username) {
    return { accessToken, accessTokenSecret, username };
  }
  return null;
}

export async function clearStoredAuth(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.accessToken);
  await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.accessTokenSecret);
  await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.username);
}
