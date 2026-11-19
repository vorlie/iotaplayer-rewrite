// Shared types between main process and renderer (via preload)
// These are the canonical data models for the IPC bridge.

export interface Track {
  id: number
  title: string
  artist: string | null
  album_artist: string | null
  album: string | null
  album_id: number | null
  artist_id: number | null
  track_number: number | null
  track_total: number | null
  disc_number: number | null
  disc_total: number | null
  year: number | null
  genre: string | null
  duration: number // seconds
  bitrate: number | null // kbps
  sample_rate: number | null // Hz
  bits_per_sample: number | null
  channels?: number | null
  is_lossless?: number | null // 1 = lossless, 0 = lossy, null = unknown
  codec: string | null
  format: string | null
  path: string
  file_size: number // bytes
  modified_time: number // unix timestamp ms
  added_at?: number | null // unix timestamp ms
  artwork_id: number | null
}

export interface Artist {
  id: number
  name: string
  album_count: number
  track_count: number
}

export interface Album {
  id: number
  title: string
  artist_id: number | null
  artist_name: string | null
  year: number | null
  track_count: number
  duration: number
  artwork_id: number | null
}

export interface Artwork {
  id: number
  hash: string
  mime_type: string
  data: Uint8Array
}

export interface LibraryStats {
  track_count: number
  album_count: number
  artist_count: number
  total_duration: number // seconds
}

export type LyricsSourcePreference = 'embedded' | 'synchronized' | 'sidecar'

export type SyncQuality = 'none' | 'line' | 'word'

export type LyricsFormat =
  | 'embedded'
  | 'lrc'
  | 'enhanced-lrc'
  | 'lyricsfile'
  | 'plain'
  | null

export type LyricsSource =
  | 'sidecar-lrc'
  | 'sidecar-text'
  | 'sidecar-lyricsfile'
  | 'embedded'
  | null

export interface LyricWord {
  text: string
  /** Start position in seconds. */
  timestamp: number
  /** Optional end position in seconds when available from the source format. */
  endTimestamp?: number
}

export interface LyricLine {
  text: string
  /** Position in seconds when this is a time-synchronised lyric line. */
  timestamp?: number
  /** Optional end position in seconds when available from the source format. */
  endTimestamp?: number
  /** Optional word-level timing tokens when present in the source format. */
  words?: LyricWord[]
  /** True when this entry represents an explicit empty timestamped gap. */
  isGap?: boolean
}

export interface LyricsResult {
  source: LyricsSource
  format?: LyricsFormat
  syncQuality?: SyncQuality
  lines: LyricLine[]
  synchronized: boolean
  instrumental?: boolean
}

export interface ScanResult {
  total: number
  unchanged: number
  added: number
  updated: number
  removed: number
  failed: number
  errors: string[]
  duration_ms: number
}

export interface ScanProgress {
  phase: 'discovering' | 'scanning' | 'removing' | 'done'
  current: number
  total: number
  current_file?: string
}

export interface SearchResults {
  artists: Artist[]
  albums: Album[]
  tracks: Track[]
}

export interface Playlist {
  id: string
  name: string
  description: string
  coverData: string | null
  coverMimeType: string | null
  createdAt: number
  tracks: Track[]
}

export interface PlaybackStateEvent {
  isPlaying?: boolean
  position?: number // seconds
  duration?: number // seconds
  volume?: number   // 0 to 1
  backend?: 'mpv' | 'browser' | 'idle'
}
