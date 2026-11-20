// Type declarations for the contextBridge-exposed library & playback APIs.
// This file makes window.library and window.playback fully typed in the renderer.

import type {
  Album,
  Artist,
  LibraryFormatStats,
  LibraryStats,
  LyricLine,
  LyricsFormat,
  LyricsResult,
  LyricsSource,
  LyricsSourcePreference,
  LyricWord,
  PlaybackStateEvent,
  ScanProgress,
  ScanResult,
  SearchResults,
  SmartPlaylist,
  SmartPlaylistField,
  SmartPlaylistInput,
  SmartPlaylistMatchMode,
  SmartPlaylistOperator,
  SmartPlaylistRule,
  SmartPlaylistSortBy,
  SmartPlaylistSortOrder,
  SyncQuality,
  Track,
  Playlist,
} from '../../electron/types'

interface ArtworkResponse {
  mime_type: string
  data: string // base64 encoded
}

interface LibraryAPI {
  stats: () => Promise<LibraryStats>
  formatStats: () => Promise<LibraryFormatStats>
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
  cleanupMissing: () => Promise<{ removed: number; errors: string[] }>
  lyrics: (trackId: number, preference?: LyricsSourcePreference) => Promise<LyricsResult>
  playlists: () => Promise<Playlist[]>
  createPlaylist: (
    name: string,
    trackIds: number[],
    description?: string,
    coverData?: string | null,
    coverMimeType?: string | null,
  ) => Promise<Playlist[] | null>
  renamePlaylist: (playlistId: string, newName: string) => Promise<Playlist[] | null>
  updatePlaylistDetails: (
    playlistId: string,
    updates: {
      name?: string
      description?: string
      coverData?: string | null
      coverMimeType?: string | null
    },
  ) => Promise<Playlist[] | null>
  deletePlaylist: (playlistId: string) => Promise<Playlist[]>
  addTrackToPlaylist: (playlistId: string, trackId: number) => Promise<Playlist[]>
  removeTrackFromPlaylist: (playlistId: string, position: number) => Promise<Playlist[]>
  reorderPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => Promise<Playlist[]>
  smartPlaylists: () => Promise<SmartPlaylist[]>
  evaluateSmartPlaylist: (id: string) => Promise<SmartPlaylist | null>
  previewSmartPlaylist: (input: SmartPlaylistInput) => Promise<Track[]>
  createSmartPlaylist: (input: SmartPlaylistInput) => Promise<SmartPlaylist[] | null>
  updateSmartPlaylist: (id: string, updates: Partial<SmartPlaylistInput>) => Promise<SmartPlaylist[] | null>
  deleteSmartPlaylist: (id: string) => Promise<SmartPlaylist[]>
  favorites: () => Promise<Track[]>
  favoriteIds: () => Promise<number[]>
  toggleFavorite: (trackId: number) => Promise<boolean>
  recentlyPlayed: (limit?: number) => Promise<Track[]>
  clearHistory: () => Promise<void>
  recordPlayback: (trackId: number, durationPlayed?: number) => Promise<void>
  revealFile: (filePath: string) => Promise<boolean>
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

type AppLanguage = 'system' | 'en' | 'pl'
type FullscreenStyle = 'classic' | 'still'
type AmbientRangeMode = 'average' | 'peak'

interface AmbientReactivityConfig {
  enabled: boolean
  freqStart: number
  freqEnd: number
  ampFloor: number
  ampCeiling: number
  spectrumCeiling: number
  spectrumScale: number
  mode: AmbientRangeMode
  release: number
  intensity: number
}

interface AppSettings {
  discordClientId: string
  imgurClientId: string
  discordEnabled: boolean
  libraryRoot: string
  equalizerEnabled: boolean
  equalizerPreset: string
  equalizerBands: number[]
  lyricsSourcePreference: LyricsSourcePreference
  lyricsIgnoreEmbedded: boolean
  playbackRate: number
  preservePitch: boolean
  language: AppLanguage
  fullscreenStyle: FullscreenStyle
  lowPerformanceMode: boolean
  visualizerEnabled: boolean
  ambientReactivity: AmbientReactivityConfig
}

interface PlaybackPreferences {
  playbackRate: number
  preservePitch: boolean
}

interface SettingsAPI {
  get: () => Promise<AppSettings>
  set: (value: Partial<AppSettings>) => Promise<void>
  pickLibraryRoot: () => Promise<string | null>
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
  setEqualizer: (gains: number[]) => Promise<void>
  setPlaybackSpeed: (prefs: Partial<PlaybackPreferences>) => Promise<PlaybackPreferences>
  getPlaybackSpeed: () => Promise<PlaybackPreferences>
  stop: () => Promise<void>
  saveTrackResume: (trackId: number, position: number) => Promise<void>
  getTrackResume: (trackId: number) => Promise<number | null>
  clearTrackResume: (trackId: number) => Promise<void>
  savePlaybackState: (state: Record<string, string>) => Promise<void>
  getPlaybackState: () => Promise<Record<string, string>>
  onStateChange: (cb: (state: PlaybackStateEvent) => void) => () => void
  onTrackEnded: (cb: () => void) => () => void
  getSpectrum: () => number[] | null
}

interface SystemMediaSessionSnapshot {
  title: string
  artist: string
  album: string
  artworkUrl: string | null
  duration: number
  position: number
  isPlaying: boolean
}

interface AppInfo {
  name: string
  version: string
  publisher: string
  websiteUrl: string
  projectUrl: string
  systemLocale?: string
}

interface AppInfoAPI {
  getInfo: () => Promise<AppInfo>
}

declare global {
  interface Window {
    library: LibraryAPI
    settings: SettingsAPI
    discord: DiscordAPI
    playback: PlaybackAPI
    appInfo?: AppInfoAPI
    __iotaplayerMediaControls?: {
      sync?: () => void
      getSnapshot?: () => SystemMediaSessionSnapshot
    }
  }
}

export type {
  Album,
  AmbientRangeMode,
  AmbientReactivityConfig,
  AppInfo,
  AppInfoAPI,
  AppLanguage,
  AppSettings,
  Artist,
  ArtworkResponse,
  DiscordAPI,
  DiscordActivityInput,
  FormatStatBucket,
  FullscreenStyle,
  LibraryAPI,
  LibraryFormatStats,
  LibraryStats,
  LyricLine,
  LyricsFormat,
  LyricsResult,
  LyricsSource,
  LyricsSourcePreference,
  LyricWord,
  PlaybackAPI,
  PlaybackBackendMode,
  PlaybackPreferences,
  PlaybackStateEvent,
  Playlist,
  ScanProgress,
  ScanResult,
  SearchResults,
  SmartPlaylist,
  SmartPlaylistField,
  SmartPlaylistInput,
  SmartPlaylistMatchMode,
  SmartPlaylistOperator,
  SmartPlaylistRule,
  SmartPlaylistSortBy,
  SmartPlaylistSortOrder,
  SyncQuality,
  Track,
}
