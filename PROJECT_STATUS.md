# IoTAP Layer Rewrite — Project Status

## Overview
This project is a desktop music player built with Electron + React + TypeScript, backed by mpv for core playback and a browser media fallback for selected formats. The app scans a local music library into SQLite, renders a library UI, and supports queue-based playback, playlists, and now-playing views.

## Current State

### Core features implemented
- Electron app shell with main/renderer/preload separation
- Local library scanning and metadata indexing using SQLite
- Track, artist, album, and search views
- Queue and now-playing playback flow
- Playlist creation, rename, delete, and add-to-playlist actions
- Album and artist detail pages
- Settings view for library scanning and playback configuration
- Playback controls for play/pause, prev/next, seek, volume, repeat, and shuffle
- MPV integration as the primary backend
- Browser fallback for browser-supported file types
- Graceful app shutdown handling while media is active

### Playback backend rules
- MPV is the default and primary playback backend
- Browser fallback is used only when the file is supported and the preference allows it
- WAV files are forced to MPV
- Playback backend selection is configurable from Settings

### Playlist and queue behavior
- Queue can be built from tracks, albums, artists, or playlists
- Repeat modes: off, all, one
- Shuffle support is available
- User can save the current queue as a playlist
- Playlist detail view supports opening and playing its contents

### UI status
- Player bar is functional and styled
- Now-playing view includes queue/list and current track meta
- Context menus for adding tracks to playlists are present
- Album and track lists support multiple interactions

## Known strengths
- The app has a clean split between library logic, playback logic, and UI
- SQLite-backed persistence gives a stable base for library metadata and playlists
- Playback is already fairly close to a usable desktop music-player flow
- The project has a clear extension path for more advanced music features

## Missing or incomplete features
These are the main areas still missing compared with a more complete music player:

### 1. Library UX and organization
- Sorting/filtering by title, artist, year, duration, etc.
- Search refinements and scoped results
- Recent library updates indicators
- Favorites and starred tracks
- Library folder preference persistence beyond the current Settings form

### 2. Playback polish
- Resume playback position per track
- Playback history and “recently played” list
- Gapless playback tuning and transitions
- Better handling for malformed or unsupported media files
- More explicit backend status in the UI (MPV vs browser fallback)

### 3. Playlist enhancements
- Drag-and-drop reordering in playlist view
- Remove track from playlist
- Playlist export/import
- Playlist artwork / cover generation
- Smart playlists (recent, favorites, most played)

### 4. Metadata and library quality
- Better music tagging normalization
- Duplicate detection and deduplication
- File move/rename handling across the library database
- Folder re-scan and incremental update improvements
- More resilient artwork fallback behavior

### 5. App polish and ergonomics
- Keyboard shortcuts
- Media key integration
- Better app window behaviors and layout refinement
- Full theming and dark/light mode polish
- Accessibility improvements for controls and menus

## Potential improvements / next feature roadmap

### High-priority
1. Add per-track resume state and last-position persistence
2. Add favorites and recently played history
3. Add playlist track removal and reordering
4. Add better queue management (clear queue, remove item, move up/down)
5. Add a playback status indicator showing the active backend

### Medium-priority
1. Improve search and filtering logic across the library
2. Add playback preference persistence across app restarts
3. Add better error handling for unsupported codecs and failed loads
4. Add library cleanup tools and better DB migration management
5. Add drag-enabled playlist editing

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
- SQLite: persistent metadata store and playlist state
- MPV: primary media engine
- Browser fallback: fallback for compatible codecs/file types

## Conclusion
The project is in a good MVP-to-advanced-prototype state: the core audio experience is working, the library structure is present, and the app is already close to a functional desktop music player. The next best improvements are playback persistence, playlist management refinements, and stronger library UX features.
