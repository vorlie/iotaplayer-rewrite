import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
  DEFAULT_LOCALE,
  I18N_NAMESPACES,
  resolveAppLanguage,
  SUPPORTED_LOCALES,
  type AppLanguage,
  type SupportedLocale,
} from './config'
import enCommon from './locales/en/common.json'
import enLibrary from './locales/en/library.json'
import enPlayer from './locales/en/player.json'
import enPlaylists from './locales/en/playlists.json'
import enSettings from './locales/en/settings.json'
import plCommon from './locales/pl/common.json'
import plLibrary from './locales/pl/library.json'
import plPlayer from './locales/pl/player.json'
import plPlaylists from './locales/pl/playlists.json'
import plSettings from './locales/pl/settings.json'
import './types'

export const resources = {
  en: {
    common: enCommon,
    player: enPlayer,
    library: enLibrary,
    playlists: enPlaylists,
    settings: enSettings,
  },
  pl: {
    common: plCommon,
    player: plPlayer,
    library: plLibrary,
    playlists: plPlaylists,
    settings: plSettings,
  },
} as const

let initPromise: Promise<typeof i18n> | null = null

export function initI18n(
  initialPreference: AppLanguage = 'system',
  systemLocale?: string | null,
): Promise<typeof i18n> {
  if (initPromise) return initPromise

  const initialLng = resolveAppLanguage(initialPreference, systemLocale)

  initPromise = i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: initialLng,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: [...SUPPORTED_LOCALES],
      ns: [...I18N_NAMESPACES],
      defaultNS: 'common',
      interpolation: {
        escapeValue: false,
      },
      returnNull: false,
    })
    .then(() => {
      if (typeof document !== 'undefined') {
        document.documentElement.lang = i18n.resolvedLanguage ?? initialLng
      }
      return i18n
    })

  return initPromise
}

export async function applyAppLanguage(
  preference: AppLanguage,
  systemLocale?: string | null,
): Promise<SupportedLocale> {
  await initI18n(preference, systemLocale)
  const target = resolveAppLanguage(preference, systemLocale)
  if (i18n.language !== target) {
    await i18n.changeLanguage(target)
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = target
  }
  return target
}

// Initialize immediately with system/browser locale; Milestone 3 wires persisted settings
void initI18n()

export default i18n
