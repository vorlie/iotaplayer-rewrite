import { create } from 'zustand'
import type { Album, Artist, Playlist, ScanProgress, ScanResult, Track } from '../types/electron'

// ---------------------------------------------------------------------------
// Navigation types
// ---------------------------------------------------------------------------

export type NavSection =
  | 'artists'
  | 'albums'
  | 'tracks'
  | 'playlists'
  | 'playlist-detail'
  | 'now-playing'
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
  playlistId: string | null
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
  navigate: (section: NavSection, opts?: { artistId?: number; albumId?: number; playlistId?: string }) => void
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
    playlistId: null,
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
        playlistId: opts?.playlistId ?? null,
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
// Playback store
// ---------------------------------------------------------------------------

export type PlaybackRepeatMode = 'off' | 'all' | 'one'

export interface PlaybackState {
  currentTrack: Track | null
  isPlaying: boolean
  position: number   // seconds
  duration: number   // seconds
  volume: number     // 0–1
  queue: Track[]
  queueIndex: number
  playlistName: string
  repeatMode: PlaybackRepeatMode
  shuffle: boolean
  playlists: Playlist[]
  activeBackend: 'mpv' | 'browser' | 'idle'
  favoriteIds: number[]
}

interface PlaybackStore extends PlaybackState {
  play: (track: Track, queue?: Track[], playlistName?: string) => void
  playQueue: (tracks: Track[], startTrackId?: number, opts?: { name?: string }) => void
  createPlaylist: (name: string, tracks?: Track[]) => Playlist | null
  renamePlaylist: (playlistId: string, newName: string) => void
  deletePlaylist: (playlistId: string) => void
  saveCurrentQueueAsPlaylist: (name?: string) => Playlist | null
  addTrackToPlaylist: (playlistId: string, track: Track) => void
  removeTrackFromPlaylist: (playlistId: string, position: number) => void
  reorderPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void
  playPlaylist: (playlistId: string, startTrackId?: number) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
  moveQueueItem: (fromIndex: number, toIndex: number) => void
  toggleFavorite: (track: Track) => Promise<boolean>
  loadFavorites: () => Promise<void>
  isFavorite: (trackId: number) => boolean
  pause: () => void
  resume: () => void
  toggle: () => void
  next: () => void
  previous: () => void
  seek: (position: number) => void
  setVolume: (volume: number) => void
  setRepeatMode: (mode: PlaybackRepeatMode) => void
  toggleRepeat: () => void
  toggleShuffle: () => void
}

export const usePlaybackStore = create<PlaybackStore>((set, get) => {
  let lastResumeSaveTime = 0

  if (typeof window !== 'undefined' && 'playback' in window) {
    window.playback.onStateChange((state) => {
      set((s) => ({
        ...s,
        ...(state.isPlaying !== undefined ? { isPlaying: state.isPlaying } : {}),
        ...(state.position !== undefined ? { position: state.position } : {}),
        ...(state.duration !== undefined ? { duration: state.duration } : {}),
        ...(state.volume !== undefined ? { volume: state.volume } : {}),
        ...(state.backend !== undefined ? { activeBackend: state.backend } : {}),
      }))

      // Throttle resume saving: every 5 seconds if position > 5s
      const current = get().currentTrack
      const pos = state.position ?? get().position
      const now = Date.now()
      if (current && pos > 5 && now - lastResumeSaveTime > 5000) {
        lastResumeSaveTime = now
        void window.playback.saveTrackResume(current.id, pos)
      }
    })

    window.playback.onTrackEnded(() => {
      const current = get().currentTrack
      if (current && typeof window !== 'undefined' && 'playback' in window) {
        void window.playback.clearTrackResume(current.id)
      }
      get().next()
    })

    // Restore saved playback preferences on startup
    void window.playback.getPlaybackState().then((saved) => {
      if (!saved) return
      if (saved.volume !== undefined) {
        const vol = parseFloat(saved.volume)
        if (!isNaN(vol)) set({ volume: Math.max(0, Math.min(1, vol)) })
      }
      if (saved.repeatMode && ['off', 'all', 'one'].includes(saved.repeatMode)) {
        set({ repeatMode: saved.repeatMode as PlaybackRepeatMode })
      }
      if (saved.shuffle !== undefined) {
        set({ shuffle: saved.shuffle === 'true' })
      }
    })
  }

  if (typeof window !== 'undefined' && 'library' in window) {
    void window.library.playlists().then((playlists) => {
      set({ playlists })
    })

    void window.library.favoriteIds().then((favoriteIds) => {
      set({ favoriteIds })
    })
  }

  const persistSettings = () => {
    if (typeof window === 'undefined' || !('playback' in window)) return
    const { volume, repeatMode, shuffle } = get()
    void window.playback.savePlaybackState({
      volume: volume.toString(),
      repeatMode,
      shuffle: shuffle ? 'true' : 'false',
    })
  }

  const updateDiscordPresence = (track: Track | null, isPlaying: boolean): void => {
    if (typeof window === 'undefined' || !('discord' in window)) return

    if (!track) {
      void window.discord.clearActivity()
      return
    }

    void window.discord.setActivity({
      details: track.title,
      state: `${track.artist ?? track.album_artist ?? 'Unknown artist'} • ${track.album ?? 'Unknown album'}`,
      isPlaying,
      album: track.album,
      artist: track.artist ?? track.album_artist ?? 'Unknown artist',
      artworkId: track.artwork_id,
      position: get().position,
      duration: track.duration,
      repeatMode: get().repeatMode,
    })
  }

  const playTrack = (track: Track, queue: Track[], queueIndex: number, playlistName: string): void => {
    set({
      currentTrack: track,
      queue,
      queueIndex,
      position: 0,
      duration: track.duration,
      isPlaying: true,
      playlistName,
    })

    updateDiscordPresence(track, true)

    console.log(`[Playback] Playing: ${track.title}`)
    if (typeof window !== 'undefined' && 'playback' in window) {
      void window.playback.play(track.path)

      // Record track play in playback history
      if ('library' in window) {
        void window.library.recordPlayback(track.id)
      }

      // Check track resume position
      void window.playback.getTrackResume(track.id).then((resumePos) => {
        if (resumePos && resumePos > 5 && resumePos < track.duration - 10) {
          console.log(`[Playback] Resuming track ${track.title} at ${resumePos.toFixed(1)}s`)
          setTimeout(() => {
            get().seek(resumePos)
          }, 250)
        }
      })
    }
  }

  return {
    currentTrack: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    volume: 0.8,
    queue: [],
    queueIndex: -1,
    playlistName: 'Queue',
    repeatMode: 'off',
    shuffle: false,
    activeBackend: 'mpv',
    favoriteIds: [],
    playlists: [
      {
        id: 'favorites',
        name: 'Favorites',
        tracks: [],
        createdAt: Date.now(),
      },
    ],

    loadFavorites: async () => {
      if (typeof window !== 'undefined' && 'library' in window) {
        const ids = await window.library.favoriteIds()
        set({ favoriteIds: ids })
      }
    },

    toggleFavorite: async (track: Track) => {
      if (typeof window !== 'undefined' && 'library' in window) {
        const isFav = await window.library.toggleFavorite(track.id)
        set((s) => ({
          favoriteIds: isFav
            ? [...s.favoriteIds, track.id]
            : s.favoriteIds.filter((id) => id !== track.id),
        }))
        return isFav
      }
      return false
    },

    isFavorite: (trackId: number) => {
      return get().favoriteIds.includes(trackId)
    },

    play: (track, queue, playlistName = 'Queue') => {
      const q = queue && queue.length > 0 ? queue : [track]
      const idx = q.findIndex((t) => t.id === track.id)
      const nextQueueIndex = idx >= 0 ? idx : 0
      playTrack(track, q, nextQueueIndex, playlistName)
    },

    playQueue: (tracks, startTrackId, opts) => {
      if (tracks.length === 0) return
      const startIndex =
        startTrackId != null ? tracks.findIndex((track) => track.id === startTrackId) : 0
      const safeIndex = startIndex >= 0 ? startIndex : 0
      const nextTrack = tracks[safeIndex]
      playTrack(nextTrack, tracks, safeIndex, opts?.name ?? 'Queue')
    },

    removeFromQueue: (index: number) => {
      const { queue, queueIndex, isPlaying } = get()
      if (index < 0 || index >= queue.length) return

      const nextQueue = [...queue]
      nextQueue.splice(index, 1)

      if (nextQueue.length === 0) {
        get().pause()
        set({ queue: [], queueIndex: -1, currentTrack: null, position: 0 })
        return
      }

      if (index === queueIndex) {
        const nextIndex = Math.min(queueIndex, nextQueue.length - 1)
        const nextTrack = nextQueue[nextIndex]
        set({ queue: nextQueue, queueIndex: nextIndex, currentTrack: nextTrack })
        if (isPlaying && typeof window !== 'undefined' && 'playback' in window) {
          void window.playback.play(nextTrack.path)
        }
      } else if (index < queueIndex) {
        set({ queue: nextQueue, queueIndex: queueIndex - 1 })
      } else {
        set({ queue: nextQueue })
      }
    },

    clearQueue: () => {
      const { currentTrack } = get()
      // Retain only current track in queue if playing, or clear completely
      if (currentTrack) {
        set({ queue: [currentTrack], queueIndex: 0 })
      } else {
        set({ queue: [], queueIndex: -1 })
      }
    },

    moveQueueItem: (fromIndex: number, toIndex: number) => {
      const { queue, queueIndex } = get()
      if (
        fromIndex < 0 ||
        fromIndex >= queue.length ||
        toIndex < 0 ||
        toIndex >= queue.length ||
        fromIndex === toIndex
      ) {
        return
      }

      const nextQueue = [...queue]
      const [item] = nextQueue.splice(fromIndex, 1)
      nextQueue.splice(toIndex, 0, item)

      let nextQueueIndex = queueIndex
      if (queueIndex === fromIndex) {
        nextQueueIndex = toIndex
      } else if (fromIndex < queueIndex && toIndex >= queueIndex) {
        nextQueueIndex = queueIndex - 1
      } else if (fromIndex > queueIndex && toIndex <= queueIndex) {
        nextQueueIndex = queueIndex + 1
      }

      set({ queue: nextQueue, queueIndex: nextQueueIndex })
    },

    createPlaylist: (name, tracks = []) => {
      const trimmed = name.trim()
      if (!trimmed) return null

      const persisted = typeof window !== 'undefined' && 'library' in window
        ? window.library.createPlaylist(trimmed, tracks.map((track) => track.id))
        : null

      if (!persisted) {
        const playlist: Playlist = {
          id: `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: trimmed,
          tracks,
          createdAt: Date.now(),
        }

        set((s) => ({ playlists: [playlist, ...s.playlists] }))
        return playlist
      }

      void persisted.then((playlists) => {
        if (playlists) {
          set({ playlists })
        }
      })

      return null
    },

    renamePlaylist: (playlistId, newName) => {
      if (typeof window !== 'undefined' && 'library' in window) {
        void window.library.renamePlaylist(playlistId, newName).then((playlists) => {
          if (playlists) set({ playlists })
        })
      }
    },

    deletePlaylist: (playlistId) => {
      if (typeof window !== 'undefined' && 'library' in window) {
        void window.library.deletePlaylist(playlistId).then((playlists) => {
          if (playlists) set({ playlists })
        })
      }
    },

    saveCurrentQueueAsPlaylist: (name) => {
      const { queue } = get()
      if (queue.length === 0) return null
      return get().createPlaylist(name ?? `${get().currentTrack?.title ?? 'Playlist'} queue`, queue)
    },

    addTrackToPlaylist: (playlistId, track) => {
      if (typeof window !== 'undefined' && 'library' in window) {
        void window.library.addTrackToPlaylist(playlistId, track.id).then((playlists) => {
          set({ playlists })
        })
        return
      }

      set((s) => ({
        playlists: s.playlists.map((playlist) =>
          playlist.id === playlistId
            ? { ...playlist, tracks: [...playlist.tracks, track] }
            : playlist,
        ),
      }))
    },

    removeTrackFromPlaylist: (playlistId, position) => {
      if (typeof window !== 'undefined' && 'library' in window) {
        void window.library.removeTrackFromPlaylist(playlistId, position).then((playlists) => {
          if (playlists) set({ playlists })
        })
      }
    },

    reorderPlaylist: (playlistId, fromIndex, toIndex) => {
      if (typeof window !== 'undefined' && 'library' in window) {
        void window.library.reorderPlaylist(playlistId, fromIndex, toIndex).then((playlists) => {
          if (playlists) set({ playlists })
        })
      }
    },

    playPlaylist: (playlistId, startTrackId) => {
      const playlist = get().playlists.find((item) => item.id === playlistId)
      if (!playlist || playlist.tracks.length === 0) return
      get().playQueue(playlist.tracks, startTrackId, { name: playlist.name })
    },

    pause: () => {
      set({ isPlaying: false })
      const { currentTrack } = get()
      updateDiscordPresence(currentTrack, false)
      if (typeof window !== 'undefined' && 'playback' in window) {
        void window.playback.pause()
      }
    },

    resume: () => {
      set({ isPlaying: true })
      const { currentTrack } = get()
      updateDiscordPresence(currentTrack, true)
      if (typeof window !== 'undefined' && 'playback' in window) {
        void window.playback.resume()
      }
    },

    toggle: () => {
      const { isPlaying } = get()
      if (isPlaying) {
        get().pause()
      } else {
        get().resume()
      }
    },

    next: () => {
      const { queue, queueIndex, repeatMode, shuffle } = get()
      if (queue.length === 0) return

      if (repeatMode === 'one') {
        set({ position: 0 })
        if (typeof window !== 'undefined' && 'playback' in window) {
          void window.playback.seek(0)
        }
        return
      }

      let nextIndex: number

      if (shuffle) {
        let randomIndex = queueIndex
        while (randomIndex === queueIndex && queue.length > 1) {
          randomIndex = Math.floor(Math.random() * queue.length)
        }
        nextIndex = randomIndex
      } else {
        nextIndex = queueIndex + 1
        if (nextIndex >= queue.length) {
          if (repeatMode === 'all') {
            nextIndex = 0
          } else {
            set({ isPlaying: false, position: 0 })
            return
          }
        }
      }

      const track = queue[nextIndex]
      set({ currentTrack: track, queueIndex: nextIndex, position: 0, duration: track.duration, isPlaying: true })
      if (typeof window !== 'undefined' && 'playback' in window) {
        void window.playback.play(track.path)
        if ('library' in window) {
          void window.library.recordPlayback(track.id)
        }
      }
    },

    previous: () => {
      const { queue, queueIndex, position, repeatMode, shuffle } = get()
      if (queue.length === 0) return

      if (position > 3) {
        set({ position: 0 })
        if (typeof window !== 'undefined' && 'playback' in window) {
          void window.playback.seek(0)
        }
        return
      }

      let prevIndex: number
      if (shuffle && queue.length > 1) {
        let randomIndex = queueIndex
        while (randomIndex === queueIndex && queue.length > 1) {
          randomIndex = Math.floor(Math.random() * queue.length)
        }
        prevIndex = randomIndex
      } else {
        prevIndex = queueIndex - 1
        if (prevIndex < 0) {
          if (repeatMode === 'all') {
            prevIndex = queue.length - 1
          } else {
            return
          }
        }
      }

      const track = queue[prevIndex]
      set({ currentTrack: track, queueIndex: prevIndex, position: 0, duration: track.duration, isPlaying: true })
      if (typeof window !== 'undefined' && 'playback' in window) {
        void window.playback.play(track.path)
        if ('library' in window) {
          void window.library.recordPlayback(track.id)
        }
      }
    },

    seek: (position) => {
      const clamped = Math.max(0, position)
      set({ position: clamped })
      if (typeof window !== 'undefined' && 'playback' in window) {
        void window.playback.seek(clamped)
      }
    },

    setVolume: (volume) => {
      const clamped = Math.max(0, Math.min(1, volume))
      set({ volume: clamped })
      persistSettings()
      if (typeof window !== 'undefined' && 'playback' in window) {
        void window.playback.setVolume(clamped)
      }
    },

    setRepeatMode: (mode) => {
      set({ repeatMode: mode })
      persistSettings()
    },

    toggleRepeat: () => {
      set((s) => ({
        repeatMode: s.repeatMode === 'off' ? 'all' : s.repeatMode === 'all' ? 'one' : 'off',
      }))
      persistSettings()
    },

    toggleShuffle: () => {
      set((s) => ({ shuffle: !s.shuffle }))
      persistSettings()
    },
  }
})
