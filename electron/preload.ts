import { readFileSync } from 'node:fs'
import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import {
  DEFAULT_PLAYBACK_PREFERENCES,
  normalizePlaybackPreferences,
  type PlaybackPreferences,
} from './playbackSpeed'
import { DEFAULT_VOLUME, VolumeController, normalizeVolume } from './volume'
import type {
  Album,
  Artist,
  LibraryFormatStats,
  LibraryStats,
  LyricsResult,
  LyricsSourcePreference,
  PlaybackStateEvent,
  Playlist,
  ScanProgress,
  ScanResult,
  SearchResults,
  SmartPlaylist,
  SmartPlaylistInput,
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

  formatStats: (): Promise<LibraryFormatStats> =>
    ipcRenderer.invoke('library:format-stats'),

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

  cleanupMissing: (): Promise<{ removed: number; errors: string[] }> =>
    ipcRenderer.invoke('library:cleanup-missing'),

  lyrics: (trackId: number, preference?: LyricsSourcePreference): Promise<LyricsResult> =>
    ipcRenderer.invoke('library:lyrics', trackId, preference),

  playlists: (): Promise<Playlist[]> =>
    ipcRenderer.invoke('library:playlists'),

  createPlaylist: (
    name: string,
    trackIds: number[],
    description?: string,
    coverData?: string | null,
    coverMimeType?: string | null,
  ): Promise<Playlist[] | null> =>
    ipcRenderer.invoke('library:create-playlist', name, trackIds, description, coverData, coverMimeType),

  renamePlaylist: (playlistId: string, newName: string): Promise<Playlist[] | null> =>
    ipcRenderer.invoke('library:rename-playlist', playlistId, newName),

  updatePlaylistDetails: (
    playlistId: string,
    updates: {
      name?: string
      description?: string
      coverData?: string | null
      coverMimeType?: string | null
    },
  ): Promise<Playlist[] | null> =>
    ipcRenderer.invoke('library:update-playlist-details', playlistId, updates),

  deletePlaylist: (playlistId: string): Promise<Playlist[]> =>
    ipcRenderer.invoke('library:delete-playlist', playlistId),

  addTrackToPlaylist: (playlistId: string, trackId: number): Promise<Playlist[]> =>
    ipcRenderer.invoke('library:add-track-to-playlist', playlistId, trackId),

  removeTrackFromPlaylist: (playlistId: string, position: number): Promise<Playlist[]> =>
    ipcRenderer.invoke('library:remove-track-from-playlist', playlistId, position),

  reorderPlaylist: (playlistId: string, fromIndex: number, toIndex: number): Promise<Playlist[]> =>
    ipcRenderer.invoke('library:reorder-playlist', playlistId, fromIndex, toIndex),

  smartPlaylists: (): Promise<SmartPlaylist[]> =>
    ipcRenderer.invoke('library:smart-playlists'),

  evaluateSmartPlaylist: (id: string): Promise<SmartPlaylist | null> =>
    ipcRenderer.invoke('library:evaluate-smart-playlist', id),

  previewSmartPlaylist: (input: SmartPlaylistInput): Promise<Track[]> =>
    ipcRenderer.invoke('library:preview-smart-playlist', input),

  createSmartPlaylist: (input: SmartPlaylistInput): Promise<SmartPlaylist[] | null> =>
    ipcRenderer.invoke('library:create-smart-playlist', input),

  updateSmartPlaylist: (id: string, updates: Partial<SmartPlaylistInput>): Promise<SmartPlaylist[] | null> =>
    ipcRenderer.invoke('library:update-smart-playlist', id, updates),

  deleteSmartPlaylist: (id: string): Promise<SmartPlaylist[]> =>
    ipcRenderer.invoke('library:delete-smart-playlist', id),

  favorites: (): Promise<Track[]> =>
    ipcRenderer.invoke('library:favorites'),

  favoriteIds: (): Promise<number[]> =>
    ipcRenderer.invoke('library:favorite-ids'),

  toggleFavorite: (trackId: number): Promise<boolean> =>
    ipcRenderer.invoke('library:toggle-favorite', trackId),

  recentlyPlayed: (limit?: number): Promise<Track[]> =>
    ipcRenderer.invoke('library:recently-played', limit),

  clearHistory: (): Promise<void> =>
    ipcRenderer.invoke('library:clear-history'),

  recordPlayback: (trackId: number, durationPlayed?: number): Promise<void> =>
    ipcRenderer.invoke('library:record-playback', trackId, durationPlayed),

  revealFile: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('library:reveal-file', filePath),

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
let browserVolume = DEFAULT_VOLUME

type PlaybackBackendMode = 'auto' | 'mpv' | 'browser'
let preferredPlaybackBackend: PlaybackBackendMode = 'auto'
let browserPlaybackPreferences: PlaybackPreferences = {
  ...DEFAULT_PLAYBACK_PREFERENCES,
}

type BrowserAudioElement = {
  src: string
  volume: number
  currentTime: number
  duration: number
  paused: boolean
  playbackRate?: number
  defaultPlaybackRate?: number
  preservesPitch?: boolean
  webkitPreservesPitch?: boolean
  mozPreservesPitch?: boolean
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

function applyBrowserPlaybackSpeed(targetAudio: BrowserAudioElement): void {
  const { playbackRate, preservePitch } = browserPlaybackPreferences
  try {
    targetAudio.preservesPitch = preservePitch
    if ('webkitPreservesPitch' in targetAudio) {
      targetAudio.webkitPreservesPitch = preservePitch
    }
    if ('mozPreservesPitch' in targetAudio) {
      targetAudio.mozPreservesPitch = preservePitch
    }
    targetAudio.defaultPlaybackRate = playbackRate
    targetAudio.playbackRate = playbackRate
  } catch {
    // Ignore unsupported audio element properties in minimal test mocks
  }
}

function createRawBrowserAudio(): BrowserAudioElement {
  const AudioCtor = (globalThis as unknown as { Audio: new () => BrowserAudioElement }).Audio
  const audio = new AudioCtor()
  audio.volume = browserVolume
  applyBrowserPlaybackSpeed(audio)
  return audio
}

let browserAudio: BrowserAudioElement = createRawBrowserAudio()

const volumeController = new VolumeController<BrowserAudioElement>({
  initialVolume: DEFAULT_VOLUME,
  createAudioElement: createRawBrowserAudio,
  loadPersistedVolume: async () => {
    const saved = (await ipcRenderer.invoke('playback:get-state')) as Record<string, string> | undefined
    return saved?.volume
  },
  applyMpvVolume: (vol) => ipcRenderer.invoke('playback:volume', vol),
  onVolumeApplied: (vol) => {
    browserVolume = vol
    browserAudio.volume = vol
  },
})

browserAudio = volumeController.setAudioElement(browserAudio)

type AudioContextConstructor = new () => AudioContextLike

interface AudioContextLike {
  state: string
  currentTime: number
  destination: AudioNodeLike
  createAnalyser(): AnalyserNodeLike
  createBiquadFilter(): BiquadFilterNodeLike
  createMediaElementSource(element: unknown): AudioNodeLike
  resume(): Promise<void>
}

interface AudioNodeLike {
  connect(destination: AudioNodeLike): void
}

interface AnalyserNodeLike extends AudioNodeLike {
  fftSize: number
  smoothingTimeConstant: number
  frequencyBinCount: number
  getByteFrequencyData(array: Uint8Array): void
}

interface BiquadFilterNodeLike extends AudioNodeLike {
  type: string
  frequency: { value: number }
  Q: { value: number }
  gain: { value: number; setTargetAtTime: (value: number, startTime: number, timeConstant: number) => void }
}

let audioContext: AudioContextLike | null = null
let analyser: AnalyserNodeLike | null = null
let analyserData: Uint8Array | null = null
let browserAudioSource: AudioNodeLike | null = null
let browserEqualizerNodes: BiquadFilterNodeLike[] = []
let browserEqualizerBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
const browserEqualizerFrequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

function applyBrowserEqualizer(): void {
  if (!audioContext || browserEqualizerNodes.length === 0) return

  const now = audioContext.currentTime
  browserEqualizerNodes.forEach((filter, index) => {
    filter.type = 'peaking'
    filter.frequency.value = browserEqualizerFrequencies[index]
    filter.Q.value = 1
    filter.gain.setTargetAtTime(browserEqualizerBands[index], now, 0.02)
  })
}

function initializeAnalyser(): void {
  if (analyser) return

  const globals = globalThis as typeof globalThis & {
    AudioContext?: AudioContextConstructor
    webkitAudioContext?: AudioContextConstructor
  }

  const AudioContextClass =
    globals.AudioContext ?? globals.webkitAudioContext

  if (!AudioContextClass) return

  const context = new AudioContextClass()
  const nextAnalyser = context.createAnalyser()

  nextAnalyser.fftSize = 2048
  nextAnalyser.smoothingTimeConstant = 0.4

  if (!browserAudioSource) {
    browserAudioSource = context.createMediaElementSource(browserAudio)
  }

  let previousNode: AudioNodeLike = browserAudioSource
  browserEqualizerNodes = browserEqualizerFrequencies.map((frequency) => {
    const filter = context.createBiquadFilter()
    filter.type = 'peaking'
    filter.frequency.value = frequency
    filter.Q.value = 1
    filter.gain.value = 0
    previousNode.connect(filter)
    previousNode = filter
    return filter
  })

  previousNode.connect(nextAnalyser)
  nextAnalyser.connect(context.destination)

  audioContext = context
  analyser = nextAnalyser
  analyserData = new Uint8Array(nextAnalyser.frequencyBinCount)
  applyBrowserEqualizer()
}

function getSpectrum(): number[] | null {
  if (!browserAudioActive || !analyser || !analyserData) {
    return null
  }

  analyser.getByteFrequencyData(analyserData)

  const barCount = 64
  const result: number[] = []

  for (let i = 0; i < barCount; i++) {
    // Spread the bars logarithmically to give bass more room.
    const start = Math.floor((i / barCount) ** 2 * analyserData.length)
    const end = Math.max(
      start + 1,
      Math.floor(((i + 1) / barCount) ** 2 * analyserData.length),
    )

    let peak = 0

    for (let j = start; j < Math.min(end, analyserData.length); j++) {
      peak = Math.max(peak, analyserData[j] / 255)
    }

    result.push(peak)
  }

  return result
}

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
    ;(globalThis as unknown as { URL: typeof URL }).URL.revokeObjectURL(browserObjectUrl)
  }

  const objectUrl = (globalThis as unknown as { URL: typeof URL }).URL.createObjectURL(blob)
  browserObjectUrl = objectUrl
  return objectUrl
}

function emitBrowserState(state: PlaybackStateEvent): void {
  browserStateCallbacks.forEach((cb) => cb({ backend: 'browser', ...state }))
}

function emitBrowserEnded(): void {
  browserEndedCallbacks.forEach((cb) => cb())
}

function attachBrowserAudioEvents(targetAudio: BrowserAudioElement = browserAudio): void {
  targetAudio.volume = volumeController.getVolume()
  applyBrowserPlaybackSpeed(targetAudio)

  targetAudio.onplay = () => {
    const currentVol = volumeController.applyToAudioElement(targetAudio)
    applyBrowserPlaybackSpeed(targetAudio)
    emitBrowserState({
      isPlaying: true,
      position: targetAudio.currentTime || 0,
      duration: Number.isFinite(targetAudio.duration) ? targetAudio.duration : 0,
      volume: currentVol,
    })
  }

  targetAudio.onpause = () => {
    const currentVol = volumeController.applyToAudioElement(targetAudio)
    emitBrowserState({
      isPlaying: false,
      position: targetAudio.currentTime || 0,
      duration: Number.isFinite(targetAudio.duration) ? targetAudio.duration : 0,
      volume: currentVol,
    })
  }

  targetAudio.ontimeupdate = () => {
    const currentVol = volumeController.applyToAudioElement(targetAudio)
    emitBrowserState({
      position: targetAudio.currentTime || 0,
      duration: Number.isFinite(targetAudio.duration) ? targetAudio.duration : 0,
      volume: currentVol,
    })
  }

  targetAudio.onloadedmetadata = () => {
    const currentVol = volumeController.applyToAudioElement(targetAudio)
    applyBrowserPlaybackSpeed(targetAudio)
    emitBrowserState({
      duration: Number.isFinite(targetAudio.duration) ? targetAudio.duration : 0,
      position: targetAudio.currentTime || 0,
      volume: currentVol,
    })
  }

  targetAudio.onended = () => {
    const currentVol = volumeController.applyToAudioElement(targetAudio)
    emitBrowserState({
      isPlaying: false,
      position: targetAudio.duration || 0,
      duration: targetAudio.duration || 0,
      volume: currentVol,
    })
    emitBrowserEnded()
  }
}

attachBrowserAudioEvents(browserAudio)
void volumeController.ensureHydrated()

// ---------------------------------------------------------------------------
// Playback API
// ---------------------------------------------------------------------------

const settingsAPI = {
  get: (): Promise<{
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
    language: 'system' | 'en' | 'pl'
    fullscreenStyle: 'classic' | 'still'
  }> => ipcRenderer.invoke('settings:get'),
  set: (value: {
    discordClientId?: string
    imgurClientId?: string
    discordEnabled?: boolean
    libraryRoot?: string
    equalizerEnabled?: boolean
    equalizerPreset?: string
    equalizerBands?: number[]
    lyricsSourcePreference?: LyricsSourcePreference
    lyricsIgnoreEmbedded?: boolean
    playbackRate?: number
    preservePitch?: boolean
    language?: 'system' | 'en' | 'pl'
    fullscreenStyle?: 'classic' | 'still'
  }): Promise<void> => {
    if (value.playbackRate !== undefined || value.preservePitch !== undefined) {
      browserPlaybackPreferences = normalizePlaybackPreferences(value, browserPlaybackPreferences)
      applyBrowserPlaybackSpeed(browserAudio)
    }
    return ipcRenderer.invoke('settings:set', value)
  },
  pickLibraryRoot: (): Promise<string | null> =>
    ipcRenderer.invoke('settings:pick-library-root'),
}

const discordAPI = {
  setEnabled: (enabled: boolean): Promise<void> => ipcRenderer.invoke('discord:set-enabled', enabled),
  getEnabled: (): Promise<boolean> => ipcRenderer.invoke('discord:get-enabled'),
  setActivity: (payload: {
    details: string
    state: string
    isPlaying: boolean
    album?: string | null
    artist?: string | null
    artworkId?: number | null
    position?: number
    duration?: number
  }): Promise<void> => ipcRenderer.invoke('discord:set-activity', payload),

  clearActivity: (): Promise<void> => ipcRenderer.invoke('discord:clear-activity'),
}

const playbackAPI = {
  getSpectrum,
  getPreferredBackend: (): Promise<PlaybackBackendMode> => Promise.resolve(preferredPlaybackBackend),

  setPreferredBackend: (mode: PlaybackBackendMode): Promise<void> => {
    preferredPlaybackBackend = mode
    return Promise.resolve()
  },

  play: async (filePath: string): Promise<void> => {
    if (shouldUseBrowserAudio(filePath)) {
      if (!browserAudioActive) {
        void ipcRenderer.invoke('playback:stop')
      }
      browserAudioActive = true
      const appliedVolume = await volumeController.prepareForPlayback('browser')
      browserAudio.volume = appliedVolume
      browserAudio.src = toBrowserAudioUrl(filePath)
      browserAudio.load()
      browserAudio.volume = appliedVolume
      applyBrowserPlaybackSpeed(browserAudio)

      try {
        initializeAnalyser()

        if (audioContext?.state === 'suspended') {
          await audioContext.resume()
        }
      } catch (error) {
        console.error('Failed to initialize audio analyser:', error)
      }

      try {
        browserAudio.volume = volumeController.getVolume()
        await browserAudio.play()
      } catch {
        browserAudioActive = false
      }

      return
    }

    if (browserAudioActive) {
      browserAudio.pause()
      browserAudio.currentTime = 0
    }
    browserAudioActive = false
    await volumeController.prepareForPlayback('mpv')
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
      browserAudio.volume = volumeController.getVolume()
      void browserAudio.play()
      return Promise.resolve()
    }
    return ipcRenderer.invoke('playback:resume')
  },

  toggle: (): Promise<void> => {
    if (browserAudioActive) {
      browserAudio.volume = volumeController.getVolume()
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
        volume: volumeController.getVolume(),
      })
      return Promise.resolve()
    }
    return ipcRenderer.invoke('playback:seek', seconds)
  },

  setVolume: (volume: number): Promise<void> => {
    const clamped = volumeController.setVolume(volume)
    if (browserAudioActive) {
      emitBrowserState({ volume: clamped })
    }
    return ipcRenderer.invoke('playback:volume', clamped)
  },

  setEqualizer: (gains: number[]): Promise<void> => {
    const normalized = gains.map((gain) => Math.max(-12, Math.min(12, Number(gain) || 0)))
    browserEqualizerBands = normalized
    if (audioContext && browserEqualizerNodes.length > 0) {
      applyBrowserEqualizer()
    }
    return ipcRenderer.invoke('playback:set-equalizer', normalized)
  },

  setPlaybackSpeed: (
    prefs: Partial<{ playbackRate: number; preservePitch: boolean }>,
  ): Promise<PlaybackPreferences> => {
    const normalized = normalizePlaybackPreferences(prefs, browserPlaybackPreferences)
    browserPlaybackPreferences = normalized
    applyBrowserPlaybackSpeed(browserAudio)
    return ipcRenderer.invoke('playback:set-speed', normalized)
  },

  getPlaybackSpeed: async (): Promise<PlaybackPreferences> => {
    const saved = (await ipcRenderer.invoke('playback:get-speed')) as PlaybackPreferences | undefined
    if (saved) {
      browserPlaybackPreferences = normalizePlaybackPreferences(saved, browserPlaybackPreferences)
      applyBrowserPlaybackSpeed(browserAudio)
    }
    return browserPlaybackPreferences
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

  saveTrackResume: (trackId: number, position: number): Promise<void> =>
    ipcRenderer.invoke('playback:save-resume', trackId, position),

  getTrackResume: (trackId: number): Promise<number | null> =>
    ipcRenderer.invoke('playback:get-resume', trackId),

  clearTrackResume: (trackId: number): Promise<void> =>
    ipcRenderer.invoke('playback:clear-resume', trackId),

  savePlaybackState: (state: Record<string, string>): Promise<void> => {
    if (state.volume !== undefined) {
      const normalized = normalizeVolume(state.volume, volumeController.getVolume())
      volumeController.setVolume(normalized)
    }
    return ipcRenderer.invoke('playback:save-state', state)
  },

  getPlaybackState: async (): Promise<Record<string, string>> => {
    const saved = (await ipcRenderer.invoke('playback:get-state')) as Record<string, string>
    if (saved && saved.volume !== undefined) {
      volumeController.hydrate(saved.volume)
    }
    if (saved && (saved.playbackRate !== undefined || saved.preservePitch !== undefined)) {
      browserPlaybackPreferences = normalizePlaybackPreferences(
        {
          playbackRate: saved.playbackRate,
          preservePitch: saved.preservePitch,
        },
        browserPlaybackPreferences,
      )
      applyBrowserPlaybackSpeed(browserAudio)
    }
    return saved
  },

  onStateChange: (
    cb: (state: PlaybackStateEvent) => void,
  ): (() => void) => {
    browserStateCallbacks.add(cb)
    const handler = (_: IpcRendererEvent, state: PlaybackStateEvent) => {
      if (browserAudioActive && state.backend === 'mpv') return
      if (state.volume !== undefined) {
        volumeController.syncFromBackend(state.volume)
      }
      cb(state)
    }
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

const appInfoAPI = {
  getInfo: (): Promise<{
    name: string
    version: string
    publisher: string
    websiteUrl: string
    projectUrl: string
    systemLocale: string
  }> => ipcRenderer.invoke('app:info'),
}

contextBridge.exposeInMainWorld('library', libraryAPI)
contextBridge.exposeInMainWorld('settings', settingsAPI)
contextBridge.exposeInMainWorld('discord', discordAPI)
contextBridge.exposeInMainWorld('playback', playbackAPI)
contextBridge.exposeInMainWorld('appInfo', appInfoAPI)

export type AppInfoAPI = typeof appInfoAPI
export type LibraryAPI = typeof libraryAPI
export type SettingsAPI = typeof settingsAPI
export type DiscordAPI = typeof discordAPI
export type PlaybackAPI = typeof playbackAPI
