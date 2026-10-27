# Project Status

## Overview
This project is a desktop music player built with Electron + React + TypeScript, backed by mpv for core playback and a browser media fallback for selected formats. The app scans a local music library into SQLite, renders a library UI, and supports queue-based playback, playlists, and now-playing views.

## Current State

### Core features implemented
- Electron app shell with main/renderer/preload separation
- Local library scanning and metadata indexing using SQLite
- Multi-token, multi-field search (artist, album, track title, genre, year)
- In-view live filtering and sorting across Tracks, Albums, and Artists
- Track, artist, album, and search views
- Queue and now-playing playback flow with drag-and-drop reordering
- Playlist creation, rename, delete, add-to-playlist, remove track, and drag-and-drop reordering
- Favorites system (starred tracks) and Recently Played playback history
- Per-track resume state and playback preferences persistence across restarts
- Album and artist detail pages
- Settings view for library scanning and playback configuration
- Playback controls for play/pause, prev/next, seek, volume, repeat, and shuffle
- MPV integration as the primary backend
- Browser fallback for browser-supported file types
- Live active playback backend indicator (MPV vs. Browser)
- Graceful app shutdown handling while media is active

### Playback backend rules
- MPV is the default and primary playback backend
- Browser fallback is used only when the file is supported and the preference allows it
- WAV files are forced to MPV
- Playback backend selection is configurable from Settings
- Active backend status is reported live to the renderer and UI

### Playlist and queue behavior
- Queue can be built from tracks, albums, artists, or playlists
- Queue management controls: clear queue, remove item, move track up/down, and drag-and-drop reordering
- Repeat modes: off, all, one
- Shuffle support is available
- User can save the current queue as a playlist
- Playlist detail view supports playing, renaming, deleting, removing individual tracks, move up/down, and drag-and-drop reordering

### UI status
- Player bar is functional and styled with active backend badge and quick-favorite heart button
- Now-playing view includes queue management controls (clear, remove, reorder), track meta, backend badge, and favorite toggle
- Context menus for adding tracks to playlists and toggling favorites
- Favorites page with "Play all" and instant favorite toggles
- Recently played page with playback history and clear history action
- Album and track lists support interactive filtering, column sorting, and drag-and-drop reordering

## Completed improvements

### High-priority (Completed)
- [x] 1. Add per-track resume state and last-position persistence
- [x] 2. Add favorites and recently played history
- [x] 3. Add playlist track removal and reordering
- [x] 4. Add better queue management (clear queue, remove item, move up/down)
- [x] 5. Add a playback status indicator showing the active backend

### Medium-priority (In Progress)
- [x] 1. Improve search and filtering logic across the library (multi-field/token search, in-view live filtering, column header sorting)
- [x] 5. Add drag-enabled playlist & queue editing (HTML5 drag-and-drop reordering with visual drag/drop indicators)

## Next feature roadmap

### Remaining Medium-priority
1. Add playback preference persistence across app restarts (restore active queue & last played track on launch)
2. Add better error handling for unsupported codecs and failed loads
3. Add library cleanup tools (prune missing/deleted tracks from DB) and better DB migration management

### Nice-to-have
1. Equalizer / audio effect controls
2. Mini-player mode
3. Auto-play when opening a playlist or album
4. Last.fm / external metadata sources
5. Smart recommendations and auto-generated mixes

## Architecture Notes
- Renderer: React UI for library and playback screens
- Main process: app lifecycle, mpv lifecycle, IPC exposure, persistent state coordination
- Preload: mediator between UI code and Electron IPC
- SQLite: persistent metadata store, playlist state, favorites, history, and track resume
- MPV: primary media engine
- Browser fallback: fallback for compatible codecs/file types

## Conclusion
High-priority items as well as Medium-priority items #1 and #5 (improved search/filtering across the library, and drag-enabled playlist & queue editing) are now complete and verified. Remaining medium-priority items include queue restoration on launch, error toasts, and missing track pruning.
