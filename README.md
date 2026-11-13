# iotaPlayer

A desktop music player built with Electron, React, TypeScript, SQLite, and MPV. It scans a local music library, indexes metadata, and offers a polished library browsing and playback experience with queue management, favorites, playlists, and Rich Presence integration.

## Overview

This app is designed around a local-first music library workflow:

- scan a folder and index supported audio files into a SQLite database
- browse artists, albums, tracks, and playlists from the indexed library
- play files through MPV with a browser fallback for compatible formats
- manage queue, repeat, shuffle, playback resume, and now-playing state
- keep favorites, recently played tracks, playlist edits, and preferences persistent

## Current feature set

### Library & metadata
- Local music library scanning from a chosen root directory
- Recursive discovery of supported audio extensions
- Metadata extraction with `music-metadata`
- SQLite-backed storage for tracks, artists, albums, artwork, playlists, favorites, resume data, and playback history
- Artist, album, track, and search indexing
- Multi-field search across artist, album, track title, genre, and year
- Live in-view filtering and sorting on library lists
- Artwork caching and album art support

### Browsing views
- Artists view
- Albums view
- Album detail view
- Artist detail view
- Tracks view
- Search view
- Favorites view
- Recently played view
- Settings view
- Now playing view
- Playlist overview and playlist detail screens

### Playback
- MPV as the primary playback backend
- Browser fallback for browser-supported formats
- Playback backend selection via settings
- Live playback backend indicator in the UI
- Play, pause, resume, seek, stop, and volume control
- Previous/next track handling
- Repeat modes: off, all, and one
- Shuffle mode
- Resume-per-track position persistence
- Playback state persistence for settings like volume, repeat mode, and shuffle mode
- Graceful shutdown and media cleanup handling

### Queue & now playing
- Queue-based playback flow
- Add tracks/albums to queue from library views
- Clear queue
- Remove items from queue
- Move queue items up/down
- Drag-and-drop queue reordering
- Save current queue as a playlist
- Now playing panel with track metadata, artwork, controls, and queue panel

### Playlists & library actions
- Create playlists
- Rename playlists
- Delete playlists
- Add tracks to playlists
- Remove tracks from playlists
- Reorder playlist tracks
- Drag-and-drop playlist editing
- Playlist metadata editing (name/description/cover support)
- Album-to-playlist and track-to-playlist actions from context menus

### Favorites & history
- Favorite/unfavorite tracks
- Favorites page with quick actions
- Playback history tracking
- Recently played list
- Clear playback history
- Favorite IDs and favorite state synchronization with the playback store

### Lyrics & extras
- Lyrics lookup and display in the now playing screen
- Embedded/sidecar lyric support through the existing IPC layer
- Discord Rich Presence integration
- App settings persistence for Discord and playback options

### Settings & configuration
- Library scan configuration
- Playback backend preference
- Discord presence toggling and client configuration
- Persistent app settings stored in user data

## Architecture

- Electron main process manages app lifecycle, IPC exposure, database initialization, and MPV integration
- Renderer uses React + TypeScript for the UI
- Preload bridge exposes library and playback APIs to the renderer
- SQLite stores metadata, playlists, favorites, playback history, and resume state
- MPV is the default playback engine
- Browser media fallback handles cases where the browser can play the file directly

## Tech stack

- Electron
- React
- TypeScript
- Vite
- SQLite (`better-sqlite3`)
- MPV
- `music-metadata`
- `discord-rpc`

## Discord RPC note

The app currently relies on a small local compatibility patch in the installed `discord-rpc` dependency so the activity payload forwards the Discord activity `type` field instead of silently dropping it. Without that patch, the library sends the default activity type (`0`, or "Playing"), even when the app is trying to set a listening status.

This is a dependency-level workaround rather than a normal app setting, so other source builds will need to apply the same change themselves if they install dependencies from scratch.

This is especially relevant because the app intentionally sets Rich Presence as a listening activity for the currently playing track.

## Current roadmap

### Near-term ideas
- Subsonic/OpenSubsonic source support
- Better unsupported codec and failed-load handling
- Library cleanup tools for missing or deleted tracks
- Stronger DB migration tooling

### Longer-term ideas
- Equalizer or audio effects
- Mini-player mode
- Auto-play when opening an album or playlist
- Last.fm or other external metadata integrations
- Smart recommendations and generated mixes

## Running locally

```bash
npm install
npm run dev
```

## Building

```bash
npm run package
```

## Notes

The project is already fairly feature-complete as a local music player and is in a working desktop-app state. The next major extension is adding a remote media source model such as Subsonic/OpenSubsonic without disturbing the existing local-library workflow.
