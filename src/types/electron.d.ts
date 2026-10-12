// Type declarations for the contextBridge-exposed library & playback APIs.
// This file makes window.library and window.playback fully typed in the renderer.

import type {
  Album,
  Artist,
  LibraryStats,
  PlaybackStateEvent,
  ScanProgress,
  ScanResult,
  SearchResults,
  Track,
  Playlist,
} from '../../electron/types'

interface ArtworkResponse {
  mime_type: string
  data: string // base64 encoded
}

interface LibraryAPI {
  stats: () => Promise<LibraryStats>
  scan: (rootDir: string) => Promise<ScanResult>
  artists: () => Promise<Artist[]>
  artist: (id: number) => Promise<Artist | null>
  albums: (artistId?: number) => Promise<Album[]>
  album: (id: number) => Promise<Album | null>
  tracks: (opts?: {
    albumId?: number
    artistId?: number
    limit?: number
    offset?: number
  }) => Promise<Track[]>
  search: (query: string) => Promise<SearchResults>
  artwork: (id: number) => Promise<ArtworkResponse | null>
  playlists: () => Promise<Playlist[]>
  createPlaylist: (name: string, trackIds: number[]) => Promise<Playlist[] | null>
  renamePlaylist: (playlistId: string, newName: string) => Promise<Playlist[] | null>
  deletePlaylist: (playlistId: string) => Promise<Playlist[]>
  addTrackToPlaylist: (playlistId: string, trackId: number) => Promise<Playlist[]>
  onScanProgress: (cb: (progress: ScanProgress) => void) => () => void
}

type PlaybackBackendMode = 'auto' | 'mpv' | 'browser'

interface PlaybackAPI {
  getPreferredBackend: () => Promise<PlaybackBackendMode>
  setPreferredBackend: (mode: PlaybackBackendMode) => Promise<void>
  play: (filePath: string) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  toggle: () => Promise<void>
  seek: (seconds: number) => Promise<void>
  setVolume: (volume: number) => Promise<void>
  stop: () => Promise<void>
  onStateChange: (cb: (state: PlaybackStateEvent) => void) => () => void
  onTrackEnded: (cb: () => void) => () => void
}

declare global {
  interface Window {
    library: LibraryAPI
    playback: PlaybackAPI
  }
}

export type {
  Album,
  Artist,
  ArtworkResponse,
  LibraryAPI,
  LibraryStats,
  PlaybackAPI,
  PlaybackBackendMode,
  PlaybackStateEvent,
  Playlist,
  ScanProgress,
  ScanResult,
  SearchResults,
  Track,
}
