# Changelog

All notable changes to **IotaPlayer** are documented in this file.

## [1.1.0] - 2026-11-18

### Added
- **Configurable Playback Speed & Pitch Control**: Added a **Speed & Pitch** panel in the Equalizer view (`0.50×`–`1.50×`, `0.01×` precision), numeric speed input, independent **Preserve pitch** toggle, semitone pitch-shift readout (`12 × log2(rate)`), and built-in presets (`Normal`, `Nightcore` `1.16×`, `Fast Nightcore` `1.25×`, `Daycore` `0.85×`, `Slowed` `0.90×`, `Custom`).
- **Dual-Backend Speed & Pitch Parity**: Integrated `speed` and `audio-pitch-correction` (`yes`/`no`) in `MpvController` and `playbackRate`/`defaultPlaybackRate`/`preservesPitch` on `HTMLAudioElement`, with persistent preferences across restarts.
- **Rate-Aware Lyrics Interpolation**: Scaled `useInterpolatedPosition` wall-clock deltas by `playbackRate` with seamless mid-line speed-change re-anchoring.

## [1.0.0] - 2026-11-17

### Added
- **Cross-Platform Brand Identity & Icons**: Custom geometric **Harmonic Pillar** master SVG (`assets/icons/iotaplayer.svg`), multi-resolution Windows `.ico`, macOS `.icns`, Linux PNG/SVG set, and synced `public/favicon.svg`.
- **Single-Instance & Windows Shell Integration**: `app.requestSingleInstanceLock()` with `second-instance` window focus/restore, and `app.setAppUserModelId('pl.vorlie.iotaplayer')`.
- **About & Website Metadata**: Added version, publisher (`vorlie`), and `https://vorlie.pl/projects/iotaplayer` link in **Settings**, plus `app:info` IPC channel.
- **Word-Level Lyrics Synchronization**: Progressive word highlighting and click-to-word seeking for **Lyricsfile 1.0** (`.lyricsfile.yaml`) and **Enhanced LRC** (`<mm:ss.xx>`), with 60fps boundary-checked `requestAnimationFrame` tracking and solid glyph transitions.
- **Fisher–Yates Shuffle & Playback History**: Replaced stateless random selection with a stable queue-entry ID deck (`electron/shuffle.ts`), true `Previous`/`Next` history navigation, cycle-boundary repeat-all protection, and atomic queue mutations.
- **Production Packaging & Release Docs**: Configured Electron Forge (`forge.config.js`) and `electron-builder.json` for Windows x64, macOS (`arm64`/`x64` DMG), and Linux (`x64` AppImage/deb), plus `RELEASE.md`, `docs/RELEASE-CHECKLIST.md`, and `docs/PLATFORM-SUPPORT.md`.

### Fixed
- **Repeat One Auto-Restart**: `repeatMode === 'one'` now seeks to `0` and resumes playback automatically when a track reaches EOF on both MPV and browser audio backends.
- **Cold-Launch Startup Volume Spikes**: `VolumeController` (`electron/volume.ts`) coordinates async settings hydration with MPV IPC initialization and `HTMLAudioElement` creation before audio becomes audible.
- **Hardcoded Default Library Path**: Replaced hardcoded Windows `D:\Media\Music` default with `app.getPath('music')` (falling back to `~/Music`).
- **Word-Level Lyrics Spacing & Flicker**: Fixed inter-word spacing detection on dashed tokens and eliminated CSS `background-clip: text` / `drop-shadow` transition flicker.

### Security
- Enforced production Content Security Policy header via `session.defaultSession.webRequest.onHeadersReceived`.
- Added `will-navigate` navigation guard, `http:`/`https:` validation for `shell.openExternal`, and IPC argument validation in `electron/ipc.ts`.
- Wrapped versioned SQLite migrations in transactions (`electron/database.ts`).
