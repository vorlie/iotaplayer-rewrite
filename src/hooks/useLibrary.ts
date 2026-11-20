import { useCallback, useEffect, useRef, useState } from 'react'
import {
  determineSyncQuality,
  getActiveLyricIndex,
  getActiveWordIndex,
} from '../../electron/lyricsSync'
import {
  DEFAULT_PLAYBACK_RATE,
  interpolateMediaPosition,
  normalizePlaybackRate,
} from '../../electron/playbackSpeed'
import type { Album, Artist, LyricLine, LyricsResult, Track } from '../types/electron'
import { useAppStore } from '../store'

// Convenience hook for loading data from the IPC bridge
export function useArtists() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.library.artists().then((data) => {
      if (!cancelled) {
        setArtists(data)
        setLoaded(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { artists, loading: !loaded }
}

export function useAlbums(artistId?: number) {
  const [data, setData] = useState<{ artistId?: number; albums: Album[]; loaded: boolean }>({
    artistId,
    albums: [],
    loaded: false,
  })

  useEffect(() => {
    let cancelled = false
    window.library.albums(artistId).then((albums) => {
      if (!cancelled) {
        setData({ artistId, albums, loaded: true })
      }
    })
    return () => {
      cancelled = true
    }
  }, [artistId])

  const loading = !data.loaded || data.artistId !== artistId
  return { albums: data.artistId === artistId ? data.albums : [], loading }
}

export function useAlbum(id: number | null) {
  const [data, setData] = useState<{ id: number | null; album: Album | null }>({
    id: null,
    album: null,
  })

  useEffect(() => {
    if (id == null) return
    let cancelled = false
    window.library.album(id).then((album) => {
      if (!cancelled) {
        setData({ id, album })
      }
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const loading = id != null && data.id !== id
  return { album: data.id === id ? data.album : null, loading }
}

export function useArtist(id: number | null) {
  const [data, setData] = useState<{ id: number | null; artist: Artist | null }>({
    id: null,
    artist: null,
  })

  useEffect(() => {
    if (id == null) return
    let cancelled = false
    window.library.artist(id).then((artist) => {
      if (!cancelled) {
        setData({ id, artist })
      }
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const loading = id != null && data.id !== id
  return { artist: data.id === id ? data.artist : null, loading }
}

export function useTracks(opts?: {
  albumId?: number
  artistId?: number
  limit?: number
}) {
  const albumId = opts?.albumId
  const artistId = opts?.artistId
  const limit = opts?.limit
  const currentKey = `${albumId ?? ''}:${artistId ?? ''}:${limit ?? ''}`

  const [data, setData] = useState<{
    key: string
    tracks: Track[]
  }>({
    key: '',
    tracks: [],
  })

  useEffect(() => {
    let cancelled = false
    window.library.tracks({ albumId, artistId, limit }).then((tracks) => {
      if (!cancelled) {
        setData({ key: currentKey, tracks })
      }
    })
    return () => {
      cancelled = true
    }
  }, [albumId, artistId, limit, currentKey])

  const loading = data.key !== currentKey
  return { tracks: data.key === currentKey ? data.tracks : [], loading }
}

// Artwork cache to avoid re-fetching the same artwork repeatedly
const artworkCache = new Map<number, string>()

export function useArtwork(id: number | null | undefined) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (id == null) return

    const cached = artworkCache.get(id)
    if (cached) return

    let cancelled = false
    window.library.artwork(id).then((result) => {
      if (!cancelled && result) {
        const dataUrl = `data:${result.mime_type};base64,${result.data}`
        artworkCache.set(id, dataUrl)
        setSrc(dataUrl)
      }
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (id == null) return null
  return artworkCache.get(id) ?? src
}

// Format seconds → M:SS or H:MM:SS
export function useFormatDuration() {
  return useCallback((seconds: number): string => {
    const s = Math.floor(seconds)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    }
    return `${m}:${String(sec).padStart(2, '0')}`
  }, [])
}

const EMPTY_LYRICS: LyricsResult = {
  source: null,
  format: null,
  syncQuality: 'none',
  lines: [],
  synchronized: false,
}

const lyricsReloadListeners = new Set<() => void>()

export function notifyLyricsReload(): void {
  lyricsReloadListeners.forEach((listener) => listener())
}

function normalizeLyrics(result: LyricsResult): LyricsResult {
  if (!result || !result.lines || !result.lines.length) {
    return { ...EMPTY_LYRICS }
  }

  const lines: LyricLine[] = []
  for (const line of result.lines) {
    const isGap = Boolean(line.isGap || (!line.text && line.timestamp != null))
    if (isGap && lines.length > 0 && (lines[lines.length - 1].isGap || !lines[lines.length - 1].text)) {
      continue
    }
    lines.push(isGap ? { ...line, isGap: true, text: '' } : line)
  }

  const syncQuality = result.syncQuality ?? determineSyncQuality(lines)
  const synchronized = Boolean(result.synchronized && syncQuality !== 'none')

  return {
    ...result,
    format: result.format ?? null,
    syncQuality,
    synchronized,
    lines,
  }
}

export function useLyrics(trackId: number | null | undefined) {
  const [data, setData] = useState<{ id: number | null; reloadKey: number; lyrics: LyricsResult }>({
    id: null,
    reloadKey: -1,
    lyrics: EMPTY_LYRICS,
  })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const listener = () => setReloadKey((k) => k + 1)
    lyricsReloadListeners.add(listener)
    return () => {
      lyricsReloadListeners.delete(listener)
    }
  }, [])

  useEffect(() => {
    if (trackId == null) return

    let cancelled = false
    window.library.lyrics(trackId)
      .then((result) => {
        if (!cancelled) {
          const normalized = normalizeLyrics(result)
          setData({ id: trackId, reloadKey, lyrics: normalized })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({ id: trackId, reloadKey, lyrics: EMPTY_LYRICS })
        }
      })

    return () => {
      cancelled = true
    }
  }, [trackId, reloadKey])

  const reload = useCallback(() => {
    if (trackId != null) {
      notifyLyricsReload()
    }
  }, [trackId])

  const lyrics = data.id === trackId ? data.lyrics : EMPTY_LYRICS
  const loading = trackId != null && (data.id !== trackId || data.reloadKey !== reloadKey)

  return { lyrics, loading, reload }
}

/**
 * Checks word-level lyric boundaries at 60fps via requestAnimationFrame while audio
 * is playing, but only triggers a React state update when the active lyric line or
 * active word index actually changes. This provides sub-16ms word sync accuracy
 * without 60fps React re-renders or paint thrashing.
 */
export function useInterpolatedPosition(
  position: number,
  isPlaying: boolean,
  lyrics: LyricsResult,
  enabled = true,
  duration = 0,
  playbackRate = DEFAULT_PLAYBACK_RATE,
): number {
  const safeRate = normalizePlaybackRate(playbackRate, DEFAULT_PLAYBACK_RATE)
  const lowPerformanceMode = useAppStore((s) => s.lowPerformanceMode)
  const isSynced = enabled && lyrics.synchronized && lyrics.lines.length > 0
  const [syncPosition, setSyncPosition] = useState(position)
  const anchorRef = useRef<{
    position: number
    timestamp: number
    highWaterMark: number
    lastLineIdx: number
    lastWordIdx: number
    lastRate: number
    lastLyrics: LyricsResult
  }>({
    position,
    timestamp: 0,
    highWaterMark: position,
    lastLineIdx: -1,
    lastWordIdx: -1,
    lastRate: safeRate,
    lastLyrics: lyrics,
  })

  useEffect(() => {
    const now = performance.now()
    const prev = anchorRef.current
    const lyricsChanged = prev.lastLyrics !== lyrics
    const forwardThreshold = 0.6 * Math.max(1, safeRate)
    const isBackwardSeek = position < prev.position - 0.25 || position < prev.highWaterMark - 0.6
    const isForwardSeek = position > prev.highWaterMark + forwardThreshold

    // If only playbackRate changed mid-playback without a new position tick, re-anchor from highWaterMark
    const rateChangedOnly = !lyricsChanged && prev.lastRate !== safeRate && position === prev.position
    const basePosition = rateChangedOnly ? prev.highWaterMark : position
    const nextHighWater =
      lyricsChanged || isBackwardSeek || isForwardSeek
        ? position
        : Math.max(prev.highWaterMark, basePosition)

    anchorRef.current = {
      position: basePosition,
      timestamp: now,
      highWaterMark: nextHighWater,
      // Keep lastLineIdx/lastWordIdx from the last rendered syncPosition (reset on seek/track change)
      // so the rAF loop never skips emitting setSyncPosition for a newly entered line.
      lastLineIdx: lyricsChanged || isBackwardSeek || isForwardSeek ? -1 : prev.lastLineIdx,
      lastWordIdx: lyricsChanged || isBackwardSeek || isForwardSeek ? -1 : prev.lastWordIdx,
      lastRate: safeRate,
      lastLyrics: lyrics,
    }
  }, [position, isPlaying, isSynced, lyrics, safeRate])

  useEffect(() => {
    if (!isSynced || !isPlaying) return

    let frameId = 0
    let lastCheckMs = 0
    const minIntervalMs = lowPerformanceMode ? 100 : 0
    const tick = (now: number) => {
      if (minIntervalMs > 0 && now - lastCheckMs < minIntervalMs) {
        frameId = window.requestAnimationFrame(tick)
        return
      }
      lastCheckMs = now
      const anchor = anchorRef.current
      const rawNext = interpolateMediaPosition({
        anchorPosition: anchor.position,
        anchorTimestampMs: anchor.timestamp,
        nowMs: now,
        highWaterMark: anchor.highWaterMark,
        playbackRate: safeRate,
        duration,
      })
      // Bound interpolation drift ahead of the last reported audio position so brief stalls never skip lines
      const maxDriftAhead = 0.35 * Math.max(1, safeRate)
      const clampedNext = Math.min(rawNext, anchor.position + maxDriftAhead)
      anchor.highWaterMark = clampedNext

      const lineIdx = getActiveLyricIndex(lyrics, clampedNext)
      const line = lineIdx >= 0 ? lyrics.lines[lineIdx] : null
      const nextLineTs = lineIdx >= 0 ? lyrics.lines[lineIdx + 1]?.timestamp : undefined
      const wordIdx =
        !lowPerformanceMode && line ? getActiveWordIndex(line, clampedNext, nextLineTs) : -1

      if (lineIdx !== anchor.lastLineIdx || wordIdx !== anchor.lastWordIdx) {
        anchor.lastLineIdx = lineIdx
        anchor.lastWordIdx = wordIdx
        setSyncPosition(clampedNext)
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [isSynced, isPlaying, lyrics, duration, safeRate, lowPerformanceMode])

  if (!isSynced || !isPlaying) {
    return position
  }

  const maxAhead = 0.4 * Math.max(1, safeRate)
  // Snap to real position if we sought backward, changed tracks, or drifted ahead
  if (position < syncPosition - 0.35 || position > syncPosition + maxAhead) {
    return position
  }

  return Math.max(position, syncPosition)
}


