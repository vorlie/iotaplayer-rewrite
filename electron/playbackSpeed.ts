export const MIN_PLAYBACK_RATE = 0.5
export const MAX_PLAYBACK_RATE = 1.5
export const DEFAULT_PLAYBACK_RATE = 1.0
export const PLAYBACK_RATE_STEP = 0.01
export const DEFAULT_PRESERVE_PITCH = true

export type PlaybackSpeedPresetName =
  | 'Normal'
  | 'Nightcore'
  | 'Fast Nightcore'
  | 'Daycore'
  | 'Slowed'
  | 'Custom'

export interface PlaybackPreferences {
  playbackRate: number
  preservePitch: boolean
}

export interface PlaybackSpeedPreset extends PlaybackPreferences {
  name: Exclude<PlaybackSpeedPresetName, 'Custom'>
  label: string
  description: string
}

export const PLAYBACK_SPEED_PRESETS: readonly PlaybackSpeedPreset[] = [
  {
    name: 'Normal',
    label: 'Normal (1.00×)',
    description: 'Original tempo and pitch',
    playbackRate: 1.0,
    preservePitch: true,
  },
  {
    name: 'Nightcore',
    label: 'Nightcore (1.16×)',
    description: 'Classic +16% speed and pitch boost',
    playbackRate: 1.16,
    preservePitch: false,
  },
  {
    name: 'Fast Nightcore',
    label: 'Fast Nightcore (1.25×)',
    description: 'High-energy +25% speed and pitch boost',
    playbackRate: 1.25,
    preservePitch: false,
  },
  {
    name: 'Daycore',
    label: 'Daycore (0.85×)',
    description: 'Deep −15% speed and pitch shift',
    playbackRate: 0.85,
    preservePitch: false,
  },
  {
    name: 'Slowed',
    label: 'Slowed (0.90×)',
    description: 'Relaxed −10% speed and pitch shift',
    playbackRate: 0.9,
    preservePitch: false,
  },
] as const

export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
  playbackRate: DEFAULT_PLAYBACK_RATE,
  preservePitch: DEFAULT_PRESERVE_PITCH,
}

export function normalizePlaybackRate(
  value: unknown,
  fallback: number = DEFAULT_PLAYBACK_RATE,
  min: number = MIN_PLAYBACK_RATE,
  max: number = MAX_PLAYBACK_RATE,
): number {
  const safeMin = Number.isFinite(min) && min > 0 ? min : MIN_PLAYBACK_RATE
  const safeMax = Number.isFinite(max) && max >= safeMin ? max : MAX_PLAYBACK_RATE
  const rawFallback =
    typeof fallback === 'number' && Number.isFinite(fallback)
      ? fallback
      : DEFAULT_PLAYBACK_RATE
  const safeFallback =
    Math.round(Math.max(safeMin, Math.min(safeMax, rawFallback)) * 100) / 100

  let parsed: number | null = null
  if (typeof value === 'number' && Number.isFinite(value)) {
    parsed = value
  } else if (typeof value === 'string' && value.trim()) {
    const num = Number(value.trim())
    if (Number.isFinite(num)) {
      parsed = num
    }
  }

  if (parsed === null) {
    return safeFallback
  }

  const clamped = Math.max(safeMin, Math.min(safeMax, parsed))
  return Math.round(clamped * 100) / 100
}

export function normalizePreservePitch(
  value: unknown,
  fallback: boolean = DEFAULT_PRESERVE_PITCH,
): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase()
    if (lower === 'true' || lower === '1' || lower === 'yes') return true
    if (lower === 'false' || lower === '0' || lower === 'no') return false
  }
  return Boolean(fallback)
}

export function normalizePlaybackPreferences(
  input?: Partial<{ playbackRate: unknown; preservePitch: unknown }> | null,
  fallback: PlaybackPreferences = DEFAULT_PLAYBACK_PREFERENCES,
): PlaybackPreferences {
  return {
    playbackRate: normalizePlaybackRate(input?.playbackRate, fallback.playbackRate),
    preservePitch: normalizePreservePitch(input?.preservePitch, fallback.preservePitch),
  }
}

export function matchPlaybackSpeedPreset(
  prefs: PlaybackPreferences,
): PlaybackSpeedPresetName {
  const rate = normalizePlaybackRate(prefs.playbackRate)
  const preserve = Boolean(prefs.preservePitch)

  for (const preset of PLAYBACK_SPEED_PRESETS) {
    if (
      Math.abs(preset.playbackRate - rate) < 1e-4 &&
      preset.preservePitch === preserve
    ) {
      return preset.name
    }
  }

  return 'Custom'
}

export function getPlaybackSpeedPreset(
  name: string,
): PlaybackSpeedPreset | null {
  return PLAYBACK_SPEED_PRESETS.find((preset) => preset.name === name) ?? null
}

export function calculatePitchSemitones(
  playbackRate: number,
  preservePitch: boolean,
): number {
  const rate = normalizePlaybackRate(playbackRate)
  if (preservePitch || rate <= 0) {
    return 0
  }
  const semitones = 12 * Math.log2(rate)
  const rounded = Math.round(semitones * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

export function formatPlaybackRate(rate: number): string {
  return `${normalizePlaybackRate(rate).toFixed(2)}×`
}

export function formatPitchSemitones(semitones: number): string {
  const clean = Math.abs(semitones) < 1e-4 ? 0 : semitones
  const sign = clean > 0 ? '+' : clean < 0 ? '−' : ''
  return `${sign}${Math.abs(clean).toFixed(2)} st`
}

export interface MediaInterpolationInput {
  anchorPosition: number
  anchorTimestampMs: number
  nowMs: number
  highWaterMark: number
  playbackRate: number
  duration?: number
}

export function interpolateMediaPosition({
  anchorPosition,
  anchorTimestampMs,
  nowMs,
  highWaterMark,
  playbackRate,
  duration = 0,
}: MediaInterpolationInput): number {
  const safeRate = normalizePlaybackRate(playbackRate, DEFAULT_PLAYBACK_RATE)
  const wallElapsedSeconds = Math.max(0, (nowMs - anchorTimestampMs) / 1000)
  const mediaElapsedSeconds = wallElapsedSeconds * safeRate
  const maxExtrapolation = 0.5 * safeRate
  const rawNext = anchorPosition + Math.min(maxExtrapolation, mediaElapsedSeconds)
  const monotonicNext = Math.max(highWaterMark, rawNext)
  return duration > 0 ? Math.min(duration, monotonicNext) : monotonicNext
}

