"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const electron_1 = require("electron");
// ---------------------------------------------------------------------------
// Library API
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
    playlists: () => electron_1.ipcRenderer.invoke('library:playlists'),
    createPlaylist: (name, trackIds) => electron_1.ipcRenderer.invoke('library:create-playlist', name, trackIds),
    renamePlaylist: (playlistId, newName) => electron_1.ipcRenderer.invoke('library:rename-playlist', playlistId, newName),
    deletePlaylist: (playlistId) => electron_1.ipcRenderer.invoke('library:delete-playlist', playlistId),
    addTrackToPlaylist: (playlistId, trackId) => electron_1.ipcRenderer.invoke('library:add-track-to-playlist', playlistId, trackId),
    removeTrackFromPlaylist: (playlistId, position) => electron_1.ipcRenderer.invoke('library:remove-track-from-playlist', playlistId, position),
    reorderPlaylist: (playlistId, fromIndex, toIndex) => electron_1.ipcRenderer.invoke('library:reorder-playlist', playlistId, fromIndex, toIndex),
    favorites: () => electron_1.ipcRenderer.invoke('library:favorites'),
    favoriteIds: () => electron_1.ipcRenderer.invoke('library:favorite-ids'),
    toggleFavorite: (trackId) => electron_1.ipcRenderer.invoke('library:toggle-favorite', trackId),
    recentlyPlayed: (limit) => electron_1.ipcRenderer.invoke('library:recently-played', limit),
    clearHistory: () => electron_1.ipcRenderer.invoke('library:clear-history'),
    recordPlayback: (trackId, durationPlayed) => electron_1.ipcRenderer.invoke('library:record-playback', trackId, durationPlayed),
    onScanProgress: (cb) => {
        const handler = (_, progress) => cb(progress);
        electron_1.ipcRenderer.on('scan:progress', handler);
        return () => electron_1.ipcRenderer.removeListener('scan:progress', handler);
    },
};
// ---------------------------------------------------------------------------
// Browser audio fallback
// ---------------------------------------------------------------------------
const browserStateCallbacks = new Set();
const browserEndedCallbacks = new Set();
let browserAudioActive = false;
let browserObjectUrl = null;
let browserVolume = 0.8;
let preferredPlaybackBackend = 'auto';
const browserAudio = new globalThis.Audio();
const browserMimeMap = [
    [['.aac', '.mp4', '.m4a', '.mov', '.3gp'], 'audio/aac'],
    [['.alac'], 'audio/mp4'],
    [['.flac'], 'audio/flac'],
    [['.mp3', '.mpeg'], 'audio/mpeg'],
    [['.opus', '.ogg', '.oga', '.webm'], 'audio/ogg'],
    [['.vorbis'], 'audio/ogg'],
    [['.wav'], 'audio/wav'],
];
function isWaveFile(filePath) {
    const normalized = filePath.toLowerCase();
    return normalized.endsWith('.wav');
}
function getBrowserAudioSupport(filePath) {
    if (isWaveFile(filePath))
        return false;
    const normalized = filePath.toLowerCase();
    const match = browserMimeMap.find(([extensions]) => extensions.some((extension) => normalized.endsWith(extension)));
    if (!match)
        return false;
    const [, mimeType] = match;
    return browserAudio.canPlayType(mimeType) !== '';
}
function shouldUseBrowserAudio(filePath) {
    if (isWaveFile(filePath))
        return false;
    if (preferredPlaybackBackend === 'mpv')
        return false;
    if (preferredPlaybackBackend === 'browser')
        return getBrowserAudioSupport(filePath);
    return getBrowserAudioSupport(filePath);
}
function toBrowserAudioUrl(filePath) {
    const normalized = filePath.toLowerCase();
    const match = browserMimeMap.find(([extensions]) => extensions.some((extension) => normalized.endsWith(extension)));
    const mimeType = match?.[1] ?? 'application/octet-stream';
    const blob = new Blob([(0, node_fs_1.readFileSync)(filePath)], { type: mimeType });
    if (browserObjectUrl) {
        ;
        globalThis.URL.revokeObjectURL(browserObjectUrl);
    }
    const objectUrl = globalThis.URL.createObjectURL(blob);
    browserObjectUrl = objectUrl;
    return objectUrl;
}
function emitBrowserState(state) {
    browserStateCallbacks.forEach((cb) => cb({ backend: 'browser', ...state }));
}
function emitBrowserEnded() {
    browserEndedCallbacks.forEach((cb) => cb());
}
function attachBrowserAudioEvents() {
    browserAudio.onplay = () => {
        emitBrowserState({
            isPlaying: true,
            position: browserAudio.currentTime || 0,
            duration: Number.isFinite(browserAudio.duration) ? browserAudio.duration : 0,
            volume: browserAudio.volume,
        });
    };
    browserAudio.onpause = () => {
        emitBrowserState({
            isPlaying: false,
            position: browserAudio.currentTime || 0,
            duration: Number.isFinite(browserAudio.duration) ? browserAudio.duration : 0,
            volume: browserAudio.volume,
        });
    };
    browserAudio.ontimeupdate = () => {
        emitBrowserState({
            position: browserAudio.currentTime || 0,
            duration: Number.isFinite(browserAudio.duration) ? browserAudio.duration : 0,
            volume: browserAudio.volume,
        });
    };
    browserAudio.onloadedmetadata = () => {
        emitBrowserState({
            duration: Number.isFinite(browserAudio.duration) ? browserAudio.duration : 0,
            position: browserAudio.currentTime || 0,
            volume: browserAudio.volume,
        });
    };
    browserAudio.onended = () => {
        emitBrowserState({
            isPlaying: false,
            position: browserAudio.duration || 0,
            duration: browserAudio.duration || 0,
            volume: browserAudio.volume,
        });
        emitBrowserEnded();
    };
}
attachBrowserAudioEvents();
// ---------------------------------------------------------------------------
// Playback API
// ---------------------------------------------------------------------------
const settingsAPI = {
    get: () => electron_1.ipcRenderer.invoke('settings:get'),
    set: (value) => electron_1.ipcRenderer.invoke('settings:set', value),
};
const discordAPI = {
    setEnabled: (enabled) => electron_1.ipcRenderer.invoke('discord:set-enabled', enabled),
    getEnabled: () => electron_1.ipcRenderer.invoke('discord:get-enabled'),
    setActivity: (payload) => electron_1.ipcRenderer.invoke('discord:set-activity', payload),
    clearActivity: () => electron_1.ipcRenderer.invoke('discord:clear-activity'),
};
const playbackAPI = {
    getPreferredBackend: () => Promise.resolve(preferredPlaybackBackend),
    setPreferredBackend: (mode) => {
        preferredPlaybackBackend = mode;
        return Promise.resolve();
    },
    play: async (filePath) => {
        if (shouldUseBrowserAudio(filePath)) {
            browserAudioActive = true;
            browserAudio.volume = browserVolume;
            browserAudio.src = toBrowserAudioUrl(filePath);
            browserAudio.load();
            try {
                await browserAudio.play();
            }
            catch {
                browserAudioActive = false;
            }
            return;
        }
        browserAudioActive = false;
        await electron_1.ipcRenderer.invoke('playback:play', filePath);
    },
    pause: () => {
        if (browserAudioActive) {
            browserAudio.pause();
            return Promise.resolve();
        }
        return electron_1.ipcRenderer.invoke('playback:pause');
    },
    resume: () => {
        if (browserAudioActive) {
            void browserAudio.play();
            return Promise.resolve();
        }
        return electron_1.ipcRenderer.invoke('playback:resume');
    },
    toggle: () => {
        if (browserAudioActive) {
            if (browserAudio.paused) {
                void browserAudio.play();
            }
            else {
                browserAudio.pause();
            }
            return Promise.resolve();
        }
        return electron_1.ipcRenderer.invoke('playback:toggle');
    },
    seek: (seconds) => {
        if (browserAudioActive) {
            browserAudio.currentTime = Math.max(0, seconds);
            emitBrowserState({
                position: browserAudio.currentTime,
                duration: Number.isFinite(browserAudio.duration) ? browserAudio.duration : 0,
                volume: browserAudio.volume,
            });
            return Promise.resolve();
        }
        return electron_1.ipcRenderer.invoke('playback:seek', seconds);
    },
    setVolume: (volume) => {
        const clamped = Math.max(0, Math.min(1, volume));
        browserVolume = clamped;
        if (browserAudioActive) {
            browserAudio.volume = clamped;
            emitBrowserState({ volume: browserAudio.volume });
            return Promise.resolve();
        }
        return electron_1.ipcRenderer.invoke('playback:volume', clamped);
    },
    stop: () => {
        if (browserAudioActive) {
            browserAudio.pause();
            browserAudio.currentTime = 0;
            browserAudioActive = false;
            emitBrowserState({ isPlaying: false, position: 0, duration: browserAudio.duration || 0, volume: browserAudio.volume });
            return Promise.resolve();
        }
        return electron_1.ipcRenderer.invoke('playback:stop');
    },
    saveTrackResume: (trackId, position) => electron_1.ipcRenderer.invoke('playback:save-resume', trackId, position),
    getTrackResume: (trackId) => electron_1.ipcRenderer.invoke('playback:get-resume', trackId),
    clearTrackResume: (trackId) => electron_1.ipcRenderer.invoke('playback:clear-resume', trackId),
    savePlaybackState: (state) => electron_1.ipcRenderer.invoke('playback:save-state', state),
    getPlaybackState: () => electron_1.ipcRenderer.invoke('playback:get-state'),
    onStateChange: (cb) => {
        browserStateCallbacks.add(cb);
        const handler = (_, state) => cb(state);
        electron_1.ipcRenderer.on('playback:state', handler);
        return () => {
            browserStateCallbacks.delete(cb);
            electron_1.ipcRenderer.removeListener('playback:state', handler);
        };
    },
    onTrackEnded: (cb) => {
        browserEndedCallbacks.add(cb);
        const handler = () => cb();
        electron_1.ipcRenderer.on('playback:ended', handler);
        return () => {
            browserEndedCallbacks.delete(cb);
            electron_1.ipcRenderer.removeListener('playback:ended', handler);
        };
    },
};
electron_1.contextBridge.exposeInMainWorld('library', libraryAPI);
electron_1.contextBridge.exposeInMainWorld('settings', settingsAPI);
electron_1.contextBridge.exposeInMainWorld('discord', discordAPI);
electron_1.contextBridge.exposeInMainWorld('playback', playbackAPI);
