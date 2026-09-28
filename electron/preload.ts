import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  Album,
  Artist,
  LibraryStats,
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
// Exposed API surface — the ONLY thing the renderer can use
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

  onScanProgress: (
    cb: (progress: ScanProgress) => void,
  ): (() => void) => {
    const handler = (_: IpcRendererEvent, progress: ScanProgress) => cb(progress)
    ipcRenderer.on('scan:progress', handler)
    return () => ipcRenderer.removeListener('scan:progress', handler)
  },
}

contextBridge.exposeInMainWorld('library', libraryAPI)

// Make TypeScript happy in the renderer
export type LibraryAPI = typeof libraryAPI
