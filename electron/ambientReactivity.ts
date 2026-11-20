export type AmbientRangeMode = 'average' | 'peak'

export interface AmbientReactivityConfig {
  enabled: boolean
  freqStart: number
  freqEnd: number
  ampFloor: number
  ampCeiling: number
  spectrumCeiling: number
  spectrumScale: number
  mode: AmbientRangeMode
  release: number
  intensity: number
}

export const DEFAULT_AMBIENT_REACTIVITY: AmbientReactivityConfig = {
  enabled: true,
  freqStart: 0,
  freqEnd: 0.25,
  ampFloor: 0,
  ampCeiling: 1,
  spectrumCeiling: 1.5,
  spectrumScale: 1,
  mode: 'average',
  release: 5,
  intensity: 0.9,
}

export const AMBIENT_REACTIVITY_PRESETS: Record<
  'lowTones' | 'subBass' | 'fullBeat' | 'off',
  AmbientReactivityConfig
> = {
  lowTones: { ...DEFAULT_AMBIENT_REACTIVITY },
  subBass: {
    enabled: true,
    freqStart: 0,
    freqEnd: 0.14,
    ampFloor: 0.2,
    ampCeiling: 0.95,
    spectrumCeiling: 1.5,
    spectrumScale: 1,
    mode: 'peak',
    release: 6,
    intensity: 0.9,
  },
  fullBeat: {
    enabled: true,
    freqStart: 0,
    freqEnd: 0.65,
    ampFloor: 0.1,
    ampCeiling: 0.9,
    spectrumCeiling: 1.5,
    spectrumScale: 1,
    mode: 'average',
    release: 5,
    intensity: 0.9,
  },
  off: {
    ...DEFAULT_AMBIENT_REACTIVITY,
    enabled: false,
  },
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function normalizeAmbientReactivity(
  value: unknown,
  fallback: AmbientReactivityConfig = DEFAULT_AMBIENT_REACTIVITY,
): AmbientReactivityConfig {
  if (!value || typeof value !== 'object') {
    return { ...fallback }
  }

  const raw = value as Partial<AmbientReactivityConfig>
  const freqStart = clamp(
    typeof raw.freqStart === 'number' && Number.isFinite(raw.freqStart)
      ? raw.freqStart
      : fallback.freqStart,
    0,
    0.95,
  )
  const freqEnd = clamp(
    typeof raw.freqEnd === 'number' && Number.isFinite(raw.freqEnd)
      ? raw.freqEnd
      : fallback.freqEnd,
    Math.min(1, freqStart + 0.05),
    1,
  )
  const spectrumCeiling = clamp(
    typeof raw.spectrumCeiling === 'number' && Number.isFinite(raw.spectrumCeiling)
      ? raw.spectrumCeiling
      : fallback.spectrumCeiling,
    1.0,
    3.0,
  )
  const spectrumScale = clamp(
    typeof raw.spectrumScale === 'number' && Number.isFinite(raw.spectrumScale)
      ? raw.spectrumScale
      : fallback.spectrumScale,
    0.25,
    2.5,
  )
  const ampFloor = clamp(
    typeof raw.ampFloor === 'number' && Number.isFinite(raw.ampFloor)
      ? raw.ampFloor
      : fallback.ampFloor,
    0,
    Math.max(0, spectrumCeiling - 0.1),
  )
  const ampCeiling = clamp(
    typeof raw.ampCeiling === 'number' && Number.isFinite(raw.ampCeiling)
      ? raw.ampCeiling
      : fallback.ampCeiling,
    Math.min(spectrumCeiling, ampFloor + 0.1),
    spectrumCeiling,
  )
  const mode: AmbientRangeMode =
    raw.mode === 'peak' || raw.mode === 'average' ? raw.mode : fallback.mode
  const release = clamp(
    typeof raw.release === 'number' && Number.isFinite(raw.release)
      ? raw.release
      : fallback.release,
    1,
    15,
  )
  const intensity = clamp(
    typeof raw.intensity === 'number' && Number.isFinite(raw.intensity)
      ? raw.intensity
      : fallback.intensity,
    0,
    1.2,
  )

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : fallback.enabled,
    freqStart,
    freqEnd,
    ampFloor,
    ampCeiling,
    spectrumCeiling,
    spectrumScale,
    mode,
    release,
    intensity,
  }
}

export function evaluateSpectrumRange(
  spectrum: readonly number[],
  config: AmbientReactivityConfig,
): number {
  if (!config.enabled || spectrum.length === 0) {
    return 0
  }

  const len = spectrum.length
  const startIdx = clamp(Math.floor(config.freqStart * len), 0, len - 1)
  const endIdx = clamp(Math.ceil(config.freqEnd * len) - 1, startIdx, len - 1)
  const span = Math.max(0.05, config.ampCeiling - config.ampFloor)

  let sum = 0
  let peak = 0
  let count = 0

  const scale = typeof config.spectrumScale === 'number' ? config.spectrumScale : 1

  for (let i = startIdx; i <= endIdx; i++) {
    const scaled = spectrum[i] * scale
    const normalized = clamp((scaled - config.ampFloor) / span, 0, 1)
    sum += normalized
    if (normalized > peak) {
      peak = normalized
    }
    count++
  }

  if (count === 0) return 0
  return config.mode === 'peak' ? peak : sum / count
}

export function stepAmbientExposure(
  prevEnvelope: number,
  audioLev: number,
  dtSeconds: number,
  config: AmbientReactivityConfig,
): { envelope: number; exposure: number } {
  const safeDt = Math.max(0, Math.min(0.25, dtSeconds))
  const envelope = Math.max(
    prevEnvelope * Math.exp(-config.release * safeDt),
    clamp(audioLev, 0, 1),
  )
  const rawExposure = -1.0 + envelope * 2.5
  const exposure = clamp(rawExposure, -1.0, config.intensity)
  return { envelope, exposure }
}
