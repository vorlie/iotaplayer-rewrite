import { create } from 'zustand'
import type { Album, Artist, ScanProgress, ScanResult, Track } from '../types/electron'

// ---------------------------------------------------------------------------
// Navigation types
// ---------------------------------------------------------------------------

export type NavSection =
  | 'artists'
  | 'albums'
  | 'tracks'
  | 'favorites'
  | 'recently-played'
  | 'settings'
  | 'artist-detail'
  | 'album-detail'
  | 'search'

export interface NavState {
  section: NavSection
  artistId: number | null
  albumId: number | null
  searchQuery: string
}

// ---------------------------------------------------------------------------
// Library state
// ---------------------------------------------------------------------------

interface LibraryState {
  stats: {
    track_count: number
    album_count: number
    artist_count: number
    total_duration: number
  } | null
  artists: Artist[]
  albums: Album[]
  isLoading: boolean
  scanProgress: ScanProgress | null
  lastScanResult: ScanResult | null
}

// ---------------------------------------------------------------------------
// Full store shape
// ---------------------------------------------------------------------------

interface AppStore {
  // Navigation
  nav: NavState

  // Library
  library: LibraryState

  // Actions — navigation
  navigate: (section: NavSection, opts?: { artistId?: number; albumId?: number }) => void
  setSearch: (query: string) => void

  // Actions — library
  loadStats: () => Promise<void>
  loadArtists: () => Promise<void>
  loadAlbums: (artistId?: number) => Promise<void>
  scanLibrary: (rootDir: string) => Promise<ScanResult>
  setScanProgress: (progress: ScanProgress | null) => void
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useAppStore = create<AppStore>((set, get) => ({
  // ---- Initial state ----
  nav: {
    section: 'albums',
    artistId: null,
    albumId: null,
    searchQuery: '',
  },

  library: {
    stats: null,
    artists: [],
    albums: [],
    isLoading: false,
    scanProgress: null,
    lastScanResult: null,
  },

  // ---- Navigation ----
  navigate: (section, opts) =>
    set((s) => ({
      nav: {
        ...s.nav,
        section,
        artistId: opts?.artistId ?? null,
        albumId: opts?.albumId ?? null,
      },
    })),

  setSearch: (query) =>
    set((s) => ({
      nav: { ...s.nav, section: 'search', searchQuery: query },
    })),

  // ---- Library actions ----
  loadStats: async () => {
    const stats = await window.library.stats()
    set((s) => ({ library: { ...s.library, stats } }))
  },

  loadArtists: async () => {
    set((s) => ({ library: { ...s.library, isLoading: true } }))
    const artists = await window.library.artists()
    set((s) => ({ library: { ...s.library, artists, isLoading: false } }))
  },

  loadAlbums: async (artistId?: number) => {
    set((s) => ({ library: { ...s.library, isLoading: true } }))
    const albums = await window.library.albums(artistId)
    set((s) => ({ library: { ...s.library, albums, isLoading: false } }))
  },

  scanLibrary: async (rootDir: string) => {
    // Subscribe to progress events
    const unsubscribe = window.library.onScanProgress((progress) => {
      get().setScanProgress(progress)
    })

    set((s) => ({
      library: { ...s.library, isLoading: true, scanProgress: null },
    }))

    try {
      const result = await window.library.scan(rootDir)
      set((s) => ({
        library: {
          ...s.library,
          isLoading: false,
          lastScanResult: result,
          scanProgress: null,
        },
      }))

      // Reload data after scan
      await get().loadStats()
      await get().loadAlbums()

      return result
    } finally {
      unsubscribe()
    }
  },

  setScanProgress: (scanProgress) =>
    set((s) => ({ library: { ...s.library, scanProgress } })),
}))

// ---------------------------------------------------------------------------
// Playback store — stub for Phase 7
// ---------------------------------------------------------------------------

export interface PlaybackState {
  currentTrack: Track | null
  isPlaying: boolean
  position: number   // seconds
  duration: number   // seconds
  volume: number     // 0–1
  queue: Track[]
  queueIndex: number
}

interface PlaybackStore extends PlaybackState {
  // These will be wired to MPV in Phase 8
  play: (track: Track, queue?: Track[]) => void
  pause: () => void
  resume: () => void
  toggle: () => void
  next: () => void
  previous: () => void
  seek: (position: number) => void
  setVolume: (volume: number) => void
}

export const usePlaybackStore = create<PlaybackStore>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 0.8,
  queue: [],
  queueIndex: -1,

  play: (track, queue) => {
    const q = queue ?? [track]
    const idx = q.findIndex((t) => t.id === track.id)
    set({ currentTrack: track, queue: q, queueIndex: idx, isPlaying: true, position: 0 })
    console.log(`[Playback] Playing: ${track.title}`)
    // Phase 8: actually tell MPV to play track.path
  },

  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),

  next: () => {
    const { queue, queueIndex } = get()
    const nextIdx = queueIndex + 1
    if (nextIdx < queue.length) {
      const track = queue[nextIdx]
      set({ currentTrack: track, queueIndex: nextIdx, position: 0, isPlaying: true })
    }
  },

  previous: () => {
    const { queue, queueIndex, position } = get()
    // If >3s in, restart; otherwise go to previous
    if (position > 3) {
      set({ position: 0 })
      return
    }
    const prevIdx = queueIndex - 1
    if (prevIdx >= 0) {
      const track = queue[prevIdx]
      set({ currentTrack: track, queueIndex: prevIdx, position: 0, isPlaying: true })
    }
  },

  seek: (position) => set({ position }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
}))
