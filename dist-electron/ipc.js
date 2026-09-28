"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC = void 0;
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");
const database_1 = require("./database");
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
    SCAN_PROGRESS: 'scan:progress',
};
// ---------------------------------------------------------------------------
// Register all IPC handlers
// ---------------------------------------------------------------------------
function registerIpcHandlers() {
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
            data: artwork.data.toString('base64'),
        };
    });
}
