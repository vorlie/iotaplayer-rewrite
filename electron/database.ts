import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import type { Album, Artist, Artwork, LibraryStats, Track } from './types'

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function initDatabase(): Database.Database {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'library.db')

  console.log(`[DB] Opening database at: ${dbPath}`)

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  runMigrations(db)

  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

const MIGRATIONS: Array<{ version: number; sql: string }> = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS artwork (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        hash      TEXT    NOT NULL UNIQUE,
        mime_type TEXT    NOT NULL,
        data      BLOB    NOT NULL
      );

      CREATE TABLE IF NOT EXISTS artists (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT    NOT NULL UNIQUE COLLATE NOCASE
      );

      CREATE TABLE IF NOT EXISTS albums (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        title      TEXT    NOT NULL COLLATE NOCASE,
        artist_id  INTEGER REFERENCES artists(id) ON DELETE SET NULL,
        year       INTEGER,
        artwork_id INTEGER REFERENCES artwork(id) ON DELETE SET NULL,
        UNIQUE(title, artist_id)
      );

      CREATE TABLE IF NOT EXISTS tracks (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        title          TEXT    NOT NULL,
        artist         TEXT,
        album_artist   TEXT,
        album          TEXT,
        album_id       INTEGER REFERENCES albums(id) ON DELETE SET NULL,
        artist_id      INTEGER REFERENCES artists(id) ON DELETE SET NULL,
        track_number   INTEGER,
        track_total    INTEGER,
        disc_number    INTEGER,
        disc_total     INTEGER,
        year           INTEGER,
        genre          TEXT,
        duration       REAL    NOT NULL DEFAULT 0,
        bitrate        INTEGER,
        sample_rate    INTEGER,
        bits_per_sample INTEGER,
        codec          TEXT,
        format         TEXT,
        path           TEXT    NOT NULL UNIQUE,
        file_size      INTEGER NOT NULL,
        modified_time  INTEGER NOT NULL,
        artwork_id     INTEGER REFERENCES artwork(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tracks_album_id    ON tracks(album_id);
      CREATE INDEX IF NOT EXISTS idx_tracks_artist_id   ON tracks(artist_id);
      CREATE INDEX IF NOT EXISTS idx_tracks_path        ON tracks(path);
      CREATE INDEX IF NOT EXISTS idx_albums_artist_id   ON albums(artist_id);
    `,
  },
]

function runMigrations(db: Database.Database): void {
  // Ensure version table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `)

  const current = (
    db.prepare('SELECT MAX(version) as v FROM schema_version').get() as {
      v: number | null
    }
  ).v ?? 0

  for (const migration of MIGRATIONS) {
    if (migration.version > current) {
      console.log(`[DB] Running migration v${migration.version}`)
      db.exec(migration.sql)
      db
        .prepare('INSERT OR REPLACE INTO schema_version(version) VALUES(?)')
        .run(migration.version)
    }
  }
}

// ---------------------------------------------------------------------------
// Library queries
// ---------------------------------------------------------------------------

export function dbGetStats(): LibraryStats {
  const db = getDatabase()
  const row = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM tracks)              AS track_count,
         (SELECT COUNT(*) FROM albums)              AS album_count,
         (SELECT COUNT(*) FROM artists)             AS artist_count,
         (SELECT COALESCE(SUM(duration),0) FROM tracks) AS total_duration
      `,
    )
    .get() as LibraryStats
  return row
}

export function dbGetArtists(): Artist[] {
  const db = getDatabase()
  return db
    .prepare(
      `SELECT
         a.id,
         a.name,
         COUNT(DISTINCT al.id) AS album_count,
         COUNT(DISTINCT t.id)  AS track_count
       FROM artists a
       LEFT JOIN albums al ON al.artist_id = a.id
       LEFT JOIN tracks t  ON t.artist_id  = a.id
       GROUP BY a.id
       ORDER BY a.name COLLATE NOCASE`,
    )
    .all() as Artist[]
}

export function dbGetArtist(id: number): Artist | null {
  const db = getDatabase()
  const row = db
    .prepare(
      `SELECT
         a.id,
         a.name,
         COUNT(DISTINCT al.id) AS album_count,
         COUNT(DISTINCT t.id)  AS track_count
       FROM artists a
       LEFT JOIN albums al ON al.artist_id = a.id
       LEFT JOIN tracks t  ON t.artist_id  = a.id
       WHERE a.id = ?
       GROUP BY a.id`,
    )
    .get(id)
  return (row as Artist) ?? null
}

export function dbGetAlbums(artistId?: number): Album[] {
  const db = getDatabase()
  const where = artistId != null ? 'WHERE al.artist_id = ?' : ''
  const args = artistId != null ? [artistId] : []
  return db
    .prepare(
      `SELECT
         al.id,
         al.title,
         al.artist_id,
         ar.name        AS artist_name,
         al.year,
         COUNT(t.id)    AS track_count,
         COALESCE(SUM(t.duration), 0) AS duration,
         al.artwork_id
       FROM albums al
       LEFT JOIN artists ar ON ar.id = al.artist_id
       LEFT JOIN tracks  t  ON t.album_id = al.id
       ${where}
       GROUP BY al.id
       ORDER BY LOWER(ar.name), al.year, LOWER(al.title)`,
    )
    .all(...args) as Album[]
}

export function dbGetAlbum(id: number): Album | null {
  const db = getDatabase()
  const row = db
    .prepare(
      `SELECT
         al.id,
         al.title,
         al.artist_id,
         ar.name        AS artist_name,
         al.year,
         COUNT(t.id)    AS track_count,
         COALESCE(SUM(t.duration), 0) AS duration,
         al.artwork_id
       FROM albums al
       LEFT JOIN artists ar ON ar.id = al.artist_id
       LEFT JOIN tracks  t  ON t.album_id = al.id
       WHERE al.id = ?
       GROUP BY al.id`,
    )
    .get(id)
  return (row as Album) ?? null
}

export function dbGetTracks(opts?: {
  albumId?: number
  artistId?: number
  limit?: number
  offset?: number
}): Track[] {
  const db = getDatabase()
  const wheres: string[] = []
  const args: (number | string)[] = []

  if (opts?.albumId != null) {
    wheres.push('t.album_id = ?')
    args.push(opts.albumId)
  }
  if (opts?.artistId != null) {
    wheres.push('t.artist_id = ?')
    args.push(opts.artistId)
  }

  const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''
  const limit = opts?.limit != null ? `LIMIT ${opts.limit}` : ''
  const offset = opts?.offset != null ? `OFFSET ${opts.offset}` : ''

  return db
    .prepare(
      `SELECT
         t.id, t.title, t.artist, t.album_artist, t.album, t.album_id, t.artist_id,
         t.track_number, t.track_total, t.disc_number, t.disc_total,
         t.year, t.genre, t.duration, t.bitrate, t.sample_rate,
         t.bits_per_sample, t.codec, t.format,
         t.path, t.file_size, t.modified_time, t.artwork_id
       FROM tracks t
       ${where}
       ORDER BY LOWER(t.album_artist), LOWER(t.album), t.disc_number, t.track_number, LOWER(t.title)
       ${limit} ${offset}`,
    )
    .all(...args) as Track[]
}

export function dbGetArtwork(id: number): Artwork | null {
  const db = getDatabase()
  const row = db
    .prepare('SELECT id, hash, mime_type, data FROM artwork WHERE id = ?')
    .get(id)
  return (row as Artwork) ?? null
}

export function dbSearch(query: string): {
  artists: Artist[]
  albums: Album[]
  tracks: Track[]
} {
  const db = getDatabase()
  const q = `%${query}%`

  const artists = db
    .prepare(
      `SELECT
         a.id, a.name,
         COUNT(DISTINCT al.id) AS album_count,
         COUNT(DISTINCT t.id)  AS track_count
       FROM artists a
       LEFT JOIN albums al ON al.artist_id = a.id
       LEFT JOIN tracks t  ON t.artist_id  = a.id
       WHERE a.name LIKE ? COLLATE NOCASE
       GROUP BY a.id
       LIMIT 10`,
    )
    .all(q) as Artist[]

  const albums = db
    .prepare(
      `SELECT
         al.id, al.title, al.artist_id,
         ar.name AS artist_name, al.year,
         COUNT(t.id) AS track_count,
         COALESCE(SUM(t.duration), 0) AS duration,
         al.artwork_id
       FROM albums al
       LEFT JOIN artists ar ON ar.id = al.artist_id
       LEFT JOIN tracks  t  ON t.album_id = al.id
       WHERE al.title LIKE ? COLLATE NOCASE
       GROUP BY al.id
       LIMIT 10`,
    )
    .all(q) as Album[]

  const tracks = db
    .prepare(
      `SELECT
         t.id, t.title, t.artist, t.album_artist, t.album, t.album_id, t.artist_id,
         t.track_number, t.track_total, t.disc_number, t.disc_total,
         t.year, t.genre, t.duration, t.bitrate, t.sample_rate,
         t.bits_per_sample, t.codec, t.format,
         t.path, t.file_size, t.modified_time, t.artwork_id
       FROM tracks t
       WHERE t.title LIKE ? COLLATE NOCASE
          OR t.artist LIKE ? COLLATE NOCASE
       LIMIT 20`,
    )
    .all(q, q) as Track[]

  return { artists, albums, tracks }
}
