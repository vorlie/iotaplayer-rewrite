"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// ---------------------------------------------------------------------------
// Exposed API surface — the ONLY thing the renderer can use
// ---------------------------------------------------------------------------
const libraryAPI = {
    stats: () => electron_1.ipcRenderer.invoke('library:stats'),
    scan: (rootDir) => electron_1.ipcRenderer.invoke('library:scan', rootDir),
    artists: () => electron_1.ipcRenderer.invoke('library:artists'),
    artist: (id) => electron_1.ipcRenderer.invoke('library:artist', id),
    albums: (artistId) => electron_1.ipcRenderer.invoke('library:albums', artistId),
    album: (id) => electron_1.ipcRenderer.invoke('library:album', id),
    tracks: (opts) => electron_1.ipcRenderer.invoke('library:tracks', opts),
    search: (query) => electron_1.ipcRenderer.invoke('library:search', query),
    artwork: (id) => electron_1.ipcRenderer.invoke('library:artwork', id),
    onScanProgress: (cb) => {
        const handler = (_, progress) => cb(progress);
        electron_1.ipcRenderer.on('scan:progress', handler);
        return () => electron_1.ipcRenderer.removeListener('scan:progress', handler);
    },
};
electron_1.contextBridge.exposeInMainWorld('library', libraryAPI);
