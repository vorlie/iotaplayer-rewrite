import { determineSyncQuality, formatLyricsSourceLabel } from '../../electron/lyricsSync'
import type { LyricsResult } from '../../electron/types'
import i18n from './index'

export function getLocalizedLyricsSourceLabel(
  result: LyricsResult | null | undefined,
): string | null {
  if (!result || !result.source) {
    return null
  }

  const syncQuality = result.syncQuality ?? determineSyncQuality(result.lines)
  const isSynced = Boolean(result.synchronized && syncQuality !== 'none')
  const format = result.format ?? null

  if (result.source === 'embedded') {
    if (!isSynced || format === 'plain') {
      return i18n.t('player:lyricsSources.embeddedPlain')
    }
    if (format === 'lyricsfile') {
      return i18n.t('player:lyricsSources.embeddedLyricsfile')
    }
    return i18n.t('player:lyricsSources.embedded')
  }

  if (result.source === 'sidecar-lyricsfile' || format === 'lyricsfile') {
    return i18n.t('player:lyricsSources.sidecarLyricsfile')
  }

  if (format === 'lrc' || format === 'enhanced-lrc') {
    return i18n.t('player:lyricsSources.sidecarLrc')
  }

  if (result.source === 'sidecar-lrc' || result.source === 'sidecar-text') {
    return isSynced
      ? i18n.t('player:lyricsSources.sidecarLrc')
      : i18n.t('player:lyricsSources.sidecarPlain')
  }

  return formatLyricsSourceLabel(result)
}
