import i18n from './index'

export function getActiveLocale(): string {
  return i18n.resolvedLanguage ?? i18n.language ?? 'en'
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale: string = getActiveLocale(),
): string {
  return new Intl.NumberFormat(locale, options).format(value)
}

export function formatDate(
  value: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
  locale: string = getActiveLocale(),
): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale, options).format(date)
}

export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: string = getActiveLocale(),
): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit)
}

export function formatLanguageDisplayName(
  code: string,
  locale: string = getActiveLocale(),
): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}
