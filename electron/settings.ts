import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export interface AppSettings {
  discordClientId: string
  imgurClientId: string
  discordEnabled: boolean
  equalizerEnabled: boolean
  equalizerPreset: string
  equalizerBands: number[]
}

const DEFAULT_EQUALIZER_BANDS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

const DEFAULT_SETTINGS: AppSettings = {
  discordClientId: '',
  imgurClientId: '',
  discordEnabled: true,
  equalizerEnabled: false,
  equalizerPreset: 'Flat',
  equalizerBands: [...DEFAULT_EQUALIZER_BANDS],
}

function normalizeEqualizerBands(value: unknown): number[] {
  if (Array.isArray(value) && value.length === 10 && value.every((item) => typeof item === 'number')) {
    return value.map((band) => Math.max(-12, Math.min(12, Number(band))))
  }

  return [...DEFAULT_EQUALIZER_BANDS]
}

function getSettingsPath(): string {
  const userDataDir = app.getPath('userData')
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
      equalizerEnabled: parsed.equalizerEnabled ?? DEFAULT_SETTINGS.equalizerEnabled,
      equalizerPreset: parsed.equalizerPreset ?? DEFAULT_SETTINGS.equalizerPreset,
      equalizerBands: normalizeEqualizerBands(parsed.equalizerBands),
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
    equalizerBands: normalizeEqualizerBands(nextSettings.equalizerBands ?? current.equalizerBands),
  }
  const settingsPath = getSettingsPath()
  writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf8')
  return merged
}
