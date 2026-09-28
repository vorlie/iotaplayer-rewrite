// Type declarations for the contextBridge-exposed library API.
// This file makes window.library fully typed in the renderer.

import type {
  Album,
  Artist,
  LibraryStats,
  ScanProgress,
  ScanResult,
  SearchResults,
  Track,
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
  onScanProgress: (cb: (progress: ScanProgress) => void) => () => void
}

declare global {
  interface Window {
    library: LibraryAPI
  }
}

export type {
  Album,
  Artist,
  ArtworkResponse,
  LibraryAPI,
  LibraryStats,
  ScanProgress,
  ScanResult,
  SearchResults,
  Track,
}
