import { createRequire } from 'node:module'
import { getAppSettings, type AppLanguage } from './settings'

export type ElectronLocale = 'en' | 'pl'

const nodeRequire = createRequire(__filename)

function getElectronApp(): typeof import('electron').app | undefined {
  if (!process.versions?.electron) return undefined
  try {
    return (nodeRequire('electron') as typeof import('electron')).app
  } catch {
    return undefined
  }
}

export function resolveSystemLocale(locale?: string | null): ElectronLocale {
  const normalized = locale?.trim().toLowerCase() ?? ''
  if (normalized === 'pl' || normalized.startsWith('pl-') || normalized.startsWith('pl_')) {
    return 'pl'
  }
  return 'en'
}

export function resolveElectronLanguage(
  language?: AppLanguage | null,
  systemLocale?: string | null,
): ElectronLocale {
  if (language === 'en' || language === 'pl') {
    return language
  }
  return resolveSystemLocale(systemLocale)
}

export function getActiveElectronLocale(): ElectronLocale {
  try {
    const settings = getAppSettings()
    const systemLocale = getElectronApp()?.getLocale?.()
    return resolveElectronLanguage(settings.language, systemLocale)
  } catch {
    return 'en'
  }
}

export interface ElectronLocaleStrings {
  pickLibraryRootTitle: string
  discord: {
    listeningInIotaPlayer: string
    browsingLibrary: string
    paused: string
    repeatOne: string
    repeatAll: string
    listening: string
    sourceCode: string
    idle: string
    stopped: string
  }
  scanErrors: {
    unsupportedCodec: (filePath: string, details: string) => string
    missingFile: (filePath: string, details: string) => string
    io: (filePath: string, details: string) => string
  }
}

const ELECTRON_STRINGS: Record<ElectronLocale, ElectronLocaleStrings> = {
  en: {
    pickLibraryRootTitle: 'Select your music library folder',
    discord: {
      listeningInIotaPlayer: 'Listening in iotaPlayer',
      browsingLibrary: 'Browsing the library',
      paused: 'Paused',
      repeatOne: 'Repeat one',
      repeatAll: 'Repeat all',
      listening: 'Listening',
      sourceCode: 'Source code',
      idle: 'Idle',
      stopped: 'Stopped',
    },
    scanErrors: {
      unsupportedCodec: (filePath, details) =>
        `${filePath}: Unsupported or unreadable codec/file format (${details})`,
      missingFile: (filePath, details) =>
        `${filePath}: File is missing or no longer accessible (${details})`,
      io: (filePath, details) =>
        `${filePath}: File could not be read (${details})`,
    },
  },
  pl: {
    pickLibraryRootTitle: 'Wybierz folder biblioteki muzycznej',
    discord: {
      listeningInIotaPlayer: 'Słucha w iotaPlayer',
      browsingLibrary: 'Przegląda bibliotekę',
      paused: 'Wstrzymano',
      repeatOne: 'Powtarzanie jednego',
      repeatAll: 'Powtarzanie wszystkich',
      listening: 'Słuchanie',
      sourceCode: 'Kod źródłowy',
      idle: 'Bezczynny',
      stopped: 'Zatrzymano',
    },
    scanErrors: {
      unsupportedCodec: (filePath, details) =>
        `${filePath}: Nieobsługiwany lub nieczytelny kodek/format pliku (${details})`,
      missingFile: (filePath, details) =>
        `${filePath}: Plik nie istnieje lub jest niedostępny (${details})`,
      io: (filePath, details) =>
        `${filePath}: Nie udało się odczytać pliku (${details})`,
    },
  },
}

export function getElectronStrings(locale?: ElectronLocale): ElectronLocaleStrings {
  const activeLocale = locale ?? getActiveElectronLocale()
  return ELECTRON_STRINGS[activeLocale] ?? ELECTRON_STRINGS.en
}
