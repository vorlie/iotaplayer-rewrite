import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

const {
  compileSmartPlaylistQuery,
  getDefaultSmartPlaylists,
} = await import('../dist-electron/smartPlaylists.js')

const {
  dbCreateSmartPlaylist,
  dbDeleteSmartPlaylist,
  dbEvaluateSmartPlaylist,
  dbGetSmartPlaylists,
  dbPreviewSmartPlaylist,
  dbRecordPlayback,
  dbUpdateSmartPlaylist,
} = await import('../dist-electron/database.js')

function createSmartPlaylistTestDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT,
      album_artist TEXT,
      album TEXT,
      album_id INTEGER,
      artist_id INTEGER,
      track_number INTEGER,
      track_total INTEGER,
      disc_number INTEGER,
      disc_total INTEGER,
      year INTEGER,
      genre TEXT,
      duration REAL NOT NULL DEFAULT 0,
      bitrate INTEGER,
      sample_rate INTEGER,
      bits_per_sample INTEGER,
      channels INTEGER,
      is_lossless INTEGER,
      codec TEXT,
      format TEXT,
      path TEXT NOT NULL UNIQUE,
      file_size INTEGER NOT NULL,
      modified_time INTEGER NOT NULL,
      added_at INTEGER,
      play_count INTEGER NOT NULL DEFAULT 0,
      last_played_at INTEGER,
      artwork_id INTEGER
    );
    CREATE TABLE favorites (
      track_id INTEGER PRIMARY KEY,
      added_at INTEGER NOT NULL
    );
    CREATE TABLE playback_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER NOT NULL,
      played_at INTEGER NOT NULL,
      duration_played REAL DEFAULT 0
    );
    CREATE TABLE smart_playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      match_mode TEXT NOT NULL DEFAULT 'all',
      rules_json TEXT NOT NULL,
      sort_by TEXT NOT NULL DEFAULT 'added_at',
      sort_order TEXT NOT NULL DEFAULT 'desc',
      limit_count INTEGER,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_modified INTEGER NOT NULL
    );
  `)
  return db
}

test('compileSmartPlaylistQuery parameterizes user input and rejects invalid fields', () => {
  const compiled = compileSmartPlaylistQuery({
    matchMode: 'all',
    rules: [
      { field: 'genre', operator: 'contains', value: "Rock'; DROP TABLE tracks;--" },
      { field: 'invalid_field', operator: 'equals', value: 'x' },
    ],
    sortBy: 'title',
    sortOrder: 'asc',
    limit: 25,
  })

  assert.equal(compiled.sql.includes('DROP TABLE'), false)
  assert.equal(compiled.params[0], "%Rock'; DROP TABLE tracks;--%")
  assert.equal(compiled.params[1], 25)
})

test('smart playlist CRUD, evaluation, ALL vs ANY, and play_count tracking work end-to-end', () => {
  const db = createSmartPlaylistTestDb()
  const now = Date.now()
  const oldAddedAt = now - 60 * 86_400_000

  const insertTrack = db.prepare(`
    INSERT INTO tracks (title, artist, album, year, genre, duration, bitrate, sample_rate, is_lossless, codec, path, file_size, modified_time, added_at, play_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const id1 = insertTrack.run('Neon Sky', 'Synth Artist', 'Night Drive', 2024, 'Synthwave', 210, 1411, 44100, 1, 'FLAC', '/1.flac', 30_000_000, now, now, 0).lastInsertRowid
  const id2 = insertTrack.run('Dusty Tape', 'Indie Band', 'Lo-Fi', 1998, 'Indie Rock', 180, 320, 44100, 0, 'MP3', '/2.mp3', 7_000_000, oldAddedAt, oldAddedAt, 0).lastInsertRowid
  insertTrack.run('Ambient Drift', 'Ambient Duo', 'Float', 2022, 'Ambient', 300, 2400, 96000, 1, 'FLAC', '/3.flac', 60_000_000, oldAddedAt, oldAddedAt, 0)

  db.prepare('INSERT INTO favorites (track_id, added_at) VALUES (?, ?)').run(id1, now)
  dbRecordPlayback(Number(id2), 180, db)
  dbRecordPlayback(Number(id2), 180, db)

  // Seed defaults
  const insertSmart = db.prepare(`
    INSERT INTO smart_playlists (id, name, description, match_mode, rules_json, sort_by, sort_order, limit_count, is_system, created_at, last_modified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `)
  for (const sp of getDefaultSmartPlaylists(now)) {
    insertSmart.run(sp.id, sp.name, sp.description, sp.matchMode, JSON.stringify(sp.rules), sp.sortBy, sp.sortOrder, sp.limit, now, now)
  }

  const allSmart = dbGetSmartPlaylists(db)
  assert.equal(allSmart.length, 4)

  const recent = dbEvaluateSmartPlaylist('smart-recently-added', db)
  assert.equal(recent.tracks.length, 1)
  assert.equal(recent.tracks[0].title, 'Neon Sky')

  const mostPlayed = dbEvaluateSmartPlaylist('smart-most-played', db)
  assert.equal(mostPlayed.tracks.length, 1)
  assert.equal(mostPlayed.tracks[0].title, 'Dusty Tape')
  assert.equal(mostPlayed.tracks[0].play_count, 2)

  const neverPlayed = dbEvaluateSmartPlaylist('smart-never-played', db)
  assert.equal(neverPlayed.tracks.length, 2)

  const losslessFavs = dbEvaluateSmartPlaylist('smart-lossless-favorites', db)
  assert.equal(losslessFavs.tracks.length, 1)
  assert.equal(losslessFavs.tracks[0].title, 'Neon Sky')

  // Preview ANY mode
  const anyPreview = dbPreviewSmartPlaylist({
    matchMode: 'any',
    rules: [
      { field: 'genre', operator: 'equals', value: 'Ambient' },
      { field: 'year', operator: 'lt', value: 2000 },
    ],
    sortBy: 'year',
    sortOrder: 'asc',
    limit: null,
  }, db)
  assert.equal(anyPreview.length, 2)
  assert.equal(anyPreview[0].title, 'Dusty Tape')
  assert.equal(anyPreview[1].title, 'Ambient Drift')

  // Create, update, delete custom smart playlist
  const afterCreate = dbCreateSmartPlaylist({
    name: '90s Rock',
    description: 'Pre-2000 tracks',
    matchMode: 'all',
    rules: [{ field: 'year', operator: 'lt', value: 2000 }],
    sortBy: 'title',
    sortOrder: 'asc',
    limit: 10,
  }, db)
  const created = afterCreate.find((p) => p.name === '90s Rock')
  assert.ok(created)
  assert.equal(created.trackCount, 1)

  const afterUpdate = dbUpdateSmartPlaylist(created.id, { name: 'Classic Pre-2000' }, db)
  assert.ok(afterUpdate.some((p) => p.name === 'Classic Pre-2000'))

  const afterDelete = dbDeleteSmartPlaylist(created.id, db)
  assert.equal(afterDelete.some((p) => p.id === created.id), false)
})
