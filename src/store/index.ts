import { create } from 'zustand'
import { normalizeMediaControlSnapshot } from '../../electron/mediaControls'
import {
  DEFAULT_PLAYBACK_PREFERENCES,
  DEFAULT_PLAYBACK_RATE,
  DEFAULT_PRESERVE_PITCH,
  normalizePlaybackPreferences,
  type PlaybackPreferences,
} from '../../electron/playbackSpeed'
import {
  advanceShuffleNext,
  createEmptyShuffleState,
  createQueueEntryId,
  createQueueEntryIds,
  initShuffleState,
  insertShuffleEntry,
  removeShuffleEntry,
  stepShufflePrevious,
  type ShuffleState,
} from '../../electron/shuffle'
import { DEFAULT_VOLUME, normalizeVolume } from '../../electron/volume'
import i18n from '../i18n'
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
  | 'equalizer'
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

  // Immersive Fullscreen Now Playing overlay
  isFullscreenNowPlaying: boolean
  setFullscreenNowPlaying: (open: boolean) => void
  toggleFullscreenNowPlaying: () => void

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
  cleanupMissingTracks: () => Promise<{ removed: number; errors: string[] }>
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

  isFullscreenNowPlaying: false,
  setFullscreenNowPlaying: (open) => set({ isFullscreenNowPlaying: open }),
  toggleFullscreenNowPlaying: () => set((s) => ({ isFullscreenNowPlaying: !s.isFullscreenNowPlaying })),

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

  cleanupMissingTracks: async () => {
    const result = await window.library.cleanupMissing()
    await get().loadStats()
    await get().loadAlbums()
    return result
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
  queueEntryIds: string[]
  queueIndex: number
  playlistName: string
  repeatMode: PlaybackRepeatMode
  shuffle: boolean
  shuffleState: ShuffleState
  playbackRate: number
  preservePitch: boolean
  playlists: Playlist[]
  activeBackend: 'mpv' | 'browser' | 'idle'
  favoriteIds: number[]
}

interface PlaybackStore extends PlaybackState {
  play: (track: Track, queue?: Track[], playlistName?: string) => void
  playQueue: (tracks: Track[], startTrackId?: number, opts?: { name?: string }) => void
  createPlaylist: (name: string, tracks?: Track[], description?: string) => Playlist | null
  renamePlaylist: (playlistId: string, newName: string) => void
  updatePlaylistDetails: (
    playlistId: string,
    updates: {
      name?: string
      description?: string
      coverData?: string | null
      coverMimeType?: string | null
    },
  ) => void
  deletePlaylist: (playlistId: string) => void
  saveCurrentQueueAsPlaylist: (name?: string) => Playlist | null
  addTrackToPlaylist: (playlistId: string, track: Track) => void
  removeTrackFromPlaylist: (playlistId: string, position: number) => void
  reorderPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void
  playPlaylist: (playlistId: string, startTrackId?: number) => void
  addToQueue: (tracks: Track | Track[]) => void
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
  setPlaybackSpeed: (prefs: Partial<PlaybackPreferences>) => void
  resetPlaybackSpeed: () => void
}

export const usePlaybackStore = create<PlaybackStore>((set, get) => {
  let lastResumeSaveTime = 0
  let cachedArtworkUrl: string | null = null
  let hasUserChangedVolume = false
  let hasUserChangedRepeat = false
  let hasUserChangedShuffle = false
  let hasUserChangedSpeed = false

  const syncSystemMediaSession = async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return
    }

    const { currentTrack, position, isPlaying } = get()
    if (currentTrack && currentTrack.artwork_id != null && 'library' in window) {
      const artwork = await window.library.artwork(currentTrack.artwork_id)
      if (artwork) {
        cachedArtworkUrl = `data:${artwork.mime_type};base64,${artwork.data}`
      }
    } else {
      cachedArtworkUrl = null
    }

    const snapshot = normalizeMediaControlSnapshot({
      title: currentTrack?.title ?? i18n.t('common:fallbacks.unknownTitle'),
      artist: currentTrack?.artist ?? currentTrack?.album_artist ?? i18n.t('common:fallbacks.unknownArtist'),
      album: currentTrack?.album ?? i18n.t('common:fallbacks.unknownAlbum'),
      artworkUrl: cachedArtworkUrl,
      duration: currentTrack?.duration ?? 0,
      position,
      isPlaying,
    })

    const mediaSession = navigator.mediaSession

    if (typeof MediaMetadata !== 'undefined') {
      mediaSession.metadata = new MediaMetadata({
        title: snapshot.title,
        artist: snapshot.artist,
        album: snapshot.album,
        artwork: snapshot.artworkUrl
          ? [{ src: snapshot.artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
          : [],
      })
    }

    mediaSession.playbackState = snapshot.isPlaying ? 'playing' : 'paused'

    if ('setPositionState' in mediaSession) {
      mediaSession.setPositionState({
        duration: snapshot.duration,
        position: snapshot.position,
      })
    }
  }

  if (typeof window !== 'undefined') {
    window.__iotaplayerMediaControls = {
      sync: () => {
        void syncSystemMediaSession()
      },
      getSnapshot: () => {
        const { currentTrack, position, isPlaying } = get()
        return normalizeMediaControlSnapshot({
          title: currentTrack?.title ?? i18n.t('common:fallbacks.unknownTitle'),
          artist: currentTrack?.artist ?? currentTrack?.album_artist ?? i18n.t('common:fallbacks.unknownArtist'),
          album: currentTrack?.album ?? i18n.t('common:fallbacks.unknownAlbum'),
          artworkUrl: cachedArtworkUrl,
          duration: currentTrack?.duration ?? 0,
          position,
          isPlaying,
        })
      },
    }
  }

  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      get().resume()
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      get().pause()
    })
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      get().previous()
    })
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      get().next()
    })
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const seconds = typeof details?.seekTime === 'number' ? details.seekTime : 15
      get().seek(Math.max(0, get().position - seconds))
    })
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const seconds = typeof details?.seekTime === 'number' ? details.seekTime : 15
      get().seek(get().position + seconds)
    })
    navigator.mediaSession.setActionHandler('stop', () => {
      get().pause()
    })
  }

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

      void syncSystemMediaSession()

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

    // Restore saved playback preferences on startup and apply volume to active backends
    void window.playback.getPlaybackState().then((saved) => {
      if (!saved) return
      if (!hasUserChangedVolume && saved.volume !== undefined) {
        const vol = normalizeVolume(saved.volume, get().volume)
        set({ volume: vol })
        void window.playback.setVolume(vol)
      }
      if (!hasUserChangedRepeat && saved.repeatMode && ['off', 'all', 'one'].includes(saved.repeatMode)) {
        set({ repeatMode: saved.repeatMode as PlaybackRepeatMode })
      }
      if (!hasUserChangedShuffle && saved.shuffle !== undefined) {
        const nextShuffle = saved.shuffle === 'true'
        const { queueEntryIds, queueIndex } = get()
        const currentEntryId = queueEntryIds[queueIndex] ?? null
        set({
          shuffle: nextShuffle,
          shuffleState: nextShuffle
            ? initShuffleState(queueEntryIds, currentEntryId)
            : createEmptyShuffleState(),
        })
      }
      if (!hasUserChangedSpeed && (saved.playbackRate !== undefined || saved.preservePitch !== undefined)) {
        const normalized = normalizePlaybackPreferences({
          playbackRate: saved.playbackRate,
          preservePitch: saved.preservePitch,
        })
        set(normalized)
        void window.playback.setPlaybackSpeed(normalized)
      }
    })

    if ('settings' in window) {
      void window.settings.get().then((settings) => {
        if (!settings || hasUserChangedSpeed) return
        const normalized = normalizePlaybackPreferences({
          playbackRate: settings.playbackRate,
          preservePitch: settings.preservePitch,
        })
        set(normalized)
        void window.playback.setPlaybackSpeed(normalized)
      })
    }
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
    const { volume, repeatMode, shuffle, playbackRate, preservePitch } = get()
    void window.playback.savePlaybackState({
      volume: volume.toString(),
      repeatMode,
      shuffle: shuffle ? 'true' : 'false',
      playbackRate: playbackRate.toString(),
      preservePitch: preservePitch ? 'true' : 'false',
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
      state: `${track.artist ?? track.album_artist ?? i18n.t('common:fallbacks.unknownArtist')} • ${track.album ?? i18n.t('common:fallbacks.unknownAlbum')}`,
      isPlaying,
      album: track.album,
      artist: track.artist ?? track.album_artist ?? i18n.t('common:fallbacks.unknownArtist'),
      artworkId: track.artwork_id,
      position: get().position,
      duration: track.duration,
      repeatMode: get().repeatMode,
    })
  }

  const playTrack = (track: Track, queue: Track[], queueIndex: number, playlistName: string): void => {
    const queueEntryIds = createQueueEntryIds(queue.length)
    const currentEntryId = queueEntryIds[queueIndex] ?? null
    const shuffleState = get().shuffle
      ? initShuffleState(queueEntryIds, currentEntryId)
      : createEmptyShuffleState()

    set({
      currentTrack: track,
      queue,
      queueEntryIds,
      queueIndex,
      shuffleState,
      position: 0,
      duration: track.duration,
      isPlaying: true,
      playlistName,
    })

    void syncSystemMediaSession()
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
    volume: DEFAULT_VOLUME,
    queue: [],
    queueEntryIds: [],
    queueIndex: -1,
    playlistName: 'Queue',
    repeatMode: 'off',
    shuffle: false,
    shuffleState: createEmptyShuffleState(),
    playbackRate: DEFAULT_PLAYBACK_RATE,
    preservePitch: DEFAULT_PRESERVE_PITCH,
    activeBackend: 'mpv',
    favoriteIds: [],
    playlists: [
      {
        id: 'favorites',
        name: 'Favorites',
        description: 'Your starred tracks',
        coverData: null,
        coverMimeType: null,
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

    addToQueue: (tracks: Track | Track[]) => {
      const toAdd = Array.isArray(tracks) ? tracks : [tracks]
      if (toAdd.length === 0) return

      const { queue, queueEntryIds, shuffle, shuffleState } = get()
      const newEntryIds = createQueueEntryIds(toAdd.length)
      const nextQueue = [...queue, ...toAdd]
      const nextEntryIds = [...queueEntryIds, ...newEntryIds]

      let nextShuffleState = shuffleState
      if (shuffle) {
        for (const id of newEntryIds) {
          nextShuffleState = insertShuffleEntry(nextShuffleState, id)
        }
      }

      set({
        queue: nextQueue,
        queueEntryIds: nextEntryIds,
        shuffleState: nextShuffleState,
      })
    },

    removeFromQueue: (index: number) => {
      const { queue, queueEntryIds, queueIndex, isPlaying, shuffle, shuffleState } = get()
      if (index < 0 || index >= queue.length) return

      const removedEntryId = queueEntryIds[index]
      const nextQueue = [...queue]
      const nextEntryIds = [...queueEntryIds]
      nextQueue.splice(index, 1)
      nextEntryIds.splice(index, 1)

      if (nextQueue.length === 0) {
        get().pause()
        set({
          queue: [],
          queueEntryIds: [],
          queueIndex: -1,
          currentTrack: null,
          position: 0,
          shuffleState: createEmptyShuffleState(),
        })
        return
      }

      if (index === queueIndex) {
        const nextIndex = Math.min(queueIndex, nextQueue.length - 1)
        const nextTrack = nextQueue[nextIndex]
        const replacementEntryId = nextEntryIds[nextIndex] ?? null
        const nextShuffleState =
          shuffle && removedEntryId
            ? removeShuffleEntry(shuffleState, removedEntryId, replacementEntryId)
            : shuffleState

        set({
          queue: nextQueue,
          queueEntryIds: nextEntryIds,
          queueIndex: nextIndex,
          currentTrack: nextTrack,
          shuffleState: nextShuffleState,
        })
        if (isPlaying && typeof window !== 'undefined' && 'playback' in window) {
          void window.playback.play(nextTrack.path)
        }
      } else {
        const nextQueueIndex = index < queueIndex ? queueIndex - 1 : queueIndex
        const nextShuffleState =
          shuffle && removedEntryId
            ? removeShuffleEntry(shuffleState, removedEntryId)
            : shuffleState

        set({
          queue: nextQueue,
          queueEntryIds: nextEntryIds,
          queueIndex: nextQueueIndex,
          shuffleState: nextShuffleState,
        })
      }
    },

    clearQueue: () => {
      const { currentTrack, queueEntryIds, queueIndex, shuffle } = get()
      // Retain only current track in queue if playing, or clear completely
      if (currentTrack) {
        const currentEntryId = queueEntryIds[queueIndex] ?? createQueueEntryId()
        const nextShuffleState = shuffle
          ? initShuffleState([currentEntryId], currentEntryId)
          : createEmptyShuffleState()
        set({
          queue: [currentTrack],
          queueEntryIds: [currentEntryId],
          queueIndex: 0,
          shuffleState: nextShuffleState,
        })
      } else {
        set({
          queue: [],
          queueEntryIds: [],
          queueIndex: -1,
          shuffleState: createEmptyShuffleState(),
        })
      }
    },

    moveQueueItem: (fromIndex: number, toIndex: number) => {
      const { queue, queueEntryIds, queueIndex } = get()
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

      const nextEntryIds = [...queueEntryIds]
      if (nextEntryIds.length === queue.length) {
        const [entryId] = nextEntryIds.splice(fromIndex, 1)
        nextEntryIds.splice(toIndex, 0, entryId)
      }

      let nextQueueIndex = queueIndex
      if (queueIndex === fromIndex) {
        nextQueueIndex = toIndex
      } else if (fromIndex < queueIndex && toIndex >= queueIndex) {
        nextQueueIndex = queueIndex - 1
      } else if (fromIndex > queueIndex && toIndex <= queueIndex) {
        nextQueueIndex = queueIndex + 1
      }

      set({ queue: nextQueue, queueEntryIds: nextEntryIds, queueIndex: nextQueueIndex })
    },

    createPlaylist: (name, tracks = [], description = '') => {
      const trimmed = name.trim()
      if (!trimmed) return null

      const trimmedDescription = description.trim()
      const persisted = typeof window !== 'undefined' && 'library' in window
        ? window.library.createPlaylist(trimmed, tracks.map((track) => track.id), trimmedDescription)
        : null

      if (!persisted) {
        const playlist: Playlist = {
          id: `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: trimmed,
          description: trimmedDescription,
          coverData: null,
          coverMimeType: null,
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

    updatePlaylistDetails: (playlistId, updates) => {
      if (typeof window !== 'undefined' && 'library' in window) {
        const nextName = updates.name?.trim()
        const nextDescription = updates.description?.trim() ?? updates.description
        void window.library.updatePlaylistDetails(playlistId, {
          ...updates,
          name: nextName !== undefined ? nextName : updates.name,
          description: nextDescription !== undefined ? nextDescription : updates.description,
        }).then((playlists) => {
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
      void syncSystemMediaSession()
      if (typeof window !== 'undefined' && 'playback' in window) {
        void window.playback.pause()
      }
    },

    resume: () => {
      set({ isPlaying: true })
      const { currentTrack } = get()
      updateDiscordPresence(currentTrack, true)
      void syncSystemMediaSession()
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
      const { queue, queueEntryIds, queueIndex, repeatMode, shuffle, shuffleState, currentTrack } = get()
      if (queue.length === 0) return

      if (repeatMode === 'one') {
        const track = currentTrack ?? queue[queueIndex]
        set({ position: 0, isPlaying: true })
        void syncSystemMediaSession()
        if (track) {
          updateDiscordPresence(track, true)
        }
        if (typeof window !== 'undefined' && 'playback' in window) {
          void window.playback.seek(0).then(() => window.playback.resume())
        }
        return
      }

      let nextIndex: number
      let nextShuffleState = shuffleState

      if (shuffle) {
        const result = advanceShuffleNext(shuffleState, queueEntryIds, repeatMode)
        nextShuffleState = result.shuffleState
        if (result.ended || !result.entryId) {
          set({ isPlaying: false, position: 0, shuffleState: nextShuffleState })
          return
        }
        nextIndex = queueEntryIds.indexOf(result.entryId)
        if (nextIndex < 0) {
          set({ isPlaying: false, position: 0, shuffleState: nextShuffleState })
          return
        }
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
      set({
        currentTrack: track,
        queueIndex: nextIndex,
        position: 0,
        duration: track.duration,
        isPlaying: true,
        shuffleState: nextShuffleState,
      })
      void syncSystemMediaSession()
      updateDiscordPresence(track, true)
      if (typeof window !== 'undefined' && 'playback' in window) {
        void window.playback.play(track.path)
        if ('library' in window) {
          void window.library.recordPlayback(track.id)
        }
      }
    },

    previous: () => {
      const { queue, queueEntryIds, queueIndex, position, repeatMode, shuffle, shuffleState } = get()
      if (queue.length === 0) return

      if (position > 3) {
        set({ position: 0 })
        if (typeof window !== 'undefined' && 'playback' in window) {
          void window.playback.seek(0)
        }
        return
      }

      let prevIndex: number
      let nextShuffleState = shuffleState

      if (shuffle) {
        const result = stepShufflePrevious(shuffleState)
        nextShuffleState = result.shuffleState
        if (!result.entryId) {
          return
        }
        prevIndex = queueEntryIds.indexOf(result.entryId)
        if (prevIndex < 0) {
          return
        }
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
      set({
        currentTrack: track,
        queueIndex: prevIndex,
        position: 0,
        duration: track.duration,
        isPlaying: true,
        shuffleState: nextShuffleState,
      })
      void syncSystemMediaSession()
      updateDiscordPresence(track, true)
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
      void syncSystemMediaSession()
      if (typeof window !== 'undefined' && 'playback' in window) {
        void window.playback.seek(clamped)
      }
    },

    setVolume: (volume) => {
      hasUserChangedVolume = true
      const clamped = normalizeVolume(volume, get().volume)
      set({ volume: clamped })
      persistSettings()
      if (typeof window !== 'undefined' && 'playback' in window) {
        void window.playback.setVolume(clamped)
      }
    },

    setRepeatMode: (mode) => {
      hasUserChangedRepeat = true
      set({ repeatMode: mode })
      persistSettings()
    },

    toggleRepeat: () => {
      hasUserChangedRepeat = true
      set((s) => ({
        repeatMode: s.repeatMode === 'off' ? 'all' : s.repeatMode === 'all' ? 'one' : 'off',
      }))
      persistSettings()
    },

    toggleShuffle: () => {
      hasUserChangedShuffle = true
      set((s) => {
        const nextShuffle = !s.shuffle
        const currentEntryId = s.queueEntryIds[s.queueIndex] ?? null
        return {
          shuffle: nextShuffle,
          shuffleState: nextShuffle
            ? initShuffleState(s.queueEntryIds, currentEntryId)
            : createEmptyShuffleState(),
        }
      })
      persistSettings()
    },

    setPlaybackSpeed: (prefs) => {
      hasUserChangedSpeed = true
      const current = get()
      const normalized = normalizePlaybackPreferences(prefs, {
        playbackRate: current.playbackRate,
        preservePitch: current.preservePitch,
      })
      if (
        normalized.playbackRate === current.playbackRate &&
        normalized.preservePitch === current.preservePitch
      ) {
        return
      }
      set(normalized)
      if (typeof window !== 'undefined' && 'playback' in window) {
        void window.playback.setPlaybackSpeed(normalized)
      }
    },

    resetPlaybackSpeed: () => {
      hasUserChangedSpeed = true
      set({ ...DEFAULT_PLAYBACK_PREFERENCES })
      if (typeof window !== 'undefined' && 'playback' in window) {
        void window.playback.setPlaybackSpeed({ ...DEFAULT_PLAYBACK_PREFERENCES })
      }
    },
  }
})
