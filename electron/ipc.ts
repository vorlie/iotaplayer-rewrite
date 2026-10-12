import { BrowserWindow, ipcMain } from 'electron'
import {
  dbGetAlbum,
  dbGetAlbums,
  dbAddTrackToPlaylist,
  dbCreatePlaylist,
  dbDeletePlaylist,
  dbGetArtist,
  dbGetArtists,
  dbGetArtwork,
  dbGetPlaylists,
  dbGetStats,
  dbGetTracks,
  dbRenamePlaylist,
  dbSearch,
} from './database'
import { getMpv } from './mpv'
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
  LIBRARY_PLAYLISTS: 'library:playlists',
  LIBRARY_CREATE_PLAYLIST: 'library:create-playlist',
  LIBRARY_RENAME_PLAYLIST: 'library:rename-playlist',
  LIBRARY_DELETE_PLAYLIST: 'library:delete-playlist',
  LIBRARY_ADD_TRACK_TO_PLAYLIST: 'library:add-track-to-playlist',
  SCAN_PROGRESS:    'scan:progress',

  PLAYBACK_PLAY:    'playback:play',
  PLAYBACK_PAUSE:   'playback:pause',
  PLAYBACK_RESUME:  'playback:resume',
  PLAYBACK_TOGGLE:  'playback:toggle',
  PLAYBACK_SEEK:    'playback:seek',
  PLAYBACK_VOLUME:  'playback:volume',
  PLAYBACK_STOP:    'playback:stop',
  PLAYBACK_STATE:   'playback:state',
  PLAYBACK_ENDED:   'playback:ended',
} as const

// ---------------------------------------------------------------------------
// Register all IPC handlers
// ---------------------------------------------------------------------------

export function registerIpcHandlers(): void {
  // Setup MPV controller callbacks to push state to renderer
  const mpv = getMpv()
  mpv.setCallbacks(
    (state) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.PLAYBACK_STATE, state)
        }
      })
    },
    () => {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.PLAYBACK_ENDED)
        }
      })
    },
  )

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
      data: Buffer.from(artwork.data).toString('base64'),
    }
  })

  ipcMain.handle(IPC.LIBRARY_PLAYLISTS, () => {
    return dbGetPlaylists()
  })

  ipcMain.handle(IPC.LIBRARY_CREATE_PLAYLIST, (_event, name: string, trackIds: number[]) => {
    return dbCreatePlaylist(name, trackIds)
  })

  ipcMain.handle(IPC.LIBRARY_RENAME_PLAYLIST, (_event, playlistId: string, newName: string) => {
    return dbRenamePlaylist(playlistId, newName)
  })

  ipcMain.handle(IPC.LIBRARY_DELETE_PLAYLIST, (_event, playlistId: string) => {
    return dbDeletePlaylist(playlistId)
  })

  ipcMain.handle(IPC.LIBRARY_ADD_TRACK_TO_PLAYLIST, (_event, playlistId: string, trackId: number) => {
    return dbAddTrackToPlaylist(playlistId, trackId)
  })

  // -------------------------------------------------------------------------
  // Playback handlers
  // -------------------------------------------------------------------------

  ipcMain.handle(IPC.PLAYBACK_PLAY, async (_event, filePath: string) => {
    await mpv.play(filePath)
  })

  ipcMain.handle(IPC.PLAYBACK_PAUSE, () => {
    mpv.pause()
  })

  ipcMain.handle(IPC.PLAYBACK_RESUME, () => {
    mpv.resume()
  })

  ipcMain.handle(IPC.PLAYBACK_TOGGLE, () => {
    mpv.toggle()
  })

  ipcMain.handle(IPC.PLAYBACK_SEEK, (_event, seconds: number) => {
    mpv.seek(seconds)
  })

  ipcMain.handle(IPC.PLAYBACK_VOLUME, (_event, volume: number) => {
    mpv.setVolume(volume)
  })

  ipcMain.handle(IPC.PLAYBACK_STOP, () => {
    mpv.stop()
  })
}
