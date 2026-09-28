import { BrowserWindow, ipcMain } from 'electron'
import {
  dbGetAlbum,
  dbGetAlbums,
  dbGetArtist,
  dbGetArtists,
  dbGetArtwork,
  dbGetStats,
  dbGetTracks,
  dbSearch,
} from './database'
import { scanLibrary } from './scanner'
import type { ScanProgress } from './types'

// ---------------------------------------------------------------------------
// IPC channel names (must match preload.ts)
// ---------------------------------------------------------------------------

export const IPC = {
  LIBRARY_STATS:    'library:stats',
  LIBRARY_SCAN:     'library:scan',
  LIBRARY_ARTISTS:  'library:artists',
  LIBRARY_ARTIST:   'library:artist',
  LIBRARY_ALBUMS:   'library:albums',
  LIBRARY_ALBUM:    'library:album',
  LIBRARY_TRACKS:   'library:tracks',
  LIBRARY_SEARCH:   'library:search',
  LIBRARY_ARTWORK:  'library:artwork',
  SCAN_PROGRESS:    'scan:progress',
} as const

// ---------------------------------------------------------------------------
// Register all IPC handlers
// ---------------------------------------------------------------------------

export function registerIpcHandlers(): void {
  // library.stats()
  ipcMain.handle(IPC.LIBRARY_STATS, () => {
    return dbGetStats()
  })

  // library.scan(rootDir)
  ipcMain.handle(IPC.LIBRARY_SCAN, async (event, rootDir: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)

    const result = await scanLibrary(rootDir, (progress: ScanProgress) => {
      win?.webContents.send(IPC.SCAN_PROGRESS, progress)
    })

    return result
  })

  // library.artists()
  ipcMain.handle(IPC.LIBRARY_ARTISTS, () => {
    return dbGetArtists()
  })

  // library.artist(id)
  ipcMain.handle(IPC.LIBRARY_ARTIST, (_event, id: number) => {
    return dbGetArtist(id)
  })

  // library.albums(artistId?)
  ipcMain.handle(IPC.LIBRARY_ALBUMS, (_event, artistId?: number) => {
    return dbGetAlbums(artistId)
  })

  // library.album(id)
  ipcMain.handle(IPC.LIBRARY_ALBUM, (_event, id: number) => {
    return dbGetAlbum(id)
  })

  // library.tracks({ albumId?, artistId?, limit?, offset? })
  ipcMain.handle(
    IPC.LIBRARY_TRACKS,
    (
      _event,
      opts?: { albumId?: number; artistId?: number; limit?: number; offset?: number },
    ) => {
      return dbGetTracks(opts)
    },
  )

  // library.search(query)
  ipcMain.handle(IPC.LIBRARY_SEARCH, (_event, query: string) => {
    return dbSearch(query)
  })

  // library.artwork(id)  — returns { mime_type, data } with data as base64
  ipcMain.handle(IPC.LIBRARY_ARTWORK, (_event, id: number) => {
    const artwork = dbGetArtwork(id)
    if (!artwork) return null
    return {
      mime_type: artwork.mime_type,
      data: (artwork.data as Buffer).toString('base64'),
    }
  })
}
