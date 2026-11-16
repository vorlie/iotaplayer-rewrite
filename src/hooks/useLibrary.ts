import { useCallback, useEffect, useRef, useState } from 'react'
import { determineSyncQuality } from '../../electron/lyricsSync'
import type { Album, Artist, LyricLine, LyricsResult, Track } from '../types/electron'

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
 * Smoothly interpolates playback position at 60fps via requestAnimationFrame
 * when word-synchronized lyrics are active and audio is playing.
 */
export function useInterpolatedPosition(
  position: number,
  isPlaying: boolean,
  enabled: boolean,
  duration = 0,
): number {
  const [interpolated, setInterpolated] = useState(position)
  const anchorRef = useRef<{ position: number; timestamp: number }>({
    position,
    timestamp: 0,
  })

  useEffect(() => {
    anchorRef.current = {
      position,
      timestamp: performance.now(),
    }
  }, [position, isPlaying])

  useEffect(() => {
    if (!enabled || !isPlaying) return

    let frameId = 0
    const tick = (now: number) => {
      const elapsedSeconds = Math.max(0, (now - anchorRef.current.timestamp) / 1000)
      const rawNext = anchorRef.current.position + elapsedSeconds
      const clampedNext = duration > 0 ? Math.min(duration, rawNext) : rawNext
      setInterpolated(clampedNext)
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [enabled, isPlaying, duration])

  if (!enabled || !isPlaying) {
    return position
  }

  // Guard against stale interpolation right after a manual seek or track change
  if (Math.abs(interpolated - position) > 0.6) {
    return position
  }

  return Math.max(position, interpolated)
}


