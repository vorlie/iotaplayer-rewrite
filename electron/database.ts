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

      CREATE TABLE IF NOT EXISTS playlists (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id TEXT NOT NULL,
        track_id    INTEGER NOT NULL,
        position    INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, position),
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_tracks_album_id    ON tracks(album_id);
      CREATE INDEX IF NOT EXISTS idx_tracks_artist_id   ON tracks(artist_id);
      CREATE INDEX IF NOT EXISTS idx_tracks_path        ON tracks(path);
      CREATE INDEX IF NOT EXISTS idx_albums_artist_id   ON albums(artist_id);
      CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track_id ON playlist_tracks(track_id);
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id TEXT NOT NULL,
        track_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, position),
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      UPDATE playlists
      SET last_modified = created_at
      WHERE last_modified = 0 OR last_modified IS NULL;
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS favorites (
        track_id INTEGER PRIMARY KEY,
        added_at INTEGER NOT NULL,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS playback_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id INTEGER NOT NULL,
        played_at INTEGER NOT NULL,
        duration_played REAL DEFAULT 0,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_playback_history_played_at ON playback_history(played_at DESC);

      CREATE TABLE IF NOT EXISTS track_resume (
        track_id INTEGER PRIMARY KEY,
        position REAL NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS playback_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
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

  const playlistsTableExists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'playlists'")
    .get()

  if (!playlistsTableExists) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id TEXT NOT NULL,
        track_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, position),
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );
    `)
  }

  const playlistsSchema = db.prepare('PRAGMA table_info(playlists)').all() as Array<{ name: string }>
  const hasLastModified = playlistsSchema.some((column) => column.name === 'last_modified')
  if (!hasLastModified) {
    db.exec('ALTER TABLE playlists ADD COLUMN last_modified INTEGER NOT NULL DEFAULT 0')
    db.exec('UPDATE playlists SET last_modified = created_at WHERE last_modified = 0 OR last_modified IS NULL')
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
  const trimmed = query.trim()
  if (!trimmed) {
    return { artists: [], albums: [], tracks: [] }
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) {
    return { artists: [], albums: [], tracks: [] }
  }

  // Build conditions for each token
  const artistWheres = tokens.map(() => 'a.name LIKE ? COLLATE NOCASE')
  const artistArgs = tokens.map((t) => `%${t}%`)

  const artists = db
    .prepare(
      `SELECT
         a.id, a.name,
         COUNT(DISTINCT al.id) AS album_count,
         COUNT(DISTINCT t.id)  AS track_count
       FROM artists a
       LEFT JOIN albums al ON al.artist_id = a.id
       LEFT JOIN tracks t  ON t.artist_id  = a.id
       WHERE ${artistWheres.join(' AND ')}
       GROUP BY a.id
       ORDER BY
         CASE WHEN LOWER(a.name) = LOWER(?) THEN 0
              WHEN LOWER(a.name) LIKE LOWER(?) THEN 1
              ELSE 2 END,
         a.name COLLATE NOCASE
       LIMIT 20`,
    )
    .all(...artistArgs, trimmed, `${trimmed}%`) as Artist[]

  const albumWheres = tokens.map(() => '(al.title LIKE ? COLLATE NOCASE OR ar.name LIKE ? COLLATE NOCASE)')
  const albumArgs: string[] = []
  tokens.forEach((t) => {
    albumArgs.push(`%${t}%`, `%${t}%`)
  })

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
       WHERE ${albumWheres.join(' AND ')}
       GROUP BY al.id
       ORDER BY
         CASE WHEN LOWER(al.title) = LOWER(?) THEN 0
              WHEN LOWER(al.title) LIKE LOWER(?) THEN 1
              ELSE 2 END,
         al.title COLLATE NOCASE
       LIMIT 20`,
    )
    .all(...albumArgs, trimmed, `${trimmed}%`) as Album[]

  const trackWheres = tokens.map(
    () =>
      '(t.title LIKE ? COLLATE NOCASE OR t.artist LIKE ? COLLATE NOCASE OR t.album_artist LIKE ? COLLATE NOCASE OR t.album LIKE ? COLLATE NOCASE OR t.genre LIKE ? COLLATE NOCASE OR CAST(t.year AS TEXT) LIKE ?)',
  )
  const trackArgs: string[] = []
  tokens.forEach((t) => {
    const pat = `%${t}%`
    trackArgs.push(pat, pat, pat, pat, pat, pat)
  })

  const tracks = db
    .prepare(
      `SELECT
         t.id, t.title, t.artist, t.album_artist, t.album, t.album_id, t.artist_id,
         t.track_number, t.track_total, t.disc_number, t.disc_total,
         t.year, t.genre, t.duration, t.bitrate, t.sample_rate,
         t.bits_per_sample, t.codec, t.format,
         t.path, t.file_size, t.modified_time, t.artwork_id
       FROM tracks t
       WHERE ${trackWheres.join(' AND ')}
       ORDER BY
         CASE WHEN LOWER(t.title) = LOWER(?) THEN 0
              WHEN LOWER(t.title) LIKE LOWER(?) THEN 1
              ELSE 2 END,
         LOWER(t.title)
       LIMIT 50`,
    )
    .all(...trackArgs, trimmed, `${trimmed}%`) as Track[]

  return { artists, albums, tracks }
}

export function dbGetPlaylists(): Array<{ id: string; name: string; createdAt: number; tracks: Track[] }> {
  const db = getDatabase()
  const playlists = db
    .prepare(
      `SELECT id, name, created_at AS createdAt
       FROM playlists
       ORDER BY created_at DESC`,
    )
    .all() as Array<{ id: string; name: string; createdAt: number }>

  return playlists.map((playlist) => ({
    ...playlist,
    tracks: db
      .prepare(
        `SELECT
           t.id, t.title, t.artist, t.album_artist, t.album, t.album_id, t.artist_id,
           t.track_number, t.track_total, t.disc_number, t.disc_total,
           t.year, t.genre, t.duration, t.bitrate, t.sample_rate,
           t.bits_per_sample, t.codec, t.format,
           t.path, t.file_size, t.modified_time, t.artwork_id
         FROM playlist_tracks pt
         JOIN tracks t ON t.id = pt.track_id
         WHERE pt.playlist_id = ?
         ORDER BY pt.position ASC`,
      )
      .all(playlist.id) as Track[],
  }))
}

export function dbRenamePlaylist(playlistId: string, newName: string): Array<{ id: string; name: string; createdAt: number; tracks: Track[] }> | null {
  const trimmed = newName.trim()
  if (!trimmed) return null

  const db = getDatabase()
  const result = db
    .prepare('UPDATE playlists SET name = ?, last_modified = ? WHERE id = ?')
    .run(trimmed, Date.now(), playlistId)

  if (result.changes === 0) return null

  return dbGetPlaylists()
}

export function dbDeletePlaylist(playlistId: string): Array<{ id: string; name: string; createdAt: number; tracks: Track[] }> {
  const db = getDatabase()
  db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(playlistId)
  db.prepare('DELETE FROM playlists WHERE id = ?').run(playlistId)
  return dbGetPlaylists()
}

export function dbCreatePlaylist(name: string, trackIds: number[]): Array<{ id: string; name: string; createdAt: number; tracks: Track[] }> | null {
  const trimmed = name.trim()
  if (!trimmed) return null

  const db = getDatabase()
  const id = `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const createdAt = Date.now()

  const insert = db.prepare(`INSERT INTO playlists (id, name, created_at) VALUES (?, ?, ?)`)
  insert.run(id, trimmed, createdAt)

  if (trackIds.length > 0) {
    const insertTrack = db.prepare(
      `INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)`,
    )
    trackIds.forEach((trackId, index) => {
      insertTrack.run(id, trackId, index)
    })
  }

  return dbGetPlaylists()
}

export function dbAddTrackToPlaylist(playlistId: string, trackId: number): Array<{ id: string; name: string; createdAt: number; tracks: Track[] }> {
  const db = getDatabase()
  const nextPosition = (
    db
      .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS nextPos FROM playlist_tracks WHERE playlist_id = ?')
      .get(playlistId) as { nextPos: number }
  ).nextPos

  db.prepare('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)').run(
    playlistId,
    trackId,
    nextPosition,
  )

  return dbGetPlaylists()
}

export function dbRemoveTrackFromPlaylist(
  playlistId: string,
  position: number,
): Array<{ id: string; name: string; createdAt: number; tracks: Track[] }> {
  const db = getDatabase()
  const deleteStmt = db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND position = ?')
  const updateStmt = db.prepare(
    'UPDATE playlist_tracks SET position = position - 1 WHERE playlist_id = ? AND position > ?',
  )
  const touchStmt = db.prepare('UPDATE playlists SET last_modified = ? WHERE id = ?')

  db.transaction(() => {
    deleteStmt.run(playlistId, position)
    updateStmt.run(playlistId, position)
    touchStmt.run(Date.now(), playlistId)
  })()

  return dbGetPlaylists()
}

export function dbReorderPlaylist(
  playlistId: string,
  fromIndex: number,
  toIndex: number,
): Array<{ id: string; name: string; createdAt: number; tracks: Track[] }> {
  if (fromIndex === toIndex) return dbGetPlaylists()

  const db = getDatabase()
  const currentTracks = db
    .prepare('SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC')
    .all(playlistId) as Array<{ track_id: number }>

  if (fromIndex < 0 || fromIndex >= currentTracks.length || toIndex < 0 || toIndex >= currentTracks.length) {
    return dbGetPlaylists()
  }

  const [moved] = currentTracks.splice(fromIndex, 1)
  currentTracks.splice(toIndex, 0, moved)

  const deleteStmt = db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?')
  const insertStmt = db.prepare(
    'INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)',
  )
  const touchStmt = db.prepare('UPDATE playlists SET last_modified = ? WHERE id = ?')

  db.transaction(() => {
    deleteStmt.run(playlistId)
    currentTracks.forEach((item, pos) => {
      insertStmt.run(playlistId, item.track_id, pos)
    })
    touchStmt.run(Date.now(), playlistId)
  })()

  return dbGetPlaylists()
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export function dbGetFavorites(): Track[] {
  const db = getDatabase()
  return db
    .prepare(
      `SELECT
         t.id, t.title, t.artist, t.album_artist, t.album, t.album_id, t.artist_id,
         t.track_number, t.track_total, t.disc_number, t.disc_total,
         t.year, t.genre, t.duration, t.bitrate, t.sample_rate,
         t.bits_per_sample, t.codec, t.format,
         t.path, t.file_size, t.modified_time, t.artwork_id
       FROM tracks t
       JOIN favorites f ON f.track_id = t.id
       ORDER BY f.added_at DESC`,
    )
    .all() as Track[]
}

export function dbGetFavoriteIds(): number[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT track_id FROM favorites').all() as Array<{ track_id: number }>
  return rows.map((r) => r.track_id)
}

export function dbToggleFavorite(trackId: number): boolean {
  const db = getDatabase()
  const exists = db.prepare('SELECT 1 FROM favorites WHERE track_id = ?').get(trackId)
  if (exists) {
    db.prepare('DELETE FROM favorites WHERE track_id = ?').run(trackId)
    return false
  } else {
    db.prepare('INSERT INTO favorites (track_id, added_at) VALUES (?, ?)').run(trackId, Date.now())
    return true
  }
}

export function dbIsFavorite(trackId: number): boolean {
  const db = getDatabase()
  const exists = db.prepare('SELECT 1 FROM favorites WHERE track_id = ?').get(trackId)
  return !!exists
}

// ---------------------------------------------------------------------------
// Playback History
// ---------------------------------------------------------------------------

export function dbRecordPlayback(trackId: number, durationPlayed: number = 0): void {
  const db = getDatabase()
  db.prepare(
    'INSERT INTO playback_history (track_id, played_at, duration_played) VALUES (?, ?, ?)',
  ).run(trackId, Date.now(), durationPlayed)

  // Keep history table capped at 500 entries
  db.prepare(
    `DELETE FROM playback_history WHERE id NOT IN (
       SELECT id FROM playback_history ORDER BY played_at DESC LIMIT 500
     )`,
  ).run()
}

export function dbGetRecentlyPlayed(limit: number = 50): Track[] {
  const db = getDatabase()
  return db
    .prepare(
      `SELECT
         t.id, t.title, t.artist, t.album_artist, t.album, t.album_id, t.artist_id,
         t.track_number, t.track_total, t.disc_number, t.disc_total,
         t.year, t.genre, t.duration, t.bitrate, t.sample_rate,
         t.bits_per_sample, t.codec, t.format,
         t.path, t.file_size, t.modified_time, t.artwork_id,
         MAX(ph.played_at) as last_played
       FROM tracks t
       JOIN playback_history ph ON ph.track_id = t.id
       GROUP BY t.id
       ORDER BY last_played DESC
       LIMIT ?`,
    )
    .all(limit) as Track[]
}

export function dbClearPlaybackHistory(): void {
  const db = getDatabase()
  db.prepare('DELETE FROM playback_history').run()
}

// ---------------------------------------------------------------------------
// Track Resume & Persistent Playback State
// ---------------------------------------------------------------------------

export function dbSaveTrackResume(trackId: number, position: number): void {
  const db = getDatabase()
  db.prepare(
    `INSERT INTO track_resume (track_id, position, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(track_id) DO UPDATE SET position = excluded.position, updated_at = excluded.updated_at`,
  ).run(trackId, position, Date.now())
}

export function dbGetTrackResume(trackId: number): number | null {
  const db = getDatabase()
  const row = db.prepare('SELECT position FROM track_resume WHERE track_id = ?').get(trackId) as
    | { position: number }
    | undefined
  return row ? row.position : null
}

export function dbClearTrackResume(trackId: number): void {
  const db = getDatabase()
  db.prepare('DELETE FROM track_resume WHERE track_id = ?').run(trackId)
}

export function dbSetPlaybackState(key: string, value: string): void {
  const db = getDatabase()
  db.prepare(
    `INSERT INTO playback_state (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value)
}

export function dbGetPlaybackState(key: string): string | null {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM playback_state WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row ? row.value : null
}

export function dbGetAllPlaybackState(): Record<string, string> {
  const db = getDatabase()
  const rows = db.prepare('SELECT key, value FROM playback_state').all() as Array<{
    key: string
    value: string
  }>
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}
