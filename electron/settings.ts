import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import {
  DEFAULT_PLAYBACK_RATE,
  DEFAULT_PRESERVE_PITCH,
  normalizePlaybackRate,
  normalizePreservePitch,
} from './playbackSpeed'
import type { LyricsSourcePreference } from './types'

const nodeRequire = createRequire(__filename)

function getElectronApp(): typeof import('electron').app | undefined {
  if (!process.versions?.electron) return undefined
  try {
    return (nodeRequire('electron') as typeof import('electron')).app
  } catch {
    return undefined
  }
}

export interface AppSettings {
  discordClientId: string
  imgurClientId: string
  discordEnabled: boolean
  libraryRoot: string
  equalizerEnabled: boolean
  equalizerPreset: string
  equalizerBands: number[]
  lyricsSourcePreference: LyricsSourcePreference
  playbackRate: number
  preservePitch: boolean
}

const DEFAULT_EQUALIZER_BANDS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

function getDefaultLibraryRoot(): string {
  try {
    const musicPath = getElectronApp()?.getPath?.('music')
    if (musicPath) return musicPath
  } catch {
    // Fallback outside Electron app lifecycle (e.g. unit tests)
  }
  return path.join(os.homedir(), 'Music')
}

const DEFAULT_LIBRARY_ROOT = getDefaultLibraryRoot()

const VALID_LYRICS_SOURCE_PREFERENCES: LyricsSourcePreference[] = [
  'embedded',
  'synchronized',
  'sidecar',
]

function normalizeLyricsSourcePreference(value: unknown): LyricsSourcePreference {
  if (
    typeof value === 'string' &&
    VALID_LYRICS_SOURCE_PREFERENCES.includes(value as LyricsSourcePreference)
  ) {
    return value as LyricsSourcePreference
  }
  return 'embedded'
}

const DEFAULT_SETTINGS: AppSettings = {
  discordClientId: '',
  imgurClientId: '',
  discordEnabled: true,
  libraryRoot: DEFAULT_LIBRARY_ROOT,
  equalizerEnabled: false,
  equalizerPreset: 'Flat',
  equalizerBands: [...DEFAULT_EQUALIZER_BANDS],
  lyricsSourcePreference: 'embedded',
  playbackRate: DEFAULT_PLAYBACK_RATE,
  preservePitch: DEFAULT_PRESERVE_PITCH,
}

function normalizeEqualizerBands(value: unknown): number[] {
  if (Array.isArray(value) && value.length === 10 && value.every((item) => typeof item === 'number')) {
    return value.map((band) => Math.max(-12, Math.min(12, Number(band))))
  }

  return [...DEFAULT_EQUALIZER_BANDS]
}

function getSettingsPath(): string {
  const userDataDir = getElectronApp()?.getPath?.('userData') ?? path.join(os.homedir(), '.iotaplayer')
  const settingsDir = path.join(userDataDir, 'settings')

  if (!existsSync(settingsDir)) {
    mkdirSync(settingsDir, { recursive: true })
  }

  return path.join(settingsDir, 'app-settings.json')
}

export function getAppSettings(): AppSettings {
  const settingsPath = getSettingsPath()

  if (!existsSync(settingsPath)) {
    writeFileSync(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8')
    return { ...DEFAULT_SETTINGS }
  }

  try {
    const raw = readFileSync(settingsPath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      discordClientId: parsed.discordClientId ?? DEFAULT_SETTINGS.discordClientId,
      imgurClientId: parsed.imgurClientId ?? DEFAULT_SETTINGS.imgurClientId,
      discordEnabled: parsed.discordEnabled ?? DEFAULT_SETTINGS.discordEnabled,
      libraryRoot: parsed.libraryRoot || DEFAULT_SETTINGS.libraryRoot,
      equalizerEnabled: parsed.equalizerEnabled ?? DEFAULT_SETTINGS.equalizerEnabled,
      equalizerPreset: parsed.equalizerPreset ?? DEFAULT_SETTINGS.equalizerPreset,
      equalizerBands: normalizeEqualizerBands(parsed.equalizerBands),
      lyricsSourcePreference: normalizeLyricsSourcePreference(parsed.lyricsSourcePreference),
      playbackRate: normalizePlaybackRate(parsed.playbackRate, DEFAULT_SETTINGS.playbackRate),
      preservePitch: normalizePreservePitch(parsed.preservePitch, DEFAULT_SETTINGS.preservePitch),
    }
  } catch {
    writeFileSync(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8')
    return { ...DEFAULT_SETTINGS }
  }
}

export function setAppSettings(nextSettings: Partial<AppSettings>): AppSettings {
  const current = getAppSettings()
  const merged: AppSettings = {
    ...current,
    ...nextSettings,
    libraryRoot: nextSettings.libraryRoot || current.libraryRoot || DEFAULT_SETTINGS.libraryRoot,
    equalizerBands: normalizeEqualizerBands(nextSettings.equalizerBands ?? current.equalizerBands),
    lyricsSourcePreference: normalizeLyricsSourcePreference(
      nextSettings.lyricsSourcePreference ?? current.lyricsSourcePreference,
    ),
    playbackRate: normalizePlaybackRate(
      nextSettings.playbackRate ?? current.playbackRate,
      current.playbackRate,
    ),
    preservePitch: normalizePreservePitch(
      nextSettings.preservePitch ?? current.preservePitch,
      current.preservePitch,
    ),
  }
  const settingsPath = getSettingsPath()
  writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf8')
  return merged
}
