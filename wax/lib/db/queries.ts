import { getDatabase } from './schema';
import type { DiscogsCollectionItem, DiscogsWantlistItem, DiscogsFolder } from '../api/endpoints';

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

export async function getFolders(): Promise<{ id: number; name: string; count: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ id: number; name: string; count: number }>(
    'SELECT * FROM folders ORDER BY name'
  );
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
  });
}

export async function getWantlistPage(
  page: number,
  perPage: number
): Promise<{ items: CollectionRow[]; total: number }> {
  const db = await getDatabase();

  const countResult = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM wantlist_items'
  );

  const items = await db.getAllAsync<CollectionRow>(
    'SELECT id as instance_id, release_id, 0 as folder_id, title, artist, year, \'\' as genres, \'\' as styles, \'\' as labels, \'\' as formats, thumb_url, \'\' as cover_url, rating, date_added, notes FROM wantlist_items ORDER BY date_added DESC LIMIT ? OFFSET ?',
    [perPage, (page - 1) * perPage]
  );

  return { items, total: countResult?.count ?? 0 };
}

export async function deleteWantlistItem(releaseId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM wantlist_items WHERE release_id = ?', [releaseId]);
}

export async function isInWantlist(releaseId: number): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM wantlist_items WHERE release_id = ?',
    [releaseId]
  );
  return (result?.count ?? 0) > 0;
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
