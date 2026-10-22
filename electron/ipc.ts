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
  dbRemoveTrackFromPlaylist,
  dbReorderPlaylist,
  dbGetFavorites,
  dbGetFavoriteIds,
  dbToggleFavorite,
  dbRecordPlayback,
  dbGetRecentlyPlayed,
  dbClearPlaybackHistory,
  dbSaveTrackResume,
  dbGetTrackResume,
  dbClearTrackResume,
  dbSetPlaybackState,
  dbGetAllPlaybackState,
} from './database'
import { discordPresence } from './discord'
import { getMpv } from './mpv'
import { scanLibrary } from './scanner'
import { getAppSettings, setAppSettings } from './settings'
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
  LIBRARY_REMOVE_TRACK_FROM_PLAYLIST: 'library:remove-track-from-playlist',
  LIBRARY_REORDER_PLAYLIST: 'library:reorder-playlist',
  LIBRARY_FAVORITES: 'library:favorites',
  LIBRARY_FAVORITE_IDS: 'library:favorite-ids',
  LIBRARY_TOGGLE_FAVORITE: 'library:toggle-favorite',
  LIBRARY_RECENTLY_PLAYED: 'library:recently-played',
  LIBRARY_CLEAR_HISTORY: 'library:clear-history',
  LIBRARY_RECORD_PLAYBACK: 'library:record-playback',
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
  PLAYBACK_SAVE_RESUME: 'playback:save-resume',
  PLAYBACK_GET_RESUME:  'playback:get-resume',
  PLAYBACK_CLEAR_RESUME: 'playback:clear-resume',
  PLAYBACK_SAVE_STATE:  'playback:save-state',
  PLAYBACK_GET_STATE:   'playback:get-state',
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
          win.webContents.send(IPC.PLAYBACK_STATE, { ...state, backend: 'mpv' })
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

  ipcMain.handle(IPC.LIBRARY_REMOVE_TRACK_FROM_PLAYLIST, (_event, playlistId: string, position: number) => {
    return dbRemoveTrackFromPlaylist(playlistId, position)
  })

  ipcMain.handle(
    IPC.LIBRARY_REORDER_PLAYLIST,
    (_event, playlistId: string, fromIndex: number, toIndex: number) => {
      return dbReorderPlaylist(playlistId, fromIndex, toIndex)
    },
  )

  ipcMain.handle(IPC.LIBRARY_FAVORITES, () => {
    return dbGetFavorites()
  })

  ipcMain.handle(IPC.LIBRARY_FAVORITE_IDS, () => {
    return dbGetFavoriteIds()
  })

  ipcMain.handle(IPC.LIBRARY_TOGGLE_FAVORITE, (_event, trackId: number) => {
    return dbToggleFavorite(trackId)
  })

  ipcMain.handle(IPC.LIBRARY_RECENTLY_PLAYED, (_event, limit?: number) => {
    return dbGetRecentlyPlayed(limit ?? 50)
  })

  ipcMain.handle(IPC.LIBRARY_CLEAR_HISTORY, () => {
    dbClearPlaybackHistory()
    return true
  })

  ipcMain.handle(IPC.LIBRARY_RECORD_PLAYBACK, (_event, trackId: number, durationPlayed?: number) => {
    dbRecordPlayback(trackId, durationPlayed ?? 0)
    return true
  })

  // -------------------------------------------------------------------------
  // Playback handlers
  // -------------------------------------------------------------------------

  ipcMain.handle('settings:get', () => {
    return getAppSettings()
  })

  ipcMain.handle('settings:set', (_event, nextSettings: Partial<typeof getAppSettings>) => {
    const saved = setAppSettings(nextSettings)
    const current = getAppSettings()

    if ('discordEnabled' in nextSettings) {
      discordPresence.setEnabled(current.discordEnabled)
    }

    return saved
  })

  ipcMain.handle('discord:set-enabled', async (_event, enabled: boolean) => {
    discordPresence.setEnabled(enabled)
  })

  ipcMain.handle('discord:get-enabled', () => {
    return discordPresence.isEnabled()
  })

  ipcMain.handle('discord:set-activity', async (_event, payload: {
    details: string
    state: string
    isPlaying: boolean
    album?: string | null
    artist?: string | null
    artworkId?: number | null
    position?: number
    duration?: number
    repeatMode?: 'off' | 'all' | 'one'
  }) => {
    await discordPresence.setActivity(payload)
  })

  ipcMain.handle('discord:clear-activity', async () => {
    await discordPresence.clearActivity()
  })

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

  ipcMain.handle(IPC.PLAYBACK_SAVE_RESUME, (_event, trackId: number, position: number) => {
    dbSaveTrackResume(trackId, position)
    return true
  })

  ipcMain.handle(IPC.PLAYBACK_GET_RESUME, (_event, trackId: number) => {
    return dbGetTrackResume(trackId)
  })

  ipcMain.handle(IPC.PLAYBACK_CLEAR_RESUME, (_event, trackId: number) => {
    dbClearTrackResume(trackId)
    return true
  })

  ipcMain.handle(IPC.PLAYBACK_SAVE_STATE, (_event, state: Record<string, string>) => {
    for (const [key, val] of Object.entries(state)) {
      dbSetPlaybackState(key, typeof val === 'string' ? val : JSON.stringify(val))
    }
    return true
  })

  ipcMain.handle(IPC.PLAYBACK_GET_STATE, () => {
    return dbGetAllPlaybackState()
  })
}
