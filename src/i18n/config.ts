export type SupportedLocale = 'en' | 'pl'
export type AppLanguage = 'system' | SupportedLocale

export const DEFAULT_LOCALE: SupportedLocale = 'en'
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'pl'] as const

export const I18N_NAMESPACES = [
  'common',
  'player',
  'library',
  'playlists',
  'settings',
] as const

export type I18nNamespace = (typeof I18N_NAMESPACES)[number]

export function normalizeAppLanguage(value: unknown): AppLanguage {
  if (value === 'en' || value === 'pl' || value === 'system') {
    return value
  }
  return 'system'
}

export function resolveSystemLocale(rawLocale?: string | null): SupportedLocale {
  const candidate = (
    rawLocale ??
    (typeof navigator !== 'undefined' ? navigator.language : '')
  )
    .trim()
    .toLowerCase()

  if (!candidate) return DEFAULT_LOCALE

  const base = candidate.split(/[-_]/)[0]
  if (base === 'pl') return 'pl'
  if (base === 'en') return 'en'
  return DEFAULT_LOCALE
}

export function resolveAppLanguage(
  preference: AppLanguage,
  systemLocale?: string | null,
): SupportedLocale {
  if (preference === 'en' || preference === 'pl') {
    return preference
  }
  return resolveSystemLocale(systemLocale)
}
