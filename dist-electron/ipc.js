"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC = void 0;
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");
const database_1 = require("./database");
const mpv_1 = require("./mpv");
const scanner_1 = require("./scanner");
// ---------------------------------------------------------------------------
// IPC channel names (must match preload.ts)
// ---------------------------------------------------------------------------
exports.IPC = {
    LIBRARY_STATS: 'library:stats',
    LIBRARY_SCAN: 'library:scan',
    LIBRARY_ARTISTS: 'library:artists',
    LIBRARY_ARTIST: 'library:artist',
    LIBRARY_ALBUMS: 'library:albums',
    LIBRARY_ALBUM: 'library:album',
    LIBRARY_TRACKS: 'library:tracks',
    LIBRARY_SEARCH: 'library:search',
    LIBRARY_ARTWORK: 'library:artwork',
    LIBRARY_PLAYLISTS: 'library:playlists',
    LIBRARY_CREATE_PLAYLIST: 'library:create-playlist',
    LIBRARY_RENAME_PLAYLIST: 'library:rename-playlist',
    LIBRARY_DELETE_PLAYLIST: 'library:delete-playlist',
    LIBRARY_ADD_TRACK_TO_PLAYLIST: 'library:add-track-to-playlist',
    SCAN_PROGRESS: 'scan:progress',
    PLAYBACK_PLAY: 'playback:play',
    PLAYBACK_PAUSE: 'playback:pause',
    PLAYBACK_RESUME: 'playback:resume',
    PLAYBACK_TOGGLE: 'playback:toggle',
    PLAYBACK_SEEK: 'playback:seek',
    PLAYBACK_VOLUME: 'playback:volume',
    PLAYBACK_STOP: 'playback:stop',
    PLAYBACK_STATE: 'playback:state',
    PLAYBACK_ENDED: 'playback:ended',
};
// ---------------------------------------------------------------------------
// Register all IPC handlers
// ---------------------------------------------------------------------------
function registerIpcHandlers() {
    // Setup MPV controller callbacks to push state to renderer
    const mpv = (0, mpv_1.getMpv)();
    mpv.setCallbacks((state) => {
        electron_1.BrowserWindow.getAllWindows().forEach((win) => {
            if (!win.isDestroyed()) {
                win.webContents.send(exports.IPC.PLAYBACK_STATE, state);
            }
        });
    }, () => {
        electron_1.BrowserWindow.getAllWindows().forEach((win) => {
            if (!win.isDestroyed()) {
                win.webContents.send(exports.IPC.PLAYBACK_ENDED);
            }
        });
    });
    // library.stats()
    electron_1.ipcMain.handle(exports.IPC.LIBRARY_STATS, () => {
        return (0, database_1.dbGetStats)();
    });
    // library.scan(rootDir)
    electron_1.ipcMain.handle(exports.IPC.LIBRARY_SCAN, async (event, rootDir) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        const result = await (0, scanner_1.scanLibrary)(rootDir, (progress) => {
            win?.webContents.send(exports.IPC.SCAN_PROGRESS, progress);
        });
        return result;
    });
    // library.artists()
    electron_1.ipcMain.handle(exports.IPC.LIBRARY_ARTISTS, () => {
        return (0, database_1.dbGetArtists)();
    });
    // library.artist(id)
    electron_1.ipcMain.handle(exports.IPC.LIBRARY_ARTIST, (_event, id) => {
        return (0, database_1.dbGetArtist)(id);
    });
    // library.albums(artistId?)
    electron_1.ipcMain.handle(exports.IPC.LIBRARY_ALBUMS, (_event, artistId) => {
        return (0, database_1.dbGetAlbums)(artistId);
    });
    // library.album(id)
    electron_1.ipcMain.handle(exports.IPC.LIBRARY_ALBUM, (_event, id) => {
        return (0, database_1.dbGetAlbum)(id);
    });
    // library.tracks({ albumId?, artistId?, limit?, offset? })
    electron_1.ipcMain.handle(exports.IPC.LIBRARY_TRACKS, (_event, opts) => {
        return (0, database_1.dbGetTracks)(opts);
    });
    // library.search(query)
    electron_1.ipcMain.handle(exports.IPC.LIBRARY_SEARCH, (_event, query) => {
        return (0, database_1.dbSearch)(query);
    });
    // library.artwork(id)  — returns { mime_type, data } with data as base64
    electron_1.ipcMain.handle(exports.IPC.LIBRARY_ARTWORK, (_event, id) => {
        const artwork = (0, database_1.dbGetArtwork)(id);
        if (!artwork)
            return null;
        return {
            mime_type: artwork.mime_type,
            data: Buffer.from(artwork.data).toString('base64'),
        };
    });
    electron_1.ipcMain.handle(exports.IPC.LIBRARY_PLAYLISTS, () => {
        return (0, database_1.dbGetPlaylists)();
    });
    electron_1.ipcMain.handle(exports.IPC.LIBRARY_CREATE_PLAYLIST, (_event, name, trackIds) => {
        return (0, database_1.dbCreatePlaylist)(name, trackIds);
    });
    electron_1.ipcMain.handle(exports.IPC.LIBRARY_RENAME_PLAYLIST, (_event, playlistId, newName) => {
        return (0, database_1.dbRenamePlaylist)(playlistId, newName);
    });
    electron_1.ipcMain.handle(exports.IPC.LIBRARY_DELETE_PLAYLIST, (_event, playlistId) => {
        return (0, database_1.dbDeletePlaylist)(playlistId);
    });
    electron_1.ipcMain.handle(exports.IPC.LIBRARY_ADD_TRACK_TO_PLAYLIST, (_event, playlistId, trackId) => {
        return (0, database_1.dbAddTrackToPlaylist)(playlistId, trackId);
    });
    // -------------------------------------------------------------------------
    // Playback handlers
    // -------------------------------------------------------------------------
    electron_1.ipcMain.handle(exports.IPC.PLAYBACK_PLAY, async (_event, filePath) => {
        await mpv.play(filePath);
    });
    electron_1.ipcMain.handle(exports.IPC.PLAYBACK_PAUSE, () => {
        mpv.pause();
    });
    electron_1.ipcMain.handle(exports.IPC.PLAYBACK_RESUME, () => {
        mpv.resume();
    });
    electron_1.ipcMain.handle(exports.IPC.PLAYBACK_TOGGLE, () => {
        mpv.toggle();
    });
    electron_1.ipcMain.handle(exports.IPC.PLAYBACK_SEEK, (_event, seconds) => {
        mpv.seek(seconds);
    });
    electron_1.ipcMain.handle(exports.IPC.PLAYBACK_VOLUME, (_event, volume) => {
        mpv.setVolume(volume);
    });
    electron_1.ipcMain.handle(exports.IPC.PLAYBACK_STOP, () => {
        mpv.stop();
    });
}
