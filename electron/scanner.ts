import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { parseFile } from 'music-metadata'
import type Database from 'better-sqlite3'
import { getDatabase } from './database'
import type { ScanProgress, ScanResult } from './types'

// ---------------------------------------------------------------------------
// Supported audio extensions
// ---------------------------------------------------------------------------

const SUPPORTED_EXTENSIONS = new Set([
  '.mp3', '.flac', '.aac', '.m4a', '.ogg', '.opus',
  '.wav', '.aiff', '.aif', '.wv', '.ape', '.mpc',
  '.wma', '.dsf', '.dff',
])

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function discoverFiles(rootDir: string): string[] {
  const results: string[] = []

  function walk(dir: string): void {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          results.push(fullPath)
        }
      }
    }
  }

  walk(rootDir)
  return results
}

// ---------------------------------------------------------------------------
// Artwork helpers
// ---------------------------------------------------------------------------

function hashBuffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function upsertArtwork(
  db: Database.Database,
  data: Buffer,
  mimeType: string,
): number {
  const hash = hashBuffer(data)
  const existing = db
    .prepare('SELECT id FROM artwork WHERE hash = ?')
    .get(hash) as { id: number } | undefined

  if (existing) return existing.id

  const result = db
    .prepare('INSERT INTO artwork(hash, mime_type, data) VALUES(?, ?, ?)')
    .run(hash, mimeType, data)

  return result.lastInsertRowid as number
}

// ---------------------------------------------------------------------------
// Artist / Album upsert
// ---------------------------------------------------------------------------

function upsertArtist(db: Database.Database, name: string): number {
  const existing = db
    .prepare('SELECT id FROM artists WHERE name = ? COLLATE NOCASE')
    .get(name) as { id: number } | undefined

  if (existing) return existing.id

  const result = db
    .prepare('INSERT INTO artists(name) VALUES(?)')
    .run(name)
  return result.lastInsertRowid as number
}

function upsertAlbum(
  db: Database.Database,
  title: string,
  artistId: number | null,
  year: number | null,
  artworkId: number | null,
): number {
  const existing = db
    .prepare(
      'SELECT id FROM albums WHERE title = ? COLLATE NOCASE AND (artist_id = ? OR (artist_id IS NULL AND ? IS NULL))',
    )
    .get(title, artistId, artistId) as { id: number } | undefined

  if (existing) {
    // Update artwork / year if we now have them and didn't before
    if (artworkId != null || year != null) {
      db.prepare(
        `UPDATE albums SET
           year       = COALESCE(year, ?),
           artwork_id = COALESCE(artwork_id, ?)
         WHERE id = ?`,
      ).run(year, artworkId, existing.id)
    }
    return existing.id
  }

  const result = db
    .prepare(
      'INSERT INTO albums(title, artist_id, year, artwork_id) VALUES(?, ?, ?, ?)',
    )
    .run(title, artistId, year, artworkId)
  return result.lastInsertRowid as number
}

// ---------------------------------------------------------------------------
// Single file processing
// ---------------------------------------------------------------------------

interface RawTrack {
  title: string
  artist: string | null
  album_artist: string | null
  album: string | null
  track_number: number | null
  track_total: number | null
  disc_number: number | null
  disc_total: number | null
  year: number | null
  genre: string | null
  duration: number
  bitrate: number | null
  sample_rate: number | null
  bits_per_sample: number | null
  codec: string | null
  format: string | null
  path: string
  file_size: number
  modified_time: number
  artwork_id: number | null
  artist_id: number | null
  album_id: number | null
}

async function processFile(
  db: Database.Database,
  filePath: string,
): Promise<void> {
  const stat = fs.statSync(filePath)
  const fileSize = stat.size
  const modifiedTime = stat.mtimeMs

  const meta = await parseFile(filePath, {
    duration: true,
    skipCovers: false,
  })

  const common = meta.common
  const format = meta.format

  const saveTrack = db.transaction(() => {
    // Extract artwork if present
    let artworkId: number | null = null
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0]
      artworkId = upsertArtwork(db, Buffer.from(pic.data), pic.format)
    }

    // Resolve artist
    const artistName = common.albumartist ?? common.artist ?? null
    const artistId =
      artistName != null ? upsertArtist(db, artistName) : null

    // Resolve album
    const albumTitle = common.album ?? null
    const year = common.year ?? null
    const albumId =
      albumTitle != null
        ? upsertAlbum(db, albumTitle, artistId, year, artworkId)
        : null

    const title =
      common.title ?? path.basename(filePath, path.extname(filePath))

    const track: RawTrack = {
      title,
      artist: common.artist ?? null,
      album_artist: common.albumartist ?? null,
      album: albumTitle,
      track_number: common.track?.no ?? null,
      track_total: common.track?.of ?? null,
      disc_number: common.disk?.no ?? null,
      disc_total: common.disk?.of ?? null,
      year,
      genre: common.genre?.[0] ?? null,
      duration: format.duration ?? 0,
      bitrate: format.bitrate != null ? Math.round(format.bitrate / 1000) : null,
      sample_rate: format.sampleRate ?? null,
      bits_per_sample: format.bitsPerSample ?? null,
      codec: format.codec ?? null,
      format: format.container ?? null,
      path: filePath,
      file_size: fileSize,
      modified_time: modifiedTime,
      artwork_id: artworkId,
      artist_id: artistId,
      album_id: albumId,
    }

    db.prepare(
      `INSERT INTO tracks(
         title, artist, album_artist, album, album_id, artist_id,
         track_number, track_total, disc_number, disc_total,
         year, genre, duration, bitrate, sample_rate, bits_per_sample,
         codec, format, path, file_size, modified_time, artwork_id
       ) VALUES(
         @title, @artist, @album_artist, @album, @album_id, @artist_id,
         @track_number, @track_total, @disc_number, @disc_total,
         @year, @genre, @duration, @bitrate, @sample_rate, @bits_per_sample,
         @codec, @format, @path, @file_size, @modified_time, @artwork_id
       )
       ON CONFLICT(path) DO UPDATE SET
         title          = excluded.title,
         artist         = excluded.artist,
         album_artist   = excluded.album_artist,
         album          = excluded.album,
         album_id       = excluded.album_id,
         artist_id      = excluded.artist_id,
         track_number   = excluded.track_number,
         track_total    = excluded.track_total,
         disc_number    = excluded.disc_number,
         disc_total     = excluded.disc_total,
         year           = excluded.year,
         genre          = excluded.genre,
         duration       = excluded.duration,
         bitrate        = excluded.bitrate,
         sample_rate    = excluded.sample_rate,
         bits_per_sample = excluded.bits_per_sample,
         codec          = excluded.codec,
         format         = excluded.format,
         file_size      = excluded.file_size,
         modified_time  = excluded.modified_time,
         artwork_id     = excluded.artwork_id
    `,
    ).run(track)
  })

  saveTrack()
}

// ---------------------------------------------------------------------------
// Main scan function
// ---------------------------------------------------------------------------

export async function scanLibrary(
  rootDir: string,
  onProgress?: (progress: ScanProgress) => void,
): Promise<ScanResult> {
  const startTime = Date.now()
  const db = getDatabase()
  const result: ScanResult = {
    total: 0,
    unchanged: 0,
    added: 0,
    updated: 0,
    removed: 0,
    failed: 0,
    errors: [],
    duration_ms: 0,
  }

  // Phase 1: discover files
  onProgress?.({ phase: 'discovering', current: 0, total: 0 })
  const files = discoverFiles(rootDir)
  result.total = files.length
  console.log(`[Scanner] Discovered ${files.length} audio files`)

  // Build a set of filesystem paths for removal detection
  const filesystemPaths = new Set(files)

  // Phase 2: get existing tracks from DB
  const existingTracks = db
    .prepare('SELECT path, file_size, modified_time FROM tracks')
    .all() as Array<{ path: string; file_size: number; modified_time: number }>

  const existingMap = new Map(existingTracks.map((t) => [t.path, t]))

  // Phase 3: process files
  const processFile_ = async (
    filePath: string,
  ): Promise<'added' | 'updated' | 'unchanged' | 'failed'> => {
    try {
      const stat = fs.statSync(filePath)
      const existing = existingMap.get(filePath)

      if (
        existing &&
        existing.file_size === stat.size &&
        Math.abs(existing.modified_time - stat.mtimeMs) < 1000
      ) {
        return 'unchanged'
      }

      await processFile(db, filePath)
      return existing ? 'updated' : 'added'
    } catch (err) {
      const msg = `${filePath}: ${err instanceof Error ? err.message : String(err)}`
      result.errors.push(msg)
      console.error(`[Scanner] Failed: ${msg}`)
      return 'failed'
    }
  }

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i]
    onProgress?.({
      phase: 'scanning',
      current: i + 1,
      total: files.length,
      current_file: path.basename(filePath),
    })

    const status = await processFile_(filePath)
    result[status]++
  }

  // Phase 4: remove disappeared tracks
  onProgress?.({ phase: 'removing', current: 0, total: 0 })
  const toRemove = existingTracks.filter(
    (t) => !filesystemPaths.has(t.path),
  )

  if (toRemove.length > 0) {
    const removeStmt = db.prepare('DELETE FROM tracks WHERE path = ?')
    const removeMany = db.transaction((paths: string[]) => {
      for (const p of paths) {
        removeStmt.run(p)
        result.removed++
      }
    })
    removeMany(toRemove.map((t) => t.path))
    console.log(`[Scanner] Removed ${result.removed} disappeared tracks`)
  }

  // Clean up orphaned artists and albums
  db.exec(`
    DELETE FROM albums  WHERE id NOT IN (SELECT DISTINCT album_id  FROM tracks WHERE album_id  IS NOT NULL);
    DELETE FROM artists WHERE id NOT IN (SELECT DISTINCT artist_id FROM tracks WHERE artist_id IS NOT NULL);
    DELETE FROM artwork WHERE id NOT IN (
      SELECT DISTINCT artwork_id FROM tracks WHERE artwork_id IS NOT NULL
      UNION
      SELECT DISTINCT artwork_id FROM albums WHERE artwork_id IS NOT NULL
    );
  `)

  result.duration_ms = Date.now() - startTime
  onProgress?.({ phase: 'done', current: files.length, total: files.length })

  console.log(
    `[Scanner] Done in ${result.duration_ms}ms — ` +
    `${result.added} added, ${result.updated} updated, ` +
    `${result.unchanged} unchanged, ${result.removed} removed, ${result.failed} failed`,
  )

  return result
}
