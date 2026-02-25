# Wax V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a premium third-party Discogs client with OAuth login, collection sync, stats dashboard, barcode scanning, and wantlist management.

**Architecture:** Expo app with file-based routing (expo-router), local SQLite database for collection cache + stats, TanStack Query for API data, Zustand for UI state, and a priority-based rate limiter. OAuth 1.0a with PLAINTEXT signatures for Discogs authentication.

**Tech Stack:** Expo SDK 54, expo-router 6, expo-sqlite 16, NativeWind 4, Zustand 5, TanStack Query 5, react-native-reanimated 4, expo-image 3, expo-camera 17, expo-secure-store 15, expo-web-browser 15, expo-crypto 15

---

## Phase 1: Project Scaffold & Auth

### Task 1: Initialize Expo Project

**Files:**
- Create: `wax/` (Expo project root — all app code lives here)

**Step 1: Create Expo project with expo-router template**

```bash
cd /c/Users/kevin/dev/CrateDigger
npx create-expo-app@latest wax --template tabs
```

**Step 2: Verify it runs**

```bash
cd wax
npx expo start
```

Expected: Metro bundler starts, QR code appears.
Press `q` to quit after confirming.

**Step 3: Commit**

```bash
cd /c/Users/kevin/dev/CrateDigger
git add wax/
git commit -m "feat: initialize Expo project with tabs template"
```

---

### Task 2: Install Core Dependencies

**Files:**
- Modify: `wax/package.json`

**Step 1: Install all dependencies**

```bash
cd /c/Users/kevin/dev/CrateDigger/wax

# State & data
npx expo install zustand @tanstack/react-query

# Database
npx expo install expo-sqlite

# Auth & security
npx expo install expo-secure-store expo-crypto expo-web-browser

# UI
npx expo install nativewind tailwindcss@^3.4 react-native-reanimated expo-image

# Camera (barcode)
npx expo install expo-camera
```

**Step 2: Configure NativeWind**

Create `wax/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        wax: {
          50: '#fdf8f0',
          100: '#f5e6cc',
          200: '#e8c88a',
          300: '#d4a24a',
          400: '#c4882a',
          500: '#a66f1e',
          600: '#855818',
          700: '#654214',
          800: '#4a3010',
          900: '#2d1d0a',
          950: '#1a1006',
        },
      },
    },
  },
  plugins: [],
};
```

Create `wax/global.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Update `wax/metro.config.js` to add NativeWind:
```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

Update `wax/babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};
```

Create `wax/nativewind-env.d.ts`:
```ts
/// <reference types="nativewind/types" />
```

**Step 3: Verify project still builds**

```bash
cd /c/Users/kevin/dev/CrateDigger/wax
npx expo start
```

Expected: No errors. Press `q` to quit.

**Step 4: Commit**

```bash
cd /c/Users/kevin/dev/CrateDigger
git add wax/
git commit -m "feat: install core dependencies and configure NativeWind"
```

---

### Task 3: Set Up File Structure & Theme

**Files:**
- Create: `wax/lib/api/client.ts` (stub)
- Create: `wax/lib/api/rate-limiter.ts` (stub)
- Create: `wax/lib/api/endpoints.ts` (stub)
- Create: `wax/lib/db/schema.ts` (stub)
- Create: `wax/lib/db/queries.ts` (stub)
- Create: `wax/lib/sync/collection-sync.ts` (stub)
- Create: `wax/lib/sync/stats-computer.ts` (stub)
- Create: `wax/lib/store/auth-store.ts` (stub)
- Create: `wax/lib/store/sync-store.ts` (stub)
- Create: `wax/lib/store/ui-store.ts` (stub)
- Create: `wax/constants/theme.ts`

**Step 1: Create directory structure with placeholder files**

Each stub file exports a TODO comment and any type placeholders needed by other files.

`wax/constants/theme.ts`:
```ts
export const colors = {
  // Warm vinyl-inspired palette
  wax: {
    50: '#fdf8f0',
    100: '#f5e6cc',
    200: '#e8c88a',
    300: '#d4a24a',
    400: '#c4882a',
    500: '#a66f1e',
    600: '#855818',
    700: '#654214',
    800: '#4a3010',
    900: '#2d1d0a',
    950: '#1a1006',
  },
  dark: {
    bg: '#0a0a0a',
    card: '#141414',
    cardHover: '#1e1e1e',
    border: '#2a2a2a',
    text: '#f5f5f5',
    textSecondary: '#a0a0a0',
  },
  light: {
    bg: '#f8f8f8',
    card: '#ffffff',
    cardHover: '#f0f0f0',
    border: '#e5e5e5',
    text: '#1a1a1a',
    textSecondary: '#6b6b6b',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
```

`wax/lib/store/auth-store.ts`:
```ts
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
```

`wax/lib/store/sync-store.ts`:
```ts
import { create } from 'zustand';

type SyncStatus = 'idle' | 'syncing' | 'error' | 'complete';

interface SyncState {
  status: SyncStatus;
  progress: number; // 0-1
  totalItems: number;
  syncedItems: number;
  lastSyncAt: string | null;
  error: string | null;
  setProgress: (synced: number, total: number) => void;
  setSyncing: () => void;
  setComplete: () => void;
  setError: (error: string) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  progress: 0,
  totalItems: 0,
  syncedItems: 0,
  lastSyncAt: null,
  error: null,
  setProgress: (synced, total) =>
    set({
      syncedItems: synced,
      totalItems: total,
      progress: total > 0 ? synced / total : 0,
    }),
  setSyncing: () => set({ status: 'syncing', error: null }),
  setComplete: () =>
    set({
      status: 'complete',
      progress: 1,
      lastSyncAt: new Date().toISOString(),
    }),
  setError: (error) => set({ status: 'error', error }),
}));
```

`wax/lib/store/ui-store.ts`:
```ts
import { create } from 'zustand';

type ViewMode = 'grid' | 'list';
type ColorScheme = 'dark' | 'light' | 'system';

interface UIState {
  viewMode: ViewMode;
  colorScheme: ColorScheme;
  setViewMode: (mode: ViewMode) => void;
  setColorScheme: (scheme: ColorScheme) => void;
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'grid',
  colorScheme: 'dark',
  setViewMode: (mode) => set({ viewMode: mode }),
  setColorScheme: (scheme) => set({ colorScheme: scheme }),
}));
```

Other stub files: create each with a `// TODO: implement` comment and any type exports other files depend on.

**Step 2: Commit**

```bash
git add wax/lib/ wax/constants/
git commit -m "feat: set up file structure, theme, and Zustand stores"
```

---

### Task 4: Discogs API Client with OAuth 1.0a Signing

**Files:**
- Create: `wax/lib/api/client.ts`
- Create: `wax/lib/api/endpoints.ts`
- Test: Manual test via `npx expo start` — verify unauthenticated request works

**Step 1: Implement OAuth 1.0a header generation**

`wax/lib/api/client.ts`:

The Discogs API uses PLAINTEXT signature method. The OAuth signature is simply `consumer_secret&token_secret` (or `consumer_secret&` for request token).

```ts
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://api.discogs.com';
const USER_AGENT = 'Wax/1.0 +https://github.com/wax-app';

// These will come from Discogs Developer Settings
// For now, store as constants — move to env/config later
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
      // Fall back to key/secret for unauthenticated but rate-limited requests
      headers['Authorization'] =
        `Discogs key=${CONSUMER_KEY}, secret=${CONSUMER_SECRET}`;
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Track rate limit from headers
  const remaining = response.headers.get('X-Discogs-Ratelimit-Remaining');
  if (remaining !== null) {
    // Will be consumed by rate limiter — for now just log
    console.log(`[Discogs] Rate limit remaining: ${remaining}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new DiscogsApiError(response.status, errorBody, url);
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
```

**Step 2: Define typed API endpoints**

`wax/lib/api/endpoints.ts`:

```ts
import { discogsRequest } from './client';

// --- Types ---

export interface DiscogsIdentity {
  id: number;
  username: string;
  resource_url: string;
  consumer_name: string;
}

export interface DiscogsProfile {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  num_collection: number;
  num_wantlist: number;
  num_for_sale: number;
  releases_contributed: number;
  rank: number;
  location: string;
  uri: string;
}

export interface DiscogsFolder {
  id: number;
  name: string;
  count: number;
  resource_url: string;
}

export interface DiscogsPagination {
  page: number;
  pages: number;
  per_page: number;
  items: number;
  urls: {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
}

export interface DiscogsBasicInformation {
  id: number;
  title: string;
  year: number;
  thumb: string;
  cover_image: string;
  genres: string[];
  styles: string[];
  formats: { name: string; qty: string; descriptions: string[] }[];
  labels: { id: number; name: string; catno: string }[];
  artists: { id: number; name: string; anv: string }[];
}

export interface DiscogsCollectionItem {
  id: number;
  instance_id: number;
  folder_id: number;
  rating: number;
  date_added: string;
  basic_information: DiscogsBasicInformation;
  notes?: { field_id: number; value: string }[];
}

export interface DiscogsCollectionPage {
  pagination: DiscogsPagination;
  releases: DiscogsCollectionItem[];
}

export interface DiscogsWantlistItem {
  id: number;
  rating: number;
  date_added: string;
  basic_information: DiscogsBasicInformation;
  notes?: string;
}

export interface DiscogsWantlistPage {
  pagination: DiscogsPagination;
  wants: DiscogsWantlistItem[];
}

export interface DiscogsRelease {
  id: number;
  title: string;
  year: number;
  artists: { id: number; name: string; anv: string }[];
  labels: { id: number; name: string; catno: string }[];
  genres: string[];
  styles: string[];
  tracklist: { position: string; title: string; duration: string }[];
  images: { type: string; uri: string; uri150: string; width: number; height: number }[];
  formats: { name: string; qty: string; descriptions: string[] }[];
  community: {
    have: number;
    want: number;
    rating: { average: number; count: number };
  };
  lowest_price: number | null;
  num_for_sale: number;
  notes: string;
  country: string;
  uri: string;
  master_id?: number;
  identifiers?: { type: string; value: string }[];
  videos?: { uri: string; title: string; duration: number }[];
}

export interface DiscogsSearchResult {
  id: number;
  type: string;
  title: string;
  thumb: string;
  cover_image: string;
  uri: string;
  year?: string;
  genre?: string[];
  style?: string[];
  format?: string[];
  label?: string[];
  country?: string;
  barcode?: string[];
  community?: { have: number; want: number };
}

export interface DiscogsSearchPage {
  pagination: DiscogsPagination;
  results: DiscogsSearchResult[];
}

export interface DiscogsCollectionValue {
  minimum: string;
  median: string;
  maximum: string;
}

export interface DiscogsPriceSuggestions {
  [condition: string]: { value: number; currency: string };
}

export interface DiscogsMarketplaceStats {
  lowest_price: { value: number; currency: string } | null;
  num_for_sale: number;
  blocked_from_sale: boolean;
}

// --- API Functions ---

export const api = {
  // Auth
  getIdentity: () =>
    discogsRequest<DiscogsIdentity>('/oauth/identity'),

  getProfile: (username: string) =>
    discogsRequest<DiscogsProfile>(`/users/${username}`),

  // Collection
  getCollectionFolders: (username: string) =>
    discogsRequest<{ folders: DiscogsFolder[] }>(
      `/users/${username}/collection/folders`
    ),

  getCollectionItems: (username: string, folderId: number, page = 1, perPage = 100) =>
    discogsRequest<DiscogsCollectionPage>(
      `/users/${username}/collection/folders/${folderId}/releases?page=${page}&per_page=${perPage}&sort=added&sort_order=desc`
    ),

  addToCollection: (username: string, folderId: number, releaseId: number) =>
    discogsRequest<{ instance_id: number; resource_url: string }>(
      `/users/${username}/collection/folders/${folderId}/releases/${releaseId}`,
      { method: 'POST' }
    ),

  removeFromCollection: (
    username: string,
    folderId: number,
    releaseId: number,
    instanceId: number
  ) =>
    discogsRequest<void>(
      `/users/${username}/collection/folders/${folderId}/releases/${releaseId}/instances/${instanceId}`,
      { method: 'DELETE' }
    ),

  getCollectionValue: (username: string) =>
    discogsRequest<DiscogsCollectionValue>(
      `/users/${username}/collection/value`
    ),

  // Wantlist
  getWantlist: (username: string, page = 1, perPage = 100) =>
    discogsRequest<DiscogsWantlistPage>(
      `/users/${username}/wants?page=${page}&per_page=${perPage}&sort=added&sort_order=desc`
    ),

  addToWantlist: (username: string, releaseId: number) =>
    discogsRequest<DiscogsWantlistItem>(
      `/users/${username}/wants/${releaseId}`,
      { method: 'PUT' }
    ),

  removeFromWantlist: (username: string, releaseId: number) =>
    discogsRequest<void>(
      `/users/${username}/wants/${releaseId}`,
      { method: 'DELETE' }
    ),

  // Database
  getRelease: (releaseId: number) =>
    discogsRequest<DiscogsRelease>(`/releases/${releaseId}`),

  search: (params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    return discogsRequest<DiscogsSearchPage>(
      `/database/search?${query}`
    );
  },

  searchByBarcode: (barcode: string) =>
    discogsRequest<DiscogsSearchPage>(
      `/database/search?barcode=${encodeURIComponent(barcode)}&type=release`
    ),

  // Marketplace
  getPriceSuggestions: (releaseId: number) =>
    discogsRequest<DiscogsPriceSuggestions>(
      `/marketplace/price_suggestions/${releaseId}`
    ),

  getMarketplaceStats: (releaseId: number) =>
    discogsRequest<DiscogsMarketplaceStats>(
      `/marketplace/stats/${releaseId}`
    ),
};
```

**Step 3: Commit**

```bash
git add wax/lib/api/
git commit -m "feat: implement Discogs API client with OAuth 1.0a signing"
```

---

### Task 5: Rate Limiter with Priority Queue

**Files:**
- Create: `wax/lib/api/rate-limiter.ts`

**Step 1: Implement token bucket rate limiter**

```ts
type Priority = 1 | 2 | 3; // 1 = user action, 2 = prefetch, 3 = background sync

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  priority: Priority;
  addedAt: number;
}

class RateLimiter {
  private queue: QueuedRequest<unknown>[] = [];
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per ms
  private lastRefill: number;
  private processing = false;
  private serverRemaining: number | null = null;

  constructor(maxPerMinute = 60) {
    this.maxTokens = maxPerMinute;
    this.tokens = maxPerMinute;
    this.refillRate = maxPerMinute / 60000; // tokens per ms
    this.lastRefill = Date.now();
  }

  updateServerRemaining(remaining: number): void {
    this.serverRemaining = remaining;
  }

  async schedule<T>(
    execute: () => Promise<T>,
    priority: Priority = 2
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute,
        resolve: resolve as (value: unknown) => void,
        reject,
        priority,
        addedAt: Date.now(),
      });

      // Sort by priority (lower number = higher priority), then by time added
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.addedAt - b.addedAt;
      });

      this.processQueue();
    });
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  private canProcess(): boolean {
    // If server tells us we're low, respect that
    if (this.serverRemaining !== null && this.serverRemaining < 3) {
      return false;
    }

    this.refillTokens();
    return this.tokens >= 1;
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // For background sync (priority 3), stop if server says <5 remaining
      if (
        this.queue[0].priority === 3 &&
        this.serverRemaining !== null &&
        this.serverRemaining < 5
      ) {
        // Wait and retry — don't block user actions
        await this.sleep(2000);
        this.serverRemaining = null; // Reset, will get fresh value on next request
        continue;
      }

      if (!this.canProcess()) {
        // Wait for a token to become available
        const waitTime = Math.ceil(1 / this.refillRate);
        await this.sleep(Math.min(waitTime, 1100));
        continue;
      }

      this.tokens -= 1;
      const request = this.queue.shift()!;

      try {
        const result = await request.execute();
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }

    this.processing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  get queueLength(): number {
    return this.queue.length;
  }

  get availableTokens(): number {
    this.refillTokens();
    return Math.floor(this.tokens);
  }
}

export const rateLimiter = new RateLimiter(60);
```

**Step 2: Commit**

```bash
git add wax/lib/api/rate-limiter.ts
git commit -m "feat: add rate limiter with priority queue"
```

---

### Task 6: OAuth Login Flow Screen

**Files:**
- Create: `wax/app/login.tsx`
- Modify: `wax/app/_layout.tsx` — add auth gate

**Step 1: Implement login screen with OAuth flow**

`wax/app/login.tsx`:

Uses expo-web-browser to open the Discogs authorize URL, then captures the verifier from the callback. Discogs OAuth 1.0a returns a verifier code that the user copies (or we capture via deep link callback).

The flow:
1. Get request token from Discogs
2. Open Discogs authorize page in system browser
3. User approves → redirected to our callback with oauth_verifier
4. Exchange for access token
5. Fetch identity → store tokens + username
6. Navigate to main app

```tsx
import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '@/lib/store/auth-store';
import {
  getRequestToken,
  getAccessToken,
  saveTokens,
  loadStoredAuth,
} from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { router } from 'expo-router';
import { makeRedirectUri } from 'expo-auth-session';

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

      // Step 2: Open Discogs authorize page
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

      // Step 5: Save tokens
      await saveTokens(
        accessTokenData.oauth_token,
        accessTokenData.oauth_token_secret,
        '' // username set after identity call
      );

      // Step 6: Fetch identity
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

      // Navigate to main app
      router.replace('/(tabs)/collection');
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-black items-center justify-center px-8">
      <Text className="text-white text-5xl font-bold mb-2">Wax</Text>
      <Text className="text-neutral-400 text-lg mb-12 text-center">
        Your vinyl collection,{'\n'}beautifully organized.
      </Text>

      <Pressable
        onPress={handleLogin}
        disabled={loading}
        className="bg-wax-400 rounded-2xl px-8 py-4 w-full items-center active:opacity-80"
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

      <Text className="text-neutral-600 text-xs mt-8 text-center">
        This application uses Discogs' API but is not affiliated with,{'\n'}
        sponsored or endorsed by Discogs.
      </Text>
    </View>
  );
}
```

**Step 2: Update root layout with auth gate**

`wax/app/_layout.tsx`:

The root layout checks for stored auth on mount. If authenticated, show tabs. If not, show login.

```tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useAuthStore } from '@/lib/store/auth-store';
import { loadStoredAuth } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { View, ActivityIndicator } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 6 * 60 * 60 * 1000, // 6 hours (ToS compliance)
      retry: 2,
    },
  },
});

export default function RootLayout() {
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
      } catch {
        // Stored auth is invalid — will show login screen
      } finally {
        setIsReady(true);
      }
    }
    restoreAuth();
  }, []);

  if (!isReady) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="#c4882a" size="large" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="(tabs)" />
        ) : (
          <Stack.Screen name="login" />
        )}
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
      </Stack>
    </QueryClientProvider>
  );
}
```

**Step 3: Register deep link scheme**

In `wax/app.json`, ensure the scheme is set:
```json
{
  "expo": {
    "scheme": "wax"
  }
}
```

**Step 4: Commit**

```bash
git add wax/app/login.tsx wax/app/_layout.tsx wax/app.json
git commit -m "feat: implement OAuth login flow with auth gate"
```

---

## Phase 2: Database & Collection Sync

### Task 7: SQLite Schema & Database Setup

**Files:**
- Create: `wax/lib/db/schema.ts`
- Create: `wax/lib/db/queries.ts`

**Step 1: Implement database initialization with schema**

`wax/lib/db/schema.ts`:

```ts
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('wax.db');
  await initializeSchema(db);
  return db;
}

async function initializeSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS folders (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      count       INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS collection_items (
      instance_id INTEGER PRIMARY KEY,
      release_id  INTEGER NOT NULL,
      folder_id   INTEGER NOT NULL,
      title       TEXT NOT NULL,
      artist      TEXT NOT NULL,
      year        INTEGER,
      genres      TEXT,
      styles      TEXT,
      labels      TEXT,
      formats     TEXT,
      thumb_url   TEXT,
      cover_url   TEXT,
      rating      INTEGER DEFAULT 0,
      date_added  TEXT NOT NULL,
      notes       TEXT,
      FOREIGN KEY (folder_id) REFERENCES folders(id)
    );

    CREATE TABLE IF NOT EXISTS wantlist_items (
      id          INTEGER PRIMARY KEY,
      release_id  INTEGER NOT NULL,
      title       TEXT NOT NULL,
      artist      TEXT NOT NULL,
      year        INTEGER,
      thumb_url   TEXT,
      rating      INTEGER DEFAULT 0,
      date_added  TEXT NOT NULL,
      notes       TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stats_cache (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_collection_year ON collection_items(year);
    CREATE INDEX IF NOT EXISTS idx_collection_folder ON collection_items(folder_id);
    CREATE INDEX IF NOT EXISTS idx_collection_added ON collection_items(date_added);
    CREATE INDEX IF NOT EXISTS idx_collection_release ON collection_items(release_id);
    CREATE INDEX IF NOT EXISTS idx_wantlist_release ON wantlist_items(release_id);
  `);
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
```

**Step 2: Implement typed query helpers**

`wax/lib/db/queries.ts`:

```ts
import { getDatabase } from './schema';
import type { DiscogsCollectionItem, DiscogsWantlistItem, DiscogsFolder } from '../api/endpoints';

// --- Collection ---

export async function upsertFolder(folder: DiscogsFolder): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO folders (id, name, count) VALUES (?, ?, ?)`,
    [folder.id, folder.name, folder.count]
  );
}

export async function upsertCollectionItem(item: DiscogsCollectionItem): Promise<void> {
  const db = await getDatabase();
  const info = item.basic_information;
  await db.runAsync(
    `INSERT OR REPLACE INTO collection_items
     (instance_id, release_id, folder_id, title, artist, year, genres, styles, labels, formats, thumb_url, cover_url, rating, date_added, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.instance_id,
      info.id,
      item.folder_id,
      info.title,
      info.artists.map((a) => a.name).join(', '),
      info.year,
      JSON.stringify(info.genres),
      JSON.stringify(info.styles),
      JSON.stringify(info.labels.map((l) => l.name)),
      JSON.stringify(info.formats.map((f) => f.name)),
      info.thumb,
      info.cover_image,
      item.rating,
      item.date_added,
      item.notes ? JSON.stringify(item.notes) : null,
    ]
  );
}

export async function upsertCollectionBatch(items: DiscogsCollectionItem[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const item of items) {
      await upsertCollectionItem(item);
    }
  });
}

export async function getCollectionPage(
  folderId: number | null,
  page: number,
  perPage: number
): Promise<{ items: CollectionRow[]; total: number }> {
  const db = await getDatabase();
  const whereClause = folderId !== null && folderId !== 0
    ? 'WHERE folder_id = ?'
    : '';
  const params = folderId !== null && folderId !== 0 ? [folderId] : [];

  const countResult = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM collection_items ${whereClause}`,
    params
  );

  const items = await db.getAllAsync<CollectionRow>(
    `SELECT * FROM collection_items ${whereClause} ORDER BY date_added DESC LIMIT ? OFFSET ?`,
    [...params, perPage, (page - 1) * perPage]
  );

  return { items, total: countResult?.count ?? 0 };
}

export async function getCollectionItemByRelease(releaseId: number): Promise<CollectionRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<CollectionRow>(
    'SELECT * FROM collection_items WHERE release_id = ?',
    [releaseId]
  );
}

export async function deleteCollectionItem(instanceId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM collection_items WHERE instance_id = ?', [instanceId]);
}

export async function getLocalCollectionCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM collection_items'
  );
  return result?.count ?? 0;
}

export async function getMostRecentDateAdded(): Promise<string | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ date_added: string }>(
    'SELECT date_added FROM collection_items ORDER BY date_added DESC LIMIT 1'
  );
  return result?.date_added ?? null;
}

// --- Wantlist ---

export async function upsertWantlistItem(item: DiscogsWantlistItem): Promise<void> {
  const db = await getDatabase();
  const info = item.basic_information;
  await db.runAsync(
    `INSERT OR REPLACE INTO wantlist_items
     (id, release_id, title, artist, year, thumb_url, rating, date_added, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      info.id,
      info.title,
      info.artists.map((a) => a.name).join(', '),
      info.year,
      info.thumb,
      item.rating,
      item.date_added,
      typeof item.notes === 'string' ? item.notes : null,
    ]
  );
}

export async function upsertWantlistBatch(items: DiscogsWantlistItem[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const item of items) {
      await upsertWantlistItem(item);
    }
  });
}

export async function deleteWantlistItem(releaseId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM wantlist_items WHERE release_id = ?', [releaseId]);
}

// --- Sync Metadata ---

export async function getSyncMeta(key: string): Promise<string | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_metadata WHERE key = ?',
    [key]
  );
  return result?.value ?? null;
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)`,
    [key, value, new Date().toISOString()]
  );
}

// --- Stats Cache ---

export async function getCachedStats(key: string): Promise<unknown | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM stats_cache WHERE key = ?',
    [key]
  );
  return result ? JSON.parse(result.value) : null;
}

export async function setCachedStats(key: string, value: unknown): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO stats_cache (key, value, updated_at) VALUES (?, ?, ?)`,
    [key, JSON.stringify(value), new Date().toISOString()]
  );
}

// --- Types ---

export interface CollectionRow {
  instance_id: number;
  release_id: number;
  folder_id: number;
  title: string;
  artist: string;
  year: number;
  genres: string;   // JSON array
  styles: string;   // JSON array
  labels: string;   // JSON array
  formats: string;  // JSON array
  thumb_url: string;
  cover_url: string;
  rating: number;
  date_added: string;
  notes: string | null;
}
```

**Step 3: Commit**

```bash
git add wax/lib/db/
git commit -m "feat: implement SQLite schema and typed query helpers"
```

---

### Task 8: Collection Sync Engine

**Files:**
- Create: `wax/lib/sync/collection-sync.ts`

**Step 1: Implement full + incremental sync**

`wax/lib/sync/collection-sync.ts`:

```ts
import { api } from '../api/endpoints';
import { rateLimiter } from '../api/rate-limiter';
import {
  upsertFolder,
  upsertCollectionBatch,
  setSyncMeta,
  getSyncMeta,
  getMostRecentDateAdded,
  getLocalCollectionCount,
} from '../db/queries';
import { useSyncStore } from '../store/sync-store';
import { computeAllStats } from './stats-computer';

export async function syncCollection(username: string): Promise<void> {
  const store = useSyncStore.getState();
  store.setSyncing();

  try {
    // Sync folders first
    const { folders } = await rateLimiter.schedule(
      () => api.getCollectionFolders(username),
      3 // background priority
    );
    for (const folder of folders) {
      await upsertFolder(folder);
    }

    // Determine sync strategy
    const lastSync = await getSyncMeta('last_full_sync');
    const localCount = await getLocalCollectionCount();

    if (!lastSync || localCount === 0) {
      await fullSync(username);
    } else {
      await incrementalSync(username);
    }

    // Recompute stats after sync
    await computeAllStats();

    store.setComplete();
  } catch (error) {
    console.error('[Sync] Error:', error);
    store.setError(error instanceof Error ? error.message : 'Sync failed');
  }
}

async function fullSync(username: string): Promise<void> {
  const store = useSyncStore.getState();

  // Fetch first page to get total count
  const firstPage = await rateLimiter.schedule(
    () => api.getCollectionItems(username, 0, 1, 100),
    3
  );

  const totalItems = firstPage.pagination.items;
  const totalPages = firstPage.pagination.pages;

  store.setProgress(0, totalItems);

  // Store first page immediately
  await upsertCollectionBatch(firstPage.releases);
  store.setProgress(firstPage.releases.length, totalItems);

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    const pageData = await rateLimiter.schedule(
      () => api.getCollectionItems(username, 0, page, 100),
      3
    );

    await upsertCollectionBatch(pageData.releases);

    const syncedSoFar = Math.min((page) * 100, totalItems);
    store.setProgress(syncedSoFar, totalItems);
  }

  await setSyncMeta('last_full_sync', new Date().toISOString());
  await setSyncMeta('collection_count', totalItems.toString());
}

async function incrementalSync(username: string): Promise<void> {
  const store = useSyncStore.getState();
  const mostRecentLocal = await getMostRecentDateAdded();

  let page = 1;
  let foundExisting = false;
  let newItems = 0;

  while (!foundExisting) {
    const pageData = await rateLimiter.schedule(
      () => api.getCollectionItems(username, 0, page, 100),
      3
    );

    if (pageData.releases.length === 0) break;

    // Find where new items end
    const newReleases = mostRecentLocal
      ? pageData.releases.filter((r) => r.date_added > mostRecentLocal)
      : pageData.releases;

    if (newReleases.length > 0) {
      await upsertCollectionBatch(newReleases);
      newItems += newReleases.length;
    }

    // If not all items on this page were new, we've caught up
    if (newReleases.length < pageData.releases.length) {
      foundExisting = true;
    }

    store.setProgress(newItems, newItems); // Indeterminate — we don't know total new
    page++;

    // Safety: don't scan more than 10 pages for incremental
    if (page > 10) break;
  }

  if (newItems > 0) {
    const localCount = await getLocalCollectionCount();
    await setSyncMeta('collection_count', localCount.toString());
  }

  await setSyncMeta('last_incremental_sync', new Date().toISOString());
}

export async function isSyncStale(): Promise<boolean> {
  const lastSync = await getSyncMeta('last_full_sync');
  const lastIncremental = await getSyncMeta('last_incremental_sync');

  const latest = lastIncremental || lastSync;
  if (!latest) return true;

  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
  return new Date(latest).getTime() < sixHoursAgo;
}
```

**Step 2: Commit**

```bash
git add wax/lib/sync/collection-sync.ts
git commit -m "feat: implement collection sync engine (full + incremental)"
```

---

### Task 9: Stats Computer

**Files:**
- Create: `wax/lib/sync/stats-computer.ts`

**Step 1: Implement stats computation from SQLite**

```ts
import { getDatabase } from '../db/schema';
import { setCachedStats } from '../db/queries';

export interface GenreBreakdown {
  genre: string;
  count: number;
  percentage: number;
}

export interface DecadeDistribution {
  decade: string;
  count: number;
  percentage: number;
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface FormatBreakdown {
  format: string;
  count: number;
  percentage: number;
}

export interface CollectionGrowth {
  month: string;
  count: number;
  cumulative: number;
}

export interface CollectionStats {
  totalRecords: number;
  genres: GenreBreakdown[];
  decades: DecadeDistribution[];
  topLabels: LabelCount[];
  formats: FormatBreakdown[];
  growth: CollectionGrowth[];
  oldestRecord: { title: string; artist: string; year: number } | null;
  newestRecord: { title: string; artist: string; year: number } | null;
}

export async function computeAllStats(): Promise<CollectionStats> {
  const db = await getDatabase();

  const [totalResult, genres, decades, labels, formats, growth, oldest, newest] =
    await Promise.all([
      db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM collection_items'
      ),

      db.getAllAsync<{ genre: string; count: number }>(
        `SELECT j.value as genre, COUNT(*) as count
         FROM collection_items, json_each(collection_items.genres) as j
         GROUP BY j.value ORDER BY count DESC LIMIT 10`
      ),

      db.getAllAsync<{ decade: number; count: number }>(
        `SELECT (year / 10) * 10 as decade, COUNT(*) as count
         FROM collection_items
         WHERE year IS NOT NULL AND year > 0
         GROUP BY decade ORDER BY decade`
      ),

      db.getAllAsync<{ label: string; count: number }>(
        `SELECT j.value as label, COUNT(*) as count
         FROM collection_items, json_each(collection_items.labels) as j
         GROUP BY j.value ORDER BY count DESC LIMIT 10`
      ),

      db.getAllAsync<{ format: string; count: number }>(
        `SELECT j.value as format, COUNT(*) as count
         FROM collection_items, json_each(collection_items.formats) as j
         GROUP BY j.value ORDER BY count DESC`
      ),

      db.getAllAsync<{ month: string; count: number }>(
        `SELECT strftime('%Y-%m', date_added) as month, COUNT(*) as count
         FROM collection_items GROUP BY month ORDER BY month`
      ),

      db.getFirstAsync<{ title: string; artist: string; year: number }>(
        `SELECT title, artist, year FROM collection_items
         WHERE year IS NOT NULL AND year > 0
         ORDER BY year ASC LIMIT 1`
      ),

      db.getFirstAsync<{ title: string; artist: string; year: number }>(
        `SELECT title, artist, year FROM collection_items
         WHERE year IS NOT NULL AND year > 0
         ORDER BY year DESC LIMIT 1`
      ),
    ]);

  const total = totalResult?.count ?? 0;

  // Compute percentages and cumulative growth
  const genresWithPct = genres.map((g) => ({
    ...g,
    percentage: total > 0 ? Math.round((g.count / total) * 100) : 0,
  }));

  const decadesWithPct = decades.map((d) => ({
    decade: `${d.decade}s`,
    count: d.count,
    percentage: total > 0 ? Math.round((d.count / total) * 100) : 0,
  }));

  const formatsWithPct = formats.map((f) => ({
    ...f,
    percentage: total > 0 ? Math.round((f.count / total) * 100) : 0,
  }));

  let cumulative = 0;
  const growthWithCumulative = growth.map((g) => {
    cumulative += g.count;
    return { ...g, cumulative };
  });

  const stats: CollectionStats = {
    totalRecords: total,
    genres: genresWithPct,
    decades: decadesWithPct,
    topLabels: labels,
    formats: formatsWithPct,
    growth: growthWithCumulative,
    oldestRecord: oldest,
    newestRecord: newest,
  };

  // Cache all stats
  await setCachedStats('collection_stats', stats);

  return stats;
}
```

**Step 2: Commit**

```bash
git add wax/lib/sync/stats-computer.ts
git commit -m "feat: implement stats computation from SQLite collection data"
```

---

## Phase 3: Core UI Screens

### Task 10: Tab Layout with Dark Theme

**Files:**
- Rewrite: `wax/app/(tabs)/_layout.tsx`

**Step 1: Implement 5-tab layout**

Dark theme, wax-colored active tab, clean bottom bar.

```tsx
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#c4882a',
        tabBarInactiveTintColor: '#6b6b6b',
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#2a2a2a',
          borderTopWidth: 0.5,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        headerStyle: {
          backgroundColor: '#0a0a0a',
        },
        headerTintColor: '#f5f5f5',
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="albums-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wantlist"
        options={{
          title: 'Wantlist',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

**Step 2: Create placeholder screens for each tab**

Create minimal screens at:
- `wax/app/(tabs)/collection/index.tsx`
- `wax/app/(tabs)/search/index.tsx`
- `wax/app/(tabs)/scan/index.tsx`
- `wax/app/(tabs)/wantlist/index.tsx`
- `wax/app/(tabs)/profile/index.tsx`

Each follows this pattern:
```tsx
import { View, Text } from 'react-native';
export default function ScreenName() {
  return (
    <View className="flex-1 bg-[#0a0a0a] items-center justify-center">
      <Text className="text-white text-xl">Screen Name</Text>
    </View>
  );
}
```

**Step 3: Commit**

```bash
git add wax/app/
git commit -m "feat: implement 5-tab layout with dark theme"
```

---

### Task 11: Collection Screen with Grid View

**Files:**
- Rewrite: `wax/app/(tabs)/collection/index.tsx`
- Create: `wax/components/release-card.tsx`
- Create: `wax/components/empty-state.tsx`

**Implementation:** FlatList reading from SQLite via a custom hook. Shows skeleton shimmer during initial sync, then grid of cover art cards. Pull-to-refresh triggers incremental sync. Empty state for new users with CTA to scan or search.

`wax/components/release-card.tsx`: Pressable card with cover art (expo-image), title, artist, year. Taps navigate to release detail. Grid layout = 2 columns with spacing.

`wax/components/empty-state.tsx`: Reusable component with illustration placeholder, title, subtitle, and optional CTA button.

Collection screen triggers `syncCollection(username)` on mount if stale. Shows sync progress bar when syncing. Reads paginated data from SQLite for display.

**Step 1: Implement components and screen**

**Step 2: Test with Expo Go — verify grid renders, pull-to-refresh works**

**Step 3: Commit**

```bash
git commit -m "feat: implement collection grid view with release cards"
```

---

### Task 12: Release Detail Screen

**Files:**
- Create: `wax/app/release/[id].tsx`

**Implementation:** Full-screen release detail fetched via TanStack Query (`api.getRelease`). Large hero cover art, tracklist, label/format/country info, community rating, marketplace price (lowest_price from release data). Action buttons: add/remove from collection, add/remove from wantlist. Link to Discogs page.

**Step 1: Implement screen**

**Step 2: Test navigation from collection grid to detail**

**Step 3: Commit**

```bash
git commit -m "feat: implement release detail screen with cover art and tracklist"
```

---

### Task 13: Search Screen

**Files:**
- Rewrite: `wax/app/(tabs)/search/index.tsx`

**Implementation:** Search input with debounce (300ms). Results via TanStack Query calling `api.search`. FlatList of results as release cards. Filter pills for type (release/artist/label), format, year range. Empty state for no results.

**Step 1: Implement search with filters**

**Step 2: Test search flow**

**Step 3: Commit**

```bash
git commit -m "feat: implement search screen with filters and debounced input"
```

---

### Task 14: Barcode Scanner

**Files:**
- Rewrite: `wax/app/(tabs)/scan/index.tsx`
- Create: `wax/components/barcode-scanner.tsx`

**Implementation:** Camera opens immediately on tab select. expo-camera barcode detection. On scan: call `api.searchByBarcode(code)`. Show result overlay at bottom. If match: release card preview with "Add to Collection" CTA. If no match: "Not found in Discogs" with option to search manually. Camera permission request on first use.

**Step 1: Implement scanner**

**Step 2: Test with a real barcode (phone required)**

**Step 3: Commit**

```bash
git commit -m "feat: implement barcode scanner with instant lookup"
```

---

### Task 15: Wantlist Screen

**Files:**
- Rewrite: `wax/app/(tabs)/wantlist/index.tsx`

**Implementation:** Same grid layout as collection, reading from SQLite wantlist_items. Wantlist sync (similar to collection sync but simpler — single endpoint, paginated). Each card shows lowest marketplace price. Empty state: "Your wantlist is empty — browse releases and tap the heart to add."

**Step 1: Implement wantlist sync + screen**

**Step 2: Commit**

```bash
git commit -m "feat: implement wantlist screen with local sync"
```

---

### Task 16: Profile & Stats Dashboard

**Files:**
- Rewrite: `wax/app/(tabs)/profile/index.tsx`
- Create: `wax/components/stats-chart.tsx`

**Implementation:** The showcase screen. Top section: user avatar, username, collection count, wantlist count, collection value (min/median/max from API). Stats section: genre breakdown as horizontal bar chart, decade distribution as bar chart, top 10 labels as ranked list, format pie chart, collection growth line chart. All data from stats_cache in SQLite.

Charts: use react-native-svg or a lightweight charting library (victory-native or custom SVG). Keep it clean and elegant — this is the App Store screenshot.

Settings section at bottom: dark/light mode toggle, view mode (grid/list), logout, about (with Discogs attribution), app version.

**Step 1: Implement stats dashboard**

**Step 2: Implement settings**

**Step 3: Commit**

```bash
git commit -m "feat: implement profile screen with stats dashboard"
```

---

## Phase 4: Polish

### Task 17: Loading States & Animations

- Skeleton shimmer for loading cards (collection, search, wantlist)
- Sync progress bar (thin, wax-colored, at top of screen)
- Pull-to-refresh with custom animation
- Screen transitions via react-native-reanimated
- Haptic feedback on add/remove actions (if expo-haptics available)

### Task 18: Error Handling

- Network offline banner: "You're offline — showing cached data"
- API error toasts: brief, non-blocking
- Auth expired: redirect to login with message
- Rate limit: silent queue, never shown to user
- Empty search: helpful message with suggestions

### Task 19: Final Touches

- App icon and splash screen
- Discogs attribution text in about section
- Deep link support (wax://release/{id})
- Performance audit: FlatList optimization, image caching verification
- Test on real devices (iOS + Android)

---

## Dependency Graph

```
Task 1 (scaffold)
  └→ Task 2 (dependencies)
       └→ Task 3 (file structure)
            ├→ Task 4 (API client) ─────┐
            │    └→ Task 5 (rate limiter)│
            │                            │
            └→ Task 6 (login) ──────────┘
                 └→ Task 7 (SQLite)
                      └→ Task 8 (sync engine)
                           └→ Task 9 (stats)
                                └→ Task 10 (tab layout)
                                     ├→ Task 11 (collection)
                                     ├→ Task 13 (search)
                                     ├→ Task 14 (scanner)
                                     ├→ Task 15 (wantlist)
                                     └→ Task 16 (stats dashboard)
                                          └→ Task 12 (release detail)
                                               └→ Task 17 (loading)
                                                    └→ Task 18 (errors)
                                                         └→ Task 19 (polish)
```

Tasks 11, 13, 14, 15, 16 can run in parallel once Task 10 is complete.
