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
