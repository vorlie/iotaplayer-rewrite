import { readFileSync } from 'node:fs'
import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  Album,
  Artist,
  LibraryStats,
  PlaybackStateEvent,
  Playlist,
  ScanProgress,
  ScanResult,
  SearchResults,
  Track,
} from './types'

// Re-export the artwork response shape
interface ArtworkResponse {
  mime_type: string
  data: string // base64
}

// ---------------------------------------------------------------------------
// Library API
// ---------------------------------------------------------------------------

const libraryAPI = {
  stats: (): Promise<LibraryStats> =>
    ipcRenderer.invoke('library:stats'),

  scan: (rootDir: string): Promise<ScanResult> =>
    ipcRenderer.invoke('library:scan', rootDir),

  artists: (): Promise<Artist[]> =>
    ipcRenderer.invoke('library:artists'),

  artist: (id: number): Promise<Artist | null> =>
    ipcRenderer.invoke('library:artist', id),

  albums: (artistId?: number): Promise<Album[]> =>
    ipcRenderer.invoke('library:albums', artistId),

  album: (id: number): Promise<Album | null> =>
    ipcRenderer.invoke('library:album', id),

  tracks: (opts?: {
    albumId?: number
    artistId?: number
    limit?: number
    offset?: number
  }): Promise<Track[]> =>
    ipcRenderer.invoke('library:tracks', opts),

  search: (query: string): Promise<SearchResults> =>
    ipcRenderer.invoke('library:search', query),

  artwork: (id: number): Promise<ArtworkResponse | null> =>
    ipcRenderer.invoke('library:artwork', id),

  playlists: (): Promise<Playlist[]> =>
    ipcRenderer.invoke('library:playlists'),

  createPlaylist: (name: string, trackIds: number[]): Promise<Playlist[] | null> =>
    ipcRenderer.invoke('library:create-playlist', name, trackIds),

  renamePlaylist: (playlistId: string, newName: string): Promise<Playlist[] | null> =>
    ipcRenderer.invoke('library:rename-playlist', playlistId, newName),

  deletePlaylist: (playlistId: string): Promise<Playlist[]> =>
    ipcRenderer.invoke('library:delete-playlist', playlistId),

  addTrackToPlaylist: (playlistId: string, trackId: number): Promise<Playlist[]> =>
    ipcRenderer.invoke('library:add-track-to-playlist', playlistId, trackId),

  onScanProgress: (
    cb: (progress: ScanProgress) => void,
  ): (() => void) => {
    const handler = (_: IpcRendererEvent, progress: ScanProgress) => cb(progress)
    ipcRenderer.on('scan:progress', handler)
    return () => ipcRenderer.removeListener('scan:progress', handler)
  },
}

// ---------------------------------------------------------------------------
// Browser audio fallback
// ---------------------------------------------------------------------------

const browserStateCallbacks = new Set<(state: PlaybackStateEvent) => void>()
const browserEndedCallbacks = new Set<() => void>()
let browserAudioActive = false
let browserObjectUrl: string | null = null
let browserVolume = 0.8

type PlaybackBackendMode = 'auto' | 'mpv' | 'browser'
let preferredPlaybackBackend: PlaybackBackendMode = 'auto'

type BrowserAudioElement = {
  src: string
  volume: number
  currentTime: number
  duration: number
  paused: boolean
  canPlayType: (mime: string) => string
  play: () => Promise<void> | void
  pause: () => void
  load: () => void
  onplay: (() => void) | null
  onpause: (() => void) | null
  ontimeupdate: (() => void) | null
  onloadedmetadata: (() => void) | null
  onended: (() => void) | null
}

const browserAudio = new (globalThis as any).Audio() as BrowserAudioElement

const browserMimeMap: Array<[string[], string]> = [
  [['.aac', '.mp4', '.m4a', '.mov', '.3gp'], 'audio/aac'],
  [['.alac'], 'audio/mp4'],
  [['.flac'], 'audio/flac'],
  [['.mp3', '.mpeg'], 'audio/mpeg'],
  [['.opus', '.ogg', '.oga', '.webm'], 'audio/ogg'],
  [['.vorbis'], 'audio/ogg'],
  [['.wav'], 'audio/wav'],
]

function isWaveFile(filePath: string): boolean {
  const normalized = filePath.toLowerCase()
  return normalized.endsWith('.wav')
}

function getBrowserAudioSupport(filePath: string): boolean {
  if (isWaveFile(filePath)) return false

  const normalized = filePath.toLowerCase()
  const match = browserMimeMap.find(([extensions]) =>
    extensions.some((extension) => normalized.endsWith(extension)),
  )

  if (!match) return false

  const [, mimeType] = match
  return browserAudio.canPlayType(mimeType) !== ''
}

function shouldUseBrowserAudio(filePath: string): boolean {
  if (isWaveFile(filePath)) return false

  if (preferredPlaybackBackend === 'mpv') return false
  if (preferredPlaybackBackend === 'browser') return getBrowserAudioSupport(filePath)

  return getBrowserAudioSupport(filePath)
}

function toBrowserAudioUrl(filePath: string): string {
  const normalized = filePath.toLowerCase()
  const match = browserMimeMap.find(([extensions]) =>
    extensions.some((extension) => normalized.endsWith(extension)),
  )

  const mimeType = match?.[1] ?? 'application/octet-stream'
  const blob = new Blob([readFileSync(filePath)], { type: mimeType })

  if (browserObjectUrl) {
    ;(globalThis as any).URL.revokeObjectURL(browserObjectUrl)
  }

  const objectUrl = (globalThis as any).URL.createObjectURL(blob) as string
  browserObjectUrl = objectUrl
  return objectUrl
}

function emitBrowserState(state: PlaybackStateEvent): void {
  browserStateCallbacks.forEach((cb) => cb(state))
}

function emitBrowserEnded(): void {
  browserEndedCallbacks.forEach((cb) => cb())
}

function attachBrowserAudioEvents(): void {
  browserAudio.onplay = () => {
    emitBrowserState({
      isPlaying: true,
      position: browserAudio.currentTime || 0,
      duration: Number.isFinite(browserAudio.duration) ? browserAudio.duration : 0,
      volume: browserAudio.volume,
    })
  }

  browserAudio.onpause = () => {
    emitBrowserState({
      isPlaying: false,
      position: browserAudio.currentTime || 0,
      duration: Number.isFinite(browserAudio.duration) ? browserAudio.duration : 0,
      volume: browserAudio.volume,
    })
  }

  browserAudio.ontimeupdate = () => {
    emitBrowserState({
      position: browserAudio.currentTime || 0,
      duration: Number.isFinite(browserAudio.duration) ? browserAudio.duration : 0,
      volume: browserAudio.volume,
    })
  }

  browserAudio.onloadedmetadata = () => {
    emitBrowserState({
      duration: Number.isFinite(browserAudio.duration) ? browserAudio.duration : 0,
      position: browserAudio.currentTime || 0,
      volume: browserAudio.volume,
    })
  }

  browserAudio.onended = () => {
    emitBrowserState({
      isPlaying: false,
      position: browserAudio.duration || 0,
      duration: browserAudio.duration || 0,
      volume: browserAudio.volume,
    })
    emitBrowserEnded()
  }
}

attachBrowserAudioEvents()

// ---------------------------------------------------------------------------
// Playback API
// ---------------------------------------------------------------------------

const playbackAPI = {
  getPreferredBackend: (): Promise<PlaybackBackendMode> => Promise.resolve(preferredPlaybackBackend),

  setPreferredBackend: (mode: PlaybackBackendMode): Promise<void> => {
    preferredPlaybackBackend = mode
    return Promise.resolve()
  },

  play: async (filePath: string): Promise<void> => {
    if (shouldUseBrowserAudio(filePath)) {
      browserAudioActive = true
      browserAudio.volume = browserVolume
      browserAudio.src = toBrowserAudioUrl(filePath)
      browserAudio.load()
      try {
        await browserAudio.play()
      } catch {
        browserAudioActive = false
      }
      return
    }

    browserAudioActive = false
    await ipcRenderer.invoke('playback:play', filePath)
  },

  pause: (): Promise<void> => {
    if (browserAudioActive) {
      browserAudio.pause()
      return Promise.resolve()
    }
    return ipcRenderer.invoke('playback:pause')
  },

  resume: (): Promise<void> => {
    if (browserAudioActive) {
      void browserAudio.play()
      return Promise.resolve()
    }
    return ipcRenderer.invoke('playback:resume')
  },

  toggle: (): Promise<void> => {
    if (browserAudioActive) {
      if (browserAudio.paused) {
        void browserAudio.play()
      } else {
        browserAudio.pause()
      }
      return Promise.resolve()
    }
    return ipcRenderer.invoke('playback:toggle')
  },

  seek: (seconds: number): Promise<void> => {
    if (browserAudioActive) {
      browserAudio.currentTime = Math.max(0, seconds)
      emitBrowserState({
        position: browserAudio.currentTime,
        duration: Number.isFinite(browserAudio.duration) ? browserAudio.duration : 0,
        volume: browserAudio.volume,
      })
      return Promise.resolve()
    }
    return ipcRenderer.invoke('playback:seek', seconds)
  },

  setVolume: (volume: number): Promise<void> => {
    const clamped = Math.max(0, Math.min(1, volume))
    browserVolume = clamped

    if (browserAudioActive) {
      browserAudio.volume = clamped
      emitBrowserState({ volume: browserAudio.volume })
      return Promise.resolve()
    }
    return ipcRenderer.invoke('playback:volume', clamped)
  },

  stop: (): Promise<void> => {
    if (browserAudioActive) {
      browserAudio.pause()
      browserAudio.currentTime = 0
      browserAudioActive = false
      emitBrowserState({ isPlaying: false, position: 0, duration: browserAudio.duration || 0, volume: browserAudio.volume })
      return Promise.resolve()
    }
    return ipcRenderer.invoke('playback:stop')
  },

  onStateChange: (
    cb: (state: PlaybackStateEvent) => void,
  ): (() => void) => {
    browserStateCallbacks.add(cb)
    const handler = (_: IpcRendererEvent, state: PlaybackStateEvent) => cb(state)
    ipcRenderer.on('playback:state', handler)
    return () => {
      browserStateCallbacks.delete(cb)
      ipcRenderer.removeListener('playback:state', handler)
    }
  },

  onTrackEnded: (
    cb: () => void,
  ): (() => void) => {
    browserEndedCallbacks.add(cb)
    const handler = () => cb()
    ipcRenderer.on('playback:ended', handler)
    return () => {
      browserEndedCallbacks.delete(cb)
      ipcRenderer.removeListener('playback:ended', handler)
    }
  },
}

contextBridge.exposeInMainWorld('library', libraryAPI)
contextBridge.exposeInMainWorld('playback', playbackAPI)

export type LibraryAPI = typeof libraryAPI
export type PlaybackAPI = typeof playbackAPI
