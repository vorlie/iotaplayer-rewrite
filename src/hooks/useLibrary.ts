import { useCallback, useEffect, useState } from 'react'
import type { Album, Artist, Track } from '../types/electron'

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
