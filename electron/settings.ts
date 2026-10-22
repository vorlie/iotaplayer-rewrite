import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export interface AppSettings {
  discordClientId: string
  imgurClientId: string
  discordEnabled: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  discordClientId: '',
  imgurClientId: '',
  discordEnabled: true,
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
    }
  } catch {
    writeFileSync(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8')
    return { ...DEFAULT_SETTINGS }
  }
}

export function setAppSettings(nextSettings: Partial<AppSettings>): AppSettings {
  const current = getAppSettings()
  const merged = { ...current, ...nextSettings }
  const settingsPath = getSettingsPath()
  writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf8')
  return merged
}
