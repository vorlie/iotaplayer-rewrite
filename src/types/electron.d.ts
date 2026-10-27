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
  removeTrackFromPlaylist: (playlistId: string, position: number) => Promise<Playlist[]>
  reorderPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => Promise<Playlist[]>
  favorites: () => Promise<Track[]>
  favoriteIds: () => Promise<number[]>
  toggleFavorite: (trackId: number) => Promise<boolean>
  recentlyPlayed: (limit?: number) => Promise<Track[]>
  clearHistory: () => Promise<void>
  recordPlayback: (trackId: number, durationPlayed?: number) => Promise<void>
  onScanProgress: (cb: (progress: ScanProgress) => void) => () => void
}

type PlaybackBackendMode = 'auto' | 'mpv' | 'browser'

interface DiscordActivityInput {
  details: string
  state: string
  isPlaying: boolean
  album?: string | null
  artist?: string | null
  artworkId?: number | null
  position?: number
  duration?: number
  repeatMode?: 'off' | 'all' | 'one'
}

interface AppSettings {
  discordClientId: string
  imgurClientId: string
  discordEnabled: boolean
}

interface SettingsAPI {
  get: () => Promise<AppSettings>
  set: (value: Partial<AppSettings>) => Promise<void>
}

interface DiscordAPI {
  setEnabled: (enabled: boolean) => Promise<void>
  getEnabled: () => Promise<boolean>
  setActivity: (payload: DiscordActivityInput) => Promise<void>
  clearActivity: () => Promise<void>
}

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
  saveTrackResume: (trackId: number, position: number) => Promise<void>
  getTrackResume: (trackId: number) => Promise<number | null>
  clearTrackResume: (trackId: number) => Promise<void>
  savePlaybackState: (state: Record<string, string>) => Promise<void>
  getPlaybackState: () => Promise<Record<string, string>>
  onStateChange: (cb: (state: PlaybackStateEvent) => void) => () => void
  onTrackEnded: (cb: () => void) => () => void
  getSpectrum: () => Promise<number[]>
}

declare global {
  interface Window {
    library: LibraryAPI
    settings: SettingsAPI
    discord: DiscordAPI
    playback: PlaybackAPI
  }
}

export type {
  Album,
  Artist,
  ArtworkResponse,
  DiscordAPI,
  DiscordActivityInput,
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
