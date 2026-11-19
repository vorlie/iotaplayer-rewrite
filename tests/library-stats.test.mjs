import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

const { dbGetLibraryFormatStats } = await import('../dist-electron/database.js')

function createTestDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE artists (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
    CREATE TABLE albums (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, artist_id INTEGER);
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
      artwork_id INTEGER
    );
  `)
  return db
}

test('dbGetLibraryFormatStats handles an empty library safely', () => {
  const db = createTestDb()
  const stats = dbGetLibraryFormatStats(db)

  assert.equal(stats.track_count, 0)
  assert.equal(stats.album_count, 0)
  assert.equal(stats.artist_count, 0)
  assert.equal(stats.total_duration, 0)
  assert.equal(stats.total_file_size, 0)
  assert.deepEqual(stats.quality_tiers, [])
  assert.deepEqual(stats.codecs, [])
  assert.deepEqual(stats.genres, [])
})

test('dbGetLibraryFormatStats aggregates totals, quality tiers, codecs, sample rates, and genres', () => {
  const db = createTestDb()
  db.prepare(`INSERT INTO artists (id, name) VALUES (1, 'Artist A'), (2, 'Artist B')`).run()
  db.prepare(`INSERT INTO albums (id, title, artist_id) VALUES (1, 'Album 1', 1)`).run()

  const insert = db.prepare(`
    INSERT INTO tracks (title, genre, duration, bitrate, sample_rate, bits_per_sample, channels, is_lossless, codec, format, path, file_size, modified_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insert.run('Track 1', 'Electronic', 200, 2800, 96000, 24, 2, 1, 'FLAC', 'FLAC', '/a.flac', 60_000_000, 1000)
  insert.run('Track 2', 'Electronic', 180, 950, 44100, 16, 2, 1, 'FLAC', 'FLAC', '/b.flac', 25_000_000, 1000)
  insert.run('Track 3', 'Rock', 240, 320, 44100, null, 2, 0, 'MPEG 1 Layer 3', 'MPEG', '/c.mp3', 9_600_000, 1000)
  insert.run('Track 4', '  ', 120, 256, 44100, null, 2, 0, 'AAC', 'MPEG-4', '/d.m4a', 4_000_000, 1000)

  const stats = dbGetLibraryFormatStats(db)

  assert.equal(stats.track_count, 4)
  assert.equal(stats.album_count, 1)
  assert.equal(stats.artist_count, 2)
  assert.equal(stats.total_duration, 740)
  assert.equal(stats.total_file_size, 98_600_000)

  const tiers = new Map(stats.quality_tiers.map((t) => [t.tier, t.count]))
  assert.equal(tiers.get('hi-res'), 1)
  assert.equal(tiers.get('lossless'), 1)
  assert.equal(tiers.get('lossy'), 2)

  const codecs = new Map(stats.codecs.map((c) => [c.label, c.count]))
  assert.equal(codecs.get('FLAC'), 2)
  assert.equal(codecs.get('MP3'), 1)
  assert.equal(codecs.get('AAC'), 1)

  const sampleRates = new Map(stats.sample_rates.map((s) => [s.label, s.count]))
  assert.equal(sampleRates.get('44.1 kHz'), 3)
  assert.equal(sampleRates.get('96 kHz'), 1)

  assert.equal(stats.genres.length, 2)
  assert.equal(stats.genres[0].label, 'Electronic')
  assert.equal(stats.genres[0].count, 2)
})
