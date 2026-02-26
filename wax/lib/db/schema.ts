import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return Promise.resolve(db);
  if (!initPromise) {
    initPromise = (async () => {
      const database = await SQLite.openDatabaseAsync('wax_v2.db');
      await initializeSchema(database);
      db = database;
      return database;
    })();
  }
  return initPromise;
}

async function initializeSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS folders (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      count       INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS collection_items (
      instance_id INTEGER PRIMARY KEY,
      release_id  INTEGER NOT NULL,
      folder_id   INTEGER NOT NULL DEFAULT 1,
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
      notes       TEXT
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

    INSERT OR IGNORE INTO folders (id, name, count) VALUES (1, 'Uncategorized', 0);
  `);
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
    initPromise = null;
  }
}
