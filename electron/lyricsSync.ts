import type {
  LyricLine,
  LyricsResult,
  PlaybackStateEvent,
  SyncQuality,
} from './types'

export interface LyricsSyncState {
  activeIndex: number
  activeLine: LyricLine | null
  isWithinLineBounds: boolean
  synchronized: boolean
  syncQuality: SyncQuality
  position: number
  backend: 'mpv' | 'browser' | 'idle'
}

export function determineSyncQuality(lines: LyricLine[]): SyncQuality {
  if (!Array.isArray(lines) || lines.length === 0) {
    return 'none'
  }

  const hasWordTiming = lines.some(
    (line) =>
      !line.isGap &&
      Array.isArray(line.words) &&
      line.words.length > 0 &&
      line.words.some((w) => typeof w.timestamp === 'number' && Number.isFinite(w.timestamp)),
  )
  if (hasWordTiming) {
    return 'word'
  }

  const hasLineTiming = lines.some(
    (line) => typeof line.timestamp === 'number' && Number.isFinite(line.timestamp),
  )
  if (hasLineTiming) {
    return 'line'
  }

  return 'none'
}

export function getSyncQualityRank(quality: SyncQuality | undefined): number {
  switch (quality) {
    case 'word':
      return 2
    case 'line':
      return 1
    case 'none':
    default:
      return 0
  }
}

export function formatLyricsSourceLabel(result: LyricsResult | null | undefined): string | null {
  if (!result || !result.source) {
    return null
  }

  const syncQuality = result.syncQuality ?? determineSyncQuality(result.lines)
  const isSynced = Boolean(result.synchronized && syncQuality !== 'none')
  const format = result.format ?? null

  if (result.source === 'embedded') {
    if (!isSynced || format === 'plain') {
      return 'Embedded · Plain'
    }
    if (format === 'lyricsfile') {
      return 'Embedded · Lyricsfile'
    }
    return 'Embedded'
  }

  if (result.source === 'sidecar-lyricsfile' || format === 'lyricsfile') {
    return 'Sidecar · Lyricsfile'
  }

  if (format === 'lrc' || format === 'enhanced-lrc') {
    return 'Sidecar · LRC'
  }

  if (result.source === 'sidecar-lrc') {
    return isSynced ? 'Sidecar · LRC' : 'Sidecar · Plain'
  }

  if (result.source === 'sidecar-text') {
    return isSynced ? 'Sidecar · LRC' : 'Sidecar · Plain'
  }

  return null
}

export function getActiveLyricIndex(
  lyricsOrLines: LyricsResult | LyricLine[] | null | undefined,
  position: number,
): number {
  if (!lyricsOrLines) return -1
  if (typeof position !== 'number' || !Number.isFinite(position) || position < 0) {
    return -1
  }

  const lines = Array.isArray(lyricsOrLines) ? lyricsOrLines : lyricsOrLines.lines
  if (!Array.isArray(lines) || lines.length === 0) {
    return -1
  }

  if (!Array.isArray(lyricsOrLines)) {
    const quality = lyricsOrLines.syncQuality ?? determineSyncQuality(lines)
    if (!lyricsOrLines.synchronized || quality === 'none') {
      return -1
    }
  } else if (determineSyncQuality(lines) === 'none') {
    return -1
  }

  let active = -1
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (line.timestamp != null && Number.isFinite(line.timestamp) && line.timestamp <= position) {
      active = index
    }
  }

  return active
}

export function getLyricsSyncState(
  lyrics: LyricsResult | null | undefined,
  playback: PlaybackStateEvent | number,
): LyricsSyncState {
  const rawPosition = typeof playback === 'number' ? playback : playback?.position
  const position =
    typeof rawPosition === 'number' && Number.isFinite(rawPosition) && rawPosition >= 0
      ? rawPosition
      : 0
  const backend =
    typeof playback === 'object' && playback !== null && playback.backend
      ? playback.backend
      : 'idle'

  if (!lyrics || !Array.isArray(lyrics.lines) || lyrics.lines.length === 0) {
    return {
      activeIndex: -1,
      activeLine: null,
      isWithinLineBounds: false,
      synchronized: false,
      syncQuality: 'none',
      position,
      backend,
    }
  }

  const syncQuality = lyrics.syncQuality ?? determineSyncQuality(lyrics.lines)
  const synchronized = Boolean(lyrics.synchronized && syncQuality !== 'none')
  const activeIndex = synchronized ? getActiveLyricIndex(lyrics, position) : -1
  const activeLine = activeIndex >= 0 ? lyrics.lines[activeIndex] ?? null : null
  const isWithinLineBounds = Boolean(
    activeLine &&
      activeLine.timestamp != null &&
      position >= activeLine.timestamp &&
      (activeLine.endTimestamp == null || position <= activeLine.endTimestamp),
  )

  return {
    activeIndex,
    activeLine,
    isWithinLineBounds,
    synchronized,
    syncQuality,
    position,
    backend,
  }
}
