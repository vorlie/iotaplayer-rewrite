import type { Track } from './types'

export type QualityTier = 'hi-res' | 'lossless' | 'lossy' | 'unknown'

export interface AudioQualityInfo {
  tier: QualityTier
  codecLabel: string
  badgeLabel: string
  shortLabel: string
  sampleRateLabel: string | null
  bitDepthLabel: string | null
  bitrateLabel: string | null
  isLossless: boolean
  isHiRes: boolean
}

export type AudioQualityInput = Pick<
  Track,
  'codec' | 'format' | 'bitrate' | 'sample_rate' | 'bits_per_sample' | 'path' | 'is_lossless'
>

const LOSSLESS_CODEC_PATTERNS: Array<[RegExp, string]> = [
  [/\bflac\b/i, 'FLAC'],
  [/\balac\b/i, 'ALAC'],
  [/\bwavpack\b|\bwv\b/i, 'WavPack'],
  [/\bmonkey|\bape\b/i, 'APE'],
  [/\bdsd\b|\bdsf\b|\bdff\b|\bdst\b/i, 'DSD'],
  [/\baiff\b|\baif\b/i, 'AIFF'],
  [/\bpcm\b|\bwave\b|\bwav\b/i, 'PCM'],
  [/\bmlp\b|\btruehd\b/i, 'TrueHD'],
]

const LOSSY_CODEC_PATTERNS: Array<[RegExp, string]> = [
  [/\bmp3\b|mpeg\s*1\s*layer\s*3|mpeg\s*2\s*layer\s*3|lame/i, 'MP3'],
  [/\baac\b|mpeg-4\s*aac|lc-aac|he-aac/i, 'AAC'],
  [/\bopus\b/i, 'Opus'],
  [/\bvorbis\b/i, 'Vorbis'],
  [/\bwma\b|windows media audio/i, 'WMA'],
  [/\bmusepack\b|\bmpc\b/i, 'MPC'],
  [/\bac-?3\b|\be-?ac-?3\b/i, 'AC-3'],
]

const EXTENSION_CODEC_LABELS: Record<string, { label: string; lossless: boolean | null }> = {
  '.flac': { label: 'FLAC', lossless: true },
  '.wav': { label: 'WAV', lossless: true },
  '.aiff': { label: 'AIFF', lossless: true },
  '.aif': { label: 'AIFF', lossless: true },
  '.wv': { label: 'WavPack', lossless: true },
  '.ape': { label: 'APE', lossless: true },
  '.dsf': { label: 'DSD', lossless: true },
  '.dff': { label: 'DSD', lossless: true },
  '.mp3': { label: 'MP3', lossless: false },
  '.aac': { label: 'AAC', lossless: false },
  '.ogg': { label: 'Ogg', lossless: false },
  '.opus': { label: 'Opus', lossless: false },
  '.wma': { label: 'WMA', lossless: false },
  '.mpc': { label: 'MPC', lossless: false },
  '.m4a': { label: 'M4A', lossless: null }, // Could be AAC (lossy) or ALAC (lossless)
}

function getExtension(filePath?: string | null): string {
  if (!filePath) return ''
  const dot = filePath.lastIndexOf('.')
  if (dot < 0) return ''
  return filePath.slice(dot).toLowerCase()
}

export function normalizeCodecLabel(
  codec?: string | null,
  format?: string | null,
  filePath?: string | null,
): string {
  const combined = `${codec ?? ''} ${format ?? ''}`.trim()

  for (const [pattern, label] of LOSSLESS_CODEC_PATTERNS) {
    if (pattern.test(combined)) {
      if (label === 'PCM' && getExtension(filePath) === '.wav') return 'WAV'
      if (label === 'PCM' && (getExtension(filePath) === '.aiff' || getExtension(filePath) === '.aif')) {
        return 'AIFF'
      }
      return label
    }
  }

  for (const [pattern, label] of LOSSY_CODEC_PATTERNS) {
    if (pattern.test(combined)) {
      return label
    }
  }

  if (codec && codec.trim()) {
    return codec.trim().toUpperCase()
  }

  const ext = getExtension(filePath)
  if (ext && EXTENSION_CODEC_LABELS[ext]) {
    return EXTENSION_CODEC_LABELS[ext].label
  }

  if (format && format.trim()) {
    return format.trim().toUpperCase()
  }

  return 'AUDIO'
}

export function detectIsLossless(input: AudioQualityInput): boolean | null {
  if (input.is_lossless === 1) return true
  if (input.is_lossless === 0) return false

  const codecText = `${input.codec ?? ''} ${input.format ?? ''}`.trim()
  for (const [pattern] of LOSSY_CODEC_PATTERNS) {
    if (pattern.test(codecText)) return false
  }
  for (const [pattern] of LOSSLESS_CODEC_PATTERNS) {
    if (pattern.test(codecText)) return true
  }

  const ext = getExtension(input.path)
  if (ext && EXTENSION_CODEC_LABELS[ext]) {
    return EXTENSION_CODEC_LABELS[ext].lossless
  }

  return null
}

export function formatSampleRate(sampleRate?: number | null): string | null {
  if (!sampleRate || sampleRate <= 0) return null
  const khz = sampleRate / 1000
  return `${Number.isInteger(khz) ? khz.toFixed(0) : khz.toFixed(1).replace(/\.0$/, '')} kHz`
}

export function classifyAudioQuality(input: AudioQualityInput): AudioQualityInfo {
  const codecLabel = normalizeCodecLabel(input.codec, input.format, input.path)
  const detectedLossless = detectIsLossless(input)
  const isLossless = detectedLossless === true
  const isHiRes =
    isLossless &&
    ((input.sample_rate != null && input.sample_rate > 48000) ||
      (input.bits_per_sample != null && input.bits_per_sample > 16))

  let tier: QualityTier = 'unknown'
  if (isHiRes) {
    tier = 'hi-res'
  } else if (isLossless) {
    tier = 'lossless'
  } else if (detectedLossless === false || input.bitrate != null || input.codec != null || input.format != null) {
    tier = 'lossy'
  }

  const sampleRateLabel = formatSampleRate(input.sample_rate)
  const bitDepthLabel =
    input.bits_per_sample != null && input.bits_per_sample > 0
      ? `${input.bits_per_sample}-bit`
      : null
  const bitrateLabel =
    input.bitrate != null && input.bitrate > 0 ? `${Math.round(input.bitrate)} kbps` : null

  let badgeLabel = codecLabel
  let shortLabel = codecLabel

  if (tier === 'hi-res') {
    const khz =
      input.sample_rate != null && input.sample_rate > 0
        ? `${Number.isInteger(input.sample_rate / 1000) ? input.sample_rate / 1000 : (input.sample_rate / 1000).toFixed(1)}`
        : null
    if (input.bits_per_sample && khz) {
      badgeLabel = `${codecLabel} ${input.bits_per_sample}/${khz}`
    } else {
      badgeLabel = `${codecLabel} Hi-Res`
    }
    shortLabel = `${codecLabel} Hi-Res`
  } else if (tier === 'lossless') {
    badgeLabel = codecLabel
    shortLabel = codecLabel
  } else if (tier === 'lossy') {
    if (input.bitrate != null && input.bitrate > 0) {
      badgeLabel = `${codecLabel} ${Math.round(input.bitrate)}`
      shortLabel = `${codecLabel} ${Math.round(input.bitrate)}k`
    }
  }

  return {
    tier,
    codecLabel,
    badgeLabel,
    shortLabel,
    sampleRateLabel,
    bitDepthLabel,
    bitrateLabel,
    isLossless,
    isHiRes,
  }
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(decimals)} ${units[unitIndex]}`
}
