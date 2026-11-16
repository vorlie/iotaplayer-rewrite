import type {
  LyricLine,
  LyricsResult,
  LyricWord,
  PlaybackStateEvent,
  SyncQuality,
} from './types'

export type WordSyncStatus = 'past' | 'active' | 'upcoming'

export interface LyricWordSyncState {
  index: number
  word: LyricWord
  status: WordSyncStatus
  /** Fractional progress (0 to 1) across the word's time span. */
  progress: number
  /** Resolved end timestamp in seconds used for progress calculation. */
  resolvedEndTimestamp: number
}

export interface LyricsSyncState {
  activeIndex: number
  activeLine: LyricLine | null
  activeWordIndex: number
  activeWord: LyricWord | null
  wordProgress: number
  words: LyricWordSyncState[]
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

export function getLineWordSyncStates(
  line: LyricLine | null | undefined,
  position: number,
  nextLineTimestamp?: number,
): LyricWordSyncState[] {
  if (!line || !Array.isArray(line.words) || line.words.length === 0) {
    return []
  }

  const validPos = typeof position === 'number' && Number.isFinite(position) ? position : -1
  const words = line.words

  return words.map((word, index) => {
    const start = word.timestamp
    const nextWordStart = index + 1 < words.length ? words[index + 1].timestamp : undefined
    const rawEnd =
      word.endTimestamp != null && Number.isFinite(word.endTimestamp)
        ? word.endTimestamp
        : nextWordStart != null && Number.isFinite(nextWordStart)
          ? nextWordStart
          : line.endTimestamp != null && Number.isFinite(line.endTimestamp)
            ? line.endTimestamp
            : nextLineTimestamp != null && Number.isFinite(nextLineTimestamp)
              ? nextLineTimestamp
              : start + 0.5
    const end = Math.max(start, rawEnd)

    if (validPos < start) {
      return {
        index,
        word,
        status: 'upcoming',
        progress: 0,
        resolvedEndTimestamp: end,
      }
    }

    if (validPos >= end && (end > start || validPos > start)) {
      return {
        index,
        word,
        status: 'past',
        progress: 1,
        resolvedEndTimestamp: end,
      }
    }

    const span = end - start
    const progress = span > 0 ? Math.max(0, Math.min(1, (validPos - start) / span)) : 1

    return {
      index,
      word,
      status: 'active',
      progress,
      resolvedEndTimestamp: end,
    }
  })
}

export function getActiveWordIndex(
  line: LyricLine | null | undefined,
  position: number,
  nextLineTimestamp?: number,
): number {
  const states = getLineWordSyncStates(line, position, nextLineTimestamp)
  if (states.length === 0) return -1

  const active = states.find((s) => s.status === 'active')
  return active ? active.index : -1
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
      activeWordIndex: -1,
      activeWord: null,
      wordProgress: 0,
      words: [],
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
  const nextLine =
    activeIndex >= 0 && activeIndex + 1 < lyrics.lines.length
      ? lyrics.lines[activeIndex + 1]
      : undefined

  const words =
    activeLine && Array.isArray(activeLine.words) && activeLine.words.length > 0
      ? getLineWordSyncStates(activeLine, position, nextLine?.timestamp)
      : []

  const activeWordState = words.find((w) => w.status === 'active') ?? null
  const activeWordIndex = activeWordState
    ? activeWordState.index
    : getActiveWordIndex(activeLine, position, nextLine?.timestamp)
  const activeWord =
    activeWordIndex >= 0 && activeLine?.words ? activeLine.words[activeWordIndex] ?? null : null
  const wordProgress = activeWordState
    ? activeWordState.progress
    : activeWordIndex >= 0
      ? 1
      : 0

  const isWithinLineBounds = Boolean(
    activeLine &&
      activeLine.timestamp != null &&
      position >= activeLine.timestamp &&
      (activeLine.endTimestamp == null || position <= activeLine.endTimestamp),
  )

  return {
    activeIndex,
    activeLine,
    activeWordIndex,
    activeWord,
    wordProgress,
    words,
    isWithinLineBounds,
    synchronized,
    syncQuality,
    position,
    backend,
  }
}
