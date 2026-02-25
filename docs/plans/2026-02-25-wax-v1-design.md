# Wax V1 — Design Document

**Date:** 2026-02-25
**Status:** Approved
**App Name:** Wax (formerly CrateDigger)
**Description:** A premium third-party Discogs client for iOS and Android

## Overview

Wax is a mobile app that provides a better frontend for Discogs — the world's largest music database (17M users, 800M+ entries). Users authenticate with their existing Discogs account via OAuth 1.0a. No custom backend — all data comes from the Discogs API directly, cached locally in SQLite.

**Differentiators vs. official Discogs app:**
- Faster UI with instant collection display from local cache
- Rich collection statistics (genre breakdown, decade distribution, top labels)
- Dark mode from day 1
- Clean navigation with zero-tap barcode scanning
- Premium design feel (big cover art, smooth animations)

**Monetization:** Free for now. Commercial use requires written Discogs permission per their API ToS.

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Expo SDK 52+ (React Native) | Cross-platform, managed workflow, OTA updates |
| Router | expo-router (file-based) | Native nav feel, deep linking |
| State | Zustand | Lightweight, minimal boilerplate |
| API caching | TanStack Query | Stale-while-revalidate, retries, background refetch |
| Local DB | expo-sqlite | Collection sync, stats computation, offline cache |
| Auth storage | expo-secure-store | Encrypted OAuth token storage |
| Camera | expo-camera | Barcode scanning, no native module ejection |
| Images | expo-image | Disk/memory caching, blur hash placeholders |
| Animations | react-native-reanimated | 60fps native animations |
| Styling | NativeWind (Tailwind for RN) | Fast iteration, dark mode built-in |

## Navigation

Five-tab bottom bar, each tab owns its own stack:

- **Collection** — Folder list → Items grid → Release detail
- **Search** — Search + filters → Results → Release detail
- **Scan** — Camera opens immediately → Barcode result → Release detail
- **Wantlist** — Wantlist grid → Release detail
- **Profile** — Stats dashboard + Collection value + Settings

Release Detail is a shared screen accessible from every tab.

## Data Architecture

### Three-layer split

1. **UI Layer** — React components + Zustand (UI state only)
2. **Data Access Layer** — TanStack Query (remote/ephemeral) + SQLite (persistent/queryable)
3. **API Layer** — Discogs client with OAuth signing + rate limiter queue

### What goes where

| Data | Storage | Reason |
|------|---------|--------|
| Collection items | SQLite | Persistent, queryable for stats, offline |
| Wantlist items | SQLite | Same |
| Search results | TanStack Query (memory) | Ephemeral |
| Release details | TanStack Query + SQLite (for owned) | Quick re-access |
| Marketplace prices | TanStack Query (5-min stale) | Always fresh, never >6hrs per ToS |
| Computed stats | SQLite (stats_cache) | Expensive to recompute |
| Auth tokens | SecureStore | Encrypted |

## Collection Sync Engine

### Initial sync (first login)
1. Fetch collection folders (1 API call)
2. Fetch folder "All" page 1 — display immediately (1 call)
3. Background: fetch remaining pages at ~50 req/min, reserving 10 req/min for user actions
4. On completion: compute stats, cache in SQLite
5. Progress indicator: "Syncing collection... 2,400 / 10,000"

Timing: 2,000 records = ~24 seconds. 10,000 records = ~2 minutes.

### Incremental sync (subsequent opens)
1. Show cached collection from SQLite — instant
2. Background: fetch newest-first, stop when we hit a known record
3. Recompute stats only if changes detected

### ToS compliance
- Collection list: refreshed on every app open (incremental sync). Stale marker after 6 hours.
- Release details: TanStack Query staleTime 5 min, cacheTime 6 hours.
- Prices: staleTime 5 min. Never persisted to SQLite.

## SQLite Schema

```sql
CREATE TABLE folders (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    count       INTEGER DEFAULT 0
);

CREATE TABLE collection_items (
    instance_id INTEGER PRIMARY KEY,
    release_id  INTEGER NOT NULL,
    folder_id   INTEGER NOT NULL,
    title       TEXT NOT NULL,
    artist      TEXT NOT NULL,
    year        INTEGER,
    genres      TEXT,    -- JSON array
    styles      TEXT,    -- JSON array
    labels      TEXT,    -- JSON array
    formats     TEXT,    -- JSON array
    thumb_url   TEXT,
    cover_url   TEXT,
    rating      INTEGER DEFAULT 0,
    date_added  TEXT NOT NULL,
    notes       TEXT,
    FOREIGN KEY (folder_id) REFERENCES folders(id)
);

CREATE TABLE wantlist_items (
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

CREATE TABLE sync_metadata (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE stats_cache (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX idx_collection_genre ON collection_items(genres);
CREATE INDEX idx_collection_year ON collection_items(year);
CREATE INDEX idx_collection_folder ON collection_items(folder_id);
CREATE INDEX idx_collection_added ON collection_items(date_added);
```

JSON arrays in SQLite columns: deliberate trade-off. Genres/styles/labels arrive as arrays from the API and only get read via json_each() for stats. Simpler sync, faster bulk inserts.

## Stats Computation

Computed from SQLite after sync, cached in stats_cache:
- **Genre breakdown** (top 10) via json_each on genres column
- **Decade distribution** via year / 10 * 10 grouping
- **Top labels** (top 10) via json_each on labels column
- **Format breakdown** (Vinyl/CD/Cassette/Digital)
- **Collection growth** (items added per month)
- **Collection value** via GET /users/{username}/collection/value (min/median/max)

All queries execute <100ms on 10,000+ rows.

## Rate Limiter

Token bucket with priority queue:
- **Priority 1:** User actions (search, scan, add/remove)
- **Priority 2:** Detail prefetch (scroll proximity)
- **Priority 3:** Background sync

Budget: 60 req/min. Sync runs at ~50/min, reserving 10/min headroom.
Tracks actual remaining via X-Discogs-Ratelimit-Remaining header.
If remaining < 5: pause sync, only process Priority 1.
429 response: pause 60s. 5xx: exponential backoff.

## API Endpoint Mapping

### Auth
- `GET /oauth/request_token` — request token
- `discogs.com/oauth/authorize?oauth_token=...` — user authorization
- `POST /oauth/access_token` — access token
- `GET /oauth/identity` — verify auth
- `GET /users/{username}` — profile

### Collection
- `GET /users/{username}/collection/folders` — list folders
- `GET /users/{username}/collection/folders/{id}/releases?page=X&per_page=100` — items
- `POST /users/{username}/collection/folders/{id}/releases/{release_id}` — add
- `DELETE .../instances/{instance_id}` — remove
- `POST .../instances/{instance_id}` — rate
- `GET /users/{username}/collection/value` — total value

### Wantlist
- `GET /users/{username}/wants?page=X&per_page=100` — list
- `PUT /users/{username}/wants/{release_id}` — add
- `DELETE /users/{username}/wants/{release_id}` — remove

### Search
- `GET /database/search?q=...&type=release` — text search
- `GET /database/search?barcode=...` — barcode lookup
- Additional params: artist, genre, style, year, format, country, label, catno

### Release Detail
- `GET /releases/{release_id}` — full detail (includes lowest_price, num_for_sale, images, tracklist)

### Marketplace
- `GET /marketplace/price_suggestions/{release_id}` — prices by condition
- `GET /marketplace/stats/{release_id}` — marketplace stats

## Error States & Empty States

### First-time user (empty collection)
- Welcoming illustration + "Your collection is empty"
- CTA: "Scan your first record" or "Search for a release to add"
- Quick-start guide overlay on first launch

### Collection syncing (first login)
- Skeleton cards with shimmer animation while first page loads
- After first page: real data visible, progress bar for remaining sync
- "Syncing your collection... 2,400 / 10,000 records"

### API errors
- Network offline: banner at top "You're offline — showing cached data"
- Offline + no cache: full-screen empty state with retry button
- Rate limited: silent queue, user never sees this
- 5xx errors: toast with "Discogs is having issues, retrying..."
- Auth expired: redirect to login with explanation

### Empty search results
- "No results for [query]" with suggestions to broaden search

### Empty wantlist
- "Your wantlist is empty — browse releases and tap the heart to add"

## File Structure

```
wax/
├── app/                          # expo-router pages
│   ├── (tabs)/
│   │   ├── collection/
│   │   │   ├── index.tsx
│   │   │   └── [folderId].tsx
│   │   ├── search/index.tsx
│   │   ├── scan/index.tsx
│   │   ├── wantlist/index.tsx
│   │   └── profile/index.tsx
│   ├── release/[id].tsx
│   ├── login.tsx
│   └── _layout.tsx
├── lib/
│   ├── api/
│   │   ├── client.ts
│   │   ├── rate-limiter.ts
│   │   └── endpoints.ts
│   ├── db/
│   │   ├── schema.ts
│   │   ├── migrations.ts
│   │   └── queries.ts
│   ├── sync/
│   │   ├── collection-sync.ts
│   │   ├── wantlist-sync.ts
│   │   └── stats-computer.ts
│   └── store/
│       ├── auth-store.ts
│       ├── sync-store.ts
│       └── ui-store.ts
├── components/
│   ├── release-card.tsx
│   ├── release-list-item.tsx
│   ├── stats-chart.tsx
│   ├── barcode-scanner.tsx
│   └── empty-state.tsx
├── constants/theme.ts
└── assets/
```

## Critical Path

1. OAuth flow → 2. Collection sync engine → 3. Stats computation → 4. UI screens

## Discogs API Compliance

Required attribution (in app settings/about screen):
> "This application uses Discogs' API but is not affiliated with, sponsored or endorsed by Discogs. 'Discogs' is a trademark of Zink Media, LLC."

Next to any Discogs data:
> "Data provided by Discogs." (with hyperlink to discogs.com page)

User-Agent: `Wax/1.0 +https://wax.app`
