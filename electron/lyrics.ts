import fs from 'node:fs'
import path from 'node:path'
import { parseFile } from 'music-metadata'
import {
  determineSyncQuality,
  formatLyricsSourceLabel,
  getActiveLyricIndex,
  getLyricsSyncState,
  getSyncQualityRank,
  type LyricsSyncState,
} from './lyricsSync'
import type {
  LyricLine,
  LyricsFormat,
  LyricsResult,
  LyricsSource,
  LyricsSourcePreference,
  LyricWord,
  SyncQuality,
} from './types'

export {
  determineSyncQuality,
  formatLyricsSourceLabel,
  getActiveLyricIndex,
  getLyricsSyncState,
  getSyncQualityRank,
  type LyricsSyncState,
}

const EMPTY_LYRICS: LyricsResult = {
  source: null,
  format: null,
  syncQuality: 'none',
  lines: [],
  synchronized: false,
}

function attachParsedArrayMeta(
  lines: LyricLine[],
  meta: {
    format: LyricsFormat
    syncQuality: SyncQuality
    synchronized: boolean
    metadata?: Record<string, unknown>
    instrumental?: boolean
  },
): LyricLine[] {
  Object.defineProperties(lines, {
    lines: { value: lines, enumerable: false, configurable: true },
    format: { value: meta.format, enumerable: false, configurable: true },
    syncQuality: { value: meta.syncQuality, enumerable: false, configurable: true },
    synchronized: { value: meta.synchronized, enumerable: false, configurable: true },
    ...(meta.metadata !== undefined
      ? { metadata: { value: meta.metadata, enumerable: false, configurable: true } }
      : {}),
    ...(meta.instrumental !== undefined
      ? { instrumental: { value: meta.instrumental, enumerable: false, configurable: true } }
      : {}),
  })
  return lines
}

function collapseConsecutiveGaps(lines: LyricLine[]): LyricLine[] {
  const deduped: LyricLine[] = []
  for (const line of lines) {
    if (line.isGap && deduped.length > 0 && deduped[deduped.length - 1].isGap) {
      continue
    }
    deduped.push(line)
  }
  return deduped
}

export function textLines(text: string): LyricLine[] {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => ({ text: line.trimEnd() }))
    .filter((line) => line.text)
}

function parseTimestampMatch(minutes: string, seconds: string, fractionStr?: string): number {
  const fraction = fractionStr ? Number(`0.${fractionStr}`) : 0
  return Number(minutes) * 60 + Number(seconds) + fraction
}

function extractEnhancedLrcWords(
  rawSlice: string,
  lineTimestamp: number,
  offset: number,
): { words: LyricWord[]; endTimestamp?: number } {
  const wordRegex = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g
  const matches: Array<{ timestamp: number; start: number; end: number }> = []

  let match: RegExpExecArray | null
  while ((match = wordRegex.exec(rawSlice)) !== null) {
    const rawTime = parseTimestampMatch(match[1], match[2], match[3])
    matches.push({
      timestamp: Math.max(0, rawTime - offset),
      start: match.index,
      end: wordRegex.lastIndex,
    })
  }

  if (matches.length === 0) {
    return { words: [] }
  }

  const words: LyricWord[] = []
  let lineEndTimestamp: number | undefined

  const leadingText = rawSlice
    .slice(0, matches[0].start)
    .replace(/[ \t]*\n[ \t]*/g, ' ')
    .trim()

  if (leadingText) {
    words.push({
      text: leadingText,
      timestamp: lineTimestamp,
      endTimestamp: matches[0].timestamp,
    })
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]
    const nextStart = i + 1 < matches.length ? matches[i + 1].start : rawSlice.length
    const segmentText = rawSlice
      .slice(current.end, nextStart)
      .replace(/[ \t]*\n[ \t]*/g, ' ')
      .replace(/\s*\/$/, '')
      .trim()

    if (segmentText) {
      if (words.length > 0 && words[words.length - 1].endTimestamp == null) {
        words[words.length - 1].endTimestamp = current.timestamp
      }
      words.push({
        text: segmentText,
        timestamp: current.timestamp,
      })
    } else {
      if (words.length > 0 && words[words.length - 1].endTimestamp == null) {
        words[words.length - 1].endTimestamp = current.timestamp
      }
      if (i === matches.length - 1) {
        lineEndTimestamp = current.timestamp
      }
    }
  }

  if (lineEndTimestamp == null && words.length > 0) {
    const lastEnd = words[words.length - 1].endTimestamp
    if (lastEnd != null) {
      lineEndTimestamp = lastEnd
    }
  }

  return { words, endTimestamp: lineEndTimestamp }
}

export function parseLrc(text: string): LyricLine[] {
  const normalizedRaw = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  const offsetMatch = /\[offset:\s*(-?\d+)\s*]/i.exec(normalizedRaw)
  const offset = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0

  // Strip LRC metadata tag lines (e.g. [ti:...], [ar:...], [al:...], [offset:...]) so they don't get attached to lyric text
  const raw = normalizedRaw
    .replace(/^[ \t]*\[[a-zA-Z][a-zA-Z0-9_-]*:[^\]]*\][ \t]*\n?/gm, '')
    .trim()

  const timestamp = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?]/g
  const wordTimestamp = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g
  const stamps: Array<{ timestamp: number; start: number; end: number }> = []

  let match: RegExpExecArray | null
  while ((match = timestamp.exec(raw)) !== null) {
    stamps.push({
      timestamp: parseTimestampMatch(match[1], match[2], match[3]),
      start: match.index,
      end: timestamp.lastIndex,
    })
  }

  if (!stamps.length) {
    return attachParsedArrayMeta([], {
      format: null,
      syncQuality: 'none',
      synchronized: false,
    })
  }

  const lines: LyricLine[] = []
  const pending: number[] = []

  for (let index = 0; index < stamps.length; index++) {
    const stamp = stamps[index]
    pending.push(stamp.timestamp)
    const nextStart = index + 1 < stamps.length ? stamps[index + 1].start : raw.length

    // Consecutive timestamps share the lyric text that follows them.
    if (index + 1 < stamps.length && nextStart === stamp.end) continue

    const rawSlice = raw.slice(stamp.end, nextStart)
    const lyric = rawSlice
      .replace(wordTimestamp, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .trim()
      .replace(/\s*\/$/, '')
      .trim()

    const isGap = !lyric
    const baseTimestamp = pending[0]

    for (const value of pending) {
      const lineTime = Math.max(0, value - offset)
      const delta = value - baseTimestamp
      const { words: rawWords, endTimestamp: rawEnd } = !isGap
        ? extractEnhancedLrcWords(rawSlice, Math.max(0, baseTimestamp - offset), offset)
        : { words: [], endTimestamp: undefined }

      const shiftedWords =
        rawWords.length > 0
          ? rawWords.map((w) => ({
              text: w.text,
              timestamp: Math.max(0, w.timestamp + delta),
              ...(w.endTimestamp != null ? { endTimestamp: Math.max(0, w.endTimestamp + delta) } : {}),
            }))
          : undefined
      const shiftedEnd = rawEnd != null ? Math.max(0, rawEnd + delta) : undefined

      lines.push({
        text: lyric,
        timestamp: lineTime,
        ...(shiftedEnd != null ? { endTimestamp: shiftedEnd } : {}),
        isGap,
        ...(shiftedWords && shiftedWords.length > 0 ? { words: shiftedWords } : {}),
      })
    }
    pending.length = 0
  }

  const sorted = lines.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
  const deduped = collapseConsecutiveGaps(sorted)
  const syncQuality = determineSyncQuality(deduped)
  const format: LyricsFormat = syncQuality === 'word' ? 'enhanced-lrc' : 'lrc'

  return attachParsedArrayMeta(deduped, {
    format,
    syncQuality,
    synchronized: syncQuality !== 'none',
  })
}

// ---------------------------------------------------------------------------
// Lyricsfile YAML parser
// ---------------------------------------------------------------------------

function stripYamlComment(line: string): string {
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "'" && !inDouble) {
      if (inSingle && line[i + 1] === "'") {
        i++
        continue
      }
      inSingle = !inSingle
    } else if (ch === '"' && !inSingle) {
      if (inDouble && line[i - 1] === '\\') {
        continue
      }
      inDouble = !inDouble
    } else if (ch === '#' && !inSingle && !inDouble) {
      if (i === 0 || line[i - 1] === ' ' || line[i - 1] === '\t') {
        return line.slice(0, i).trimEnd()
      }
    }
  }
  return line.trimEnd()
}

function splitYamlKeyValue(text: string): { key: string; value: string } | null {
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
    } else if (ch === '"' && !inSingle && text[i - 1] !== '\\') {
      inDouble = !inDouble
    } else if (ch === ':' && !inSingle && !inDouble) {
      const next = text[i + 1]
      if (next === undefined || next === ' ' || next === '\t') {
        const key = text.slice(0, i).trim()
        if (!key) return null
        const unquotedKey =
          (key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))
            ? key.slice(1, -1)
            : key
        return {
          key: unquotedKey,
          value: text.slice(i + 1).trim(),
        }
      }
    }
  }
  return null
}

function parseYamlScalar(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed === 'null' || trimmed === '~') return null
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false

  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    const inner = trimmed.slice(1, -1)
    return inner.replace(/\\(["\\/nrt])/g, (_m, c) => {
      switch (c) {
        case 'n':
          return '\n'
        case 'r':
          return '\r'
        case 't':
          return '\t'
        default:
          return c
      }
    })
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/''/g, "'")
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed)
  }

  if (
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // Fall through to plain string if not valid JSON
    }
  }

  return trimmed
}

interface YamlLine {
  raw: string
  indent: number
  cleaned: string
  trimmed: string
}

function prepareYamlLines(text: string): YamlLine[] {
  const rawLines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
  return rawLines.map((raw) => {
    const indentMatch = /^[ \t]*/.exec(raw)
    const indent = indentMatch ? indentMatch[0].replace(/\t/g, '  ').length : 0
    const cleaned = stripYamlComment(raw)
    return {
      raw,
      indent,
      cleaned,
      trimmed: cleaned.trim(),
    }
  })
}

function isBlockScalarHeader(val: string): boolean {
  return /^[|>][-+]?$/.test(val)
}

function parseBlockScalar(
  lines: YamlLine[],
  startIndex: number,
  parentIndent: number,
  indicator: string,
): { value: string; nextIndex: number } {
  const collected: string[] = []
  let idx = startIndex
  let blockIndent: number | null = null

  while (idx < lines.length) {
    const line = lines[idx]
    const rawTrimmed = line.raw.trim()
    if (!rawTrimmed) {
      collected.push('')
      idx++
      continue
    }

    if (line.indent <= parentIndent) {
      break
    }

    if (blockIndent === null) {
      blockIndent = line.indent
    }

    collected.push(line.raw.slice(Math.min(line.raw.length, blockIndent)))
    idx++
  }

  const folded = indicator.startsWith('>')
  const keepTrailing = indicator.endsWith('+')
  let text = folded
    ? collected
        .reduce<string[]>((acc, curr) => {
          if (curr === '') {
            acc.push('\n')
          } else if (acc.length === 0 || acc[acc.length - 1] === '\n') {
            acc.push(curr)
          } else {
            acc[acc.length - 1] = `${acc[acc.length - 1]} ${curr}`
          }
          return acc
        }, [])
        .join('')
    : collected.join('\n')

  if (!keepTrailing) {
    text = text.replace(/\n+$/, '')
  }

  return { value: text, nextIndex: idx }
}

function nextMeaningfulYamlIndex(lines: YamlLine[], fromIndex: number): number {
  let idx = fromIndex
  while (idx < lines.length) {
    const t = lines[idx].trimmed
    if (t && t !== '---' && t !== '...') {
      return idx
    }
    idx++
  }
  return idx
}

function parseYamlMapping(
  lines: YamlLine[],
  startIndex: number,
  minIndent: number,
  target: Record<string, unknown> = {},
): { value: Record<string, unknown>; nextIndex: number } {
  let idx = startIndex

  while (idx < lines.length) {
    idx = nextMeaningfulYamlIndex(lines, idx)
    if (idx >= lines.length) break

    const line = lines[idx]
    if (line.indent < minIndent) break
    if (line.trimmed.startsWith('- ') || line.trimmed === '-') break

    const kv = splitYamlKeyValue(line.trimmed)
    if (!kv) {
      idx++
      continue
    }

    const keyIndent = line.indent
    idx++

    if (isBlockScalarHeader(kv.value)) {
      const block = parseBlockScalar(lines, idx, keyIndent, kv.value)
      target[kv.key] = block.value
      idx = block.nextIndex
    } else if (kv.value === '') {
      const peekIdx = nextMeaningfulYamlIndex(lines, idx)
      if (peekIdx < lines.length) {
        const nextLine = lines[peekIdx]
        const isSeqAtSameOrGreater =
          (nextLine.trimmed === '-' || nextLine.trimmed.startsWith('- ')) &&
          nextLine.indent >= keyIndent
        if (isSeqAtSameOrGreater) {
          const seq = parseYamlSequence(lines, peekIdx, nextLine.indent)
          target[kv.key] = seq.value
          idx = seq.nextIndex
          continue
        }
        if (nextLine.indent > keyIndent) {
          const nested = parseYamlMapping(lines, peekIdx, nextLine.indent)
          target[kv.key] = nested.value
          idx = nested.nextIndex
          continue
        }
      }
      target[kv.key] = kv.key === 'text' ? '' : null
    } else {
      target[kv.key] = parseYamlScalar(kv.value)
    }
  }

  return { value: target, nextIndex: idx }
}

function parseYamlSequence(
  lines: YamlLine[],
  startIndex: number,
  seqIndent: number,
): { value: unknown[]; nextIndex: number } {
  const items: unknown[] = []
  let idx = startIndex

  while (idx < lines.length) {
    idx = nextMeaningfulYamlIndex(lines, idx)
    if (idx >= lines.length) break

    const line = lines[idx]
    if (line.indent < seqIndent) break
    if (line.indent > seqIndent) break
    if (line.trimmed !== '-' && !line.trimmed.startsWith('- ')) break

    const afterDash = line.trimmed === '-' ? '' : line.trimmed.slice(2).trim()
    idx++

    if (!afterDash) {
      const peekIdx = nextMeaningfulYamlIndex(lines, idx)
      if (peekIdx < lines.length && lines[peekIdx].indent > seqIndent) {
        const nextLine = lines[peekIdx]
        if (nextLine.trimmed === '-' || nextLine.trimmed.startsWith('- ')) {
          const subSeq = parseYamlSequence(lines, peekIdx, nextLine.indent)
          items.push(subSeq.value)
          idx = subSeq.nextIndex
        } else {
          const subMap = parseYamlMapping(lines, peekIdx, nextLine.indent)
          items.push(subMap.value)
          idx = subMap.nextIndex
        }
      } else {
        items.push(null)
      }
      continue
    }

    const kv = splitYamlKeyValue(afterDash)
    if (kv) {
      const obj: Record<string, unknown> = {}
      const itemPropMinIndent = seqIndent + 1

      if (isBlockScalarHeader(kv.value)) {
        const block = parseBlockScalar(lines, idx, seqIndent, kv.value)
        obj[kv.key] = block.value
        idx = block.nextIndex
      } else if (kv.value === '') {
        const peekIdx = nextMeaningfulYamlIndex(lines, idx)
        if (peekIdx < lines.length && lines[peekIdx].indent > seqIndent) {
          const nextLine = lines[peekIdx]
          if (nextLine.trimmed === '-' || nextLine.trimmed.startsWith('- ')) {
            const subSeq = parseYamlSequence(lines, peekIdx, nextLine.indent)
            obj[kv.key] = subSeq.value
            idx = subSeq.nextIndex
          } else {
            const subMap = parseYamlMapping(lines, peekIdx, nextLine.indent)
            obj[kv.key] = subMap.value
            idx = subMap.nextIndex
          }
        } else {
          obj[kv.key] = kv.key === 'text' ? '' : null
        }
      } else {
        obj[kv.key] = parseYamlScalar(kv.value)
      }

      const rest = parseYamlMapping(lines, idx, itemPropMinIndent, obj)
      items.push(rest.value)
      idx = rest.nextIndex
    } else {
      items.push(parseYamlScalar(afterDash))
    }
  }

  return { value: items, nextIndex: idx }
}

function parseYamlDocument(text: string): Record<string, unknown> | null {
  try {
    const lines = prepareYamlLines(text)
    const firstIdx = nextMeaningfulYamlIndex(lines, 0)
    if (firstIdx >= lines.length) return null
    const firstLine = lines[firstIdx]
    if (!splitYamlKeyValue(firstLine.trimmed)) return null

    const parsed = parseYamlMapping(lines, firstIdx, firstLine.indent)
    return Object.keys(parsed.value).length > 0 ? parsed.value : null
  } catch {
    return null
  }
}

export function isLyricsfileYaml(text: string): boolean {
  const trimmed = text.replace(/^\uFEFF/, '').trim()
  if (!trimmed || trimmed.startsWith('[')) return false

  const doc = parseYamlDocument(trimmed)
  if (!doc) return false

  const hasValidLines =
    Array.isArray(doc.lines) &&
    (doc.lines.length === 0 ||
      doc.lines.every(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          ('text' in item || 'start_ms' in item || 'timestamp' in item || 'words' in item),
      ))

  const hasPlain = typeof doc.plain === 'string'
  const hasVersionOrMeta =
    doc.version != null || (typeof doc.metadata === 'object' && doc.metadata !== null)

  if (hasVersionOrMeta && (hasValidLines || hasPlain || doc.instrumental != null)) {
    return true
  }

  if (
    hasValidLines &&
    Array.isArray(doc.lines) &&
    doc.lines.length > 0 &&
    doc.lines.some((item: unknown) => {
      if (typeof item !== 'object' || item === null) return false
      const record = item as Record<string, unknown>
      return (
        typeof record.start_ms === 'number' ||
        Array.isArray(record.words) ||
        'text' in record
      )
    })
  ) {
    return true
  }

  if (hasPlain && Object.keys(doc).every((k) => ['plain', 'version', 'metadata', 'lines'].includes(k))) {
    return true
  }

  return false
}

export function parseLyricsfile(text: string): LyricLine[] {
  const doc = parseYamlDocument(text)
  if (!doc) {
    return attachParsedArrayMeta([], {
      format: 'lyricsfile',
      syncQuality: 'none',
      synchronized: false,
    })
  }

  const metadata =
    typeof doc.metadata === 'object' && doc.metadata !== null
      ? (doc.metadata as Record<string, unknown>)
      : undefined
  const instrumental = Boolean(doc.instrumental ?? metadata?.instrumental ?? false)
  const offsetMs = Number(doc.offset_ms ?? metadata?.offset_ms ?? 0) || 0
  const offsetSec = offsetMs / 1000

  if (Array.isArray(doc.lines) && doc.lines.length > 0) {
    const parsedLines: LyricLine[] = []

    for (const rawItem of doc.lines) {
      if (typeof rawItem !== 'object' || rawItem === null) continue
      const item = rawItem as Record<string, unknown>

      const words: LyricWord[] = []
      if (Array.isArray(item.words)) {
        for (const rawWord of item.words) {
          if (typeof rawWord !== 'object' || rawWord === null) continue
          const w = rawWord as Record<string, unknown>
          const wordStartMs =
            typeof w.start_ms === 'number'
              ? w.start_ms
              : typeof w.timestamp === 'number'
                ? w.timestamp * 1000
                : null
          if (wordStartMs == null || !Number.isFinite(wordStartMs)) continue

          const wordText = w.text != null ? String(w.text).trim() : ''
          if (!wordText) continue

          const wordTimestamp = Math.max(0, wordStartMs / 1000 - offsetSec)
          const wordEndMs =
            typeof w.end_ms === 'number'
              ? w.end_ms
              : typeof w.endTimestamp === 'number'
                ? w.endTimestamp * 1000
                : null
          const wordEndTimestamp =
            wordEndMs != null && Number.isFinite(wordEndMs)
              ? Math.max(wordTimestamp, wordEndMs / 1000 - offsetSec)
              : undefined

          words.push({
            text: wordText,
            timestamp: wordTimestamp,
            ...(wordEndTimestamp != null ? { endTimestamp: wordEndTimestamp } : {}),
          })
        }
      }

      const lineText =
        item.text != null
          ? String(item.text).trim()
          : words.length > 0
            ? words.map((w) => w.text).join(' ').trim()
            : ''

      const startMs =
        typeof item.start_ms === 'number'
          ? item.start_ms
          : typeof item.timestamp === 'number'
            ? item.timestamp * 1000
            : null
      const timestamp =
        startMs != null && Number.isFinite(startMs)
          ? Math.max(0, startMs / 1000 - offsetSec)
          : words.length > 0
            ? words[0].timestamp
            : undefined

      const endMs =
        typeof item.end_ms === 'number'
          ? item.end_ms
          : typeof item.endTimestamp === 'number'
            ? item.endTimestamp * 1000
            : null
      const endTimestamp =
        endMs != null && Number.isFinite(endMs)
          ? Math.max(timestamp ?? 0, endMs / 1000 - offsetSec)
          : words.length > 0 && words[words.length - 1].endTimestamp != null
            ? words[words.length - 1].endTimestamp
            : undefined

      const isGap = !lineText && timestamp != null
      if (!lineText && timestamp == null) continue

      parsedLines.push({
        text: lineText,
        ...(timestamp != null ? { timestamp } : {}),
        ...(endTimestamp != null ? { endTimestamp } : {}),
        isGap,
        ...(words.length > 0 ? { words } : {}),
      })
    }

    const hasTimestamps = parsedLines.some((l) => l.timestamp != null)
    const ordered = hasTimestamps
      ? [...parsedLines].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
      : parsedLines
    const deduped = collapseConsecutiveGaps(ordered)

    if (deduped.length > 0) {
      const syncQuality = determineSyncQuality(deduped)
      return attachParsedArrayMeta(deduped, {
        format: 'lyricsfile',
        syncQuality,
        synchronized: syncQuality !== 'none',
        metadata,
        instrumental,
      })
    }
  }

  if (typeof doc.plain === 'string' && doc.plain.trim()) {
    const plainLines = textLines(doc.plain)
    return attachParsedArrayMeta(plainLines, {
      format: 'lyricsfile',
      syncQuality: 'none',
      synchronized: false,
      metadata,
      instrumental,
    })
  }

  return attachParsedArrayMeta([], {
    format: 'lyricsfile',
    syncQuality: 'none',
    synchronized: false,
    metadata,
    instrumental,
  })
}

export function detectLyricsFormat(text: string): LyricsFormat {
  const raw = text.replace(/^\uFEFF/, '').trim()
  if (!raw) return null

  if (isLyricsfileYaml(raw)) {
    const yfLines = parseLyricsfile(raw) as LyricLine[] & { instrumental?: boolean }
    if (yfLines.length > 0 || yfLines.instrumental) {
      return 'lyricsfile'
    }
  }

  const lrcLines = parseLrc(raw)
  if (lrcLines.length > 0) {
    const quality = determineSyncQuality(lrcLines)
    return quality === 'word' ? 'enhanced-lrc' : 'lrc'
  }

  const plain = textLines(raw)
  if (plain.length > 0) {
    return 'plain'
  }

  return null
}

export function parseLyricsContent(text: string, source: LyricsSource = null): LyricsResult {
  const raw = text.replace(/^\uFEFF/, '').trim()
  if (!raw) return { ...EMPTY_LYRICS }

  if (isLyricsfileYaml(raw)) {
    const lines = parseLyricsfile(raw)
    if (lines.length > 0) {
      const syncQuality = determineSyncQuality(lines)
      return {
        source,
        format: 'lyricsfile',
        syncQuality,
        lines,
        synchronized: syncQuality !== 'none',
      }
    }
  }

  const lrcLines = parseLrc(raw)
  if (lrcLines.length > 0) {
    const syncQuality = determineSyncQuality(lrcLines)
    const format: LyricsFormat = syncQuality === 'word' ? 'enhanced-lrc' : 'lrc'
    return {
      source,
      format,
      syncQuality,
      lines: lrcLines,
      synchronized: syncQuality !== 'none',
    }
  }

  // Strip any leading LRC metadata tags before plain text fallback
  const strippedPlain = raw.replace(/^[ \t]*\[[a-zA-Z][a-zA-Z0-9_-]*:[^\]]*\][ \t]*\n?/gm, '').trim()
  const plainLines = textLines(strippedPlain)
  if (plainLines.length > 0) {
    return {
      source,
      format: 'plain',
      syncQuality: 'none',
      lines: plainLines,
      synchronized: false,
    }
  }

  return { ...EMPTY_LYRICS }
}

async function getEmbeddedLyrics(filePath: string): Promise<LyricsResult> {
  try {
    const metadata = await parseFile(filePath, { skipCovers: true })
    const candidates: LyricsResult[] = []

    const commonLyrics = metadata.common.lyrics ?? []
    for (const tag of commonLyrics) {
      if (Array.isArray(tag.syncText) && tag.syncText.length > 0) {
        const rawSynced = tag.syncText
          .filter((line) => line.timestamp != null)
          .map((line) => {
            const text = line.text ? line.text.trim() : ''
            return {
              text,
              timestamp: line.timestamp! / 1000,
              isGap: !text,
            }
          })
          .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))

        const synced = collapseConsecutiveGaps(rawSynced)
        if (synced.length > 0) {
          candidates.push({
            source: 'embedded',
            format: 'embedded',
            syncQuality: 'line',
            lines: synced,
            synchronized: true,
          })
        }
      }

      if (typeof tag.text === 'string' && tag.text.trim()) {
        const parsed = parseLyricsContent(tag.text, 'embedded')
        if (parsed.lines.length > 0) {
          candidates.push(parsed)
        }
      }
    }

    if (candidates.length === 0) {
      return { ...EMPTY_LYRICS }
    }

    candidates.sort((left, right) => {
      const rankDiff = getSyncQualityRank(right.syncQuality) - getSyncQualityRank(left.syncQuality)
      if (rankDiff !== 0) return rankDiff
      const leftNonGap = left.lines.filter((l) => !l.isGap && l.text.trim()).length
      const rightNonGap = right.lines.filter((l) => !l.isGap && l.text.trim()).length
      return rightNonGap - leftNonGap
    })

    return candidates[0]
  } catch {
    return { ...EMPTY_LYRICS }
  }
}

function getSidecarCandidates(filePath: string): LyricsResult[] {
  const basePath = path.join(
    path.dirname(filePath),
    path.basename(filePath, path.extname(filePath)),
  )

  const sidecarSpecs: Array<{ ext: string; defaultSource: LyricsSource }> = [
    { ext: '.lyricsfile.yaml', defaultSource: 'sidecar-lyricsfile' },
    { ext: '.lyricsfile.yml', defaultSource: 'sidecar-lyricsfile' },
    { ext: '.lyricsfile', defaultSource: 'sidecar-lyricsfile' },
    { ext: '.yaml', defaultSource: 'sidecar-lyricsfile' },
    { ext: '.yml', defaultSource: 'sidecar-lyricsfile' },
    { ext: '.lrc', defaultSource: 'sidecar-lrc' },
    { ext: '.elrc', defaultSource: 'sidecar-lrc' },
    { ext: '.txt', defaultSource: 'sidecar-text' },
  ]

  const candidates: LyricsResult[] = []

  for (const { ext, defaultSource } of sidecarSpecs) {
    const candidatePath = `${basePath}${ext}`
    try {
      if (!fs.existsSync(candidatePath)) continue
      const content = fs.readFileSync(candidatePath, 'utf8')
      const parsed = parseLyricsContent(content, defaultSource)
      if (parsed.lines.length > 0) {
        candidates.push(parsed)
      }
    } catch {
      // Ignore unreadable individual sidecars and continue checking remaining candidates.
    }
  }

  return candidates
}

function isEmbeddedSource(source: LyricsSource): boolean {
  return source === 'embedded'
}

export function resolveLyricsCandidates(
  candidates: LyricsResult[],
  preference: LyricsSourcePreference = 'embedded',
): LyricsResult {
  const valid = candidates.filter((c) => c && Array.isArray(c.lines) && c.lines.length > 0)
  if (valid.length === 0) {
    return { ...EMPTY_LYRICS }
  }

  // Ensure every candidate has explicit syncQuality and synchronized properties
  const normalized = valid.map((candidate, index) => {
    const syncQuality = candidate.syncQuality ?? determineSyncQuality(candidate.lines)
    const synchronized = syncQuality !== 'none'
    const format =
      candidate.format ??
      (candidate.source === 'embedded'
        ? synchronized
          ? 'embedded'
          : 'plain'
        : candidate.source === 'sidecar-lyricsfile'
          ? 'lyricsfile'
          : synchronized
            ? syncQuality === 'word'
              ? 'enhanced-lrc'
              : 'lrc'
            : 'plain')

    return {
      result: {
        ...candidate,
        format,
        syncQuality,
        synchronized,
      },
      index,
    }
  })

  if (preference === 'synchronized') {
    normalized.sort((a, b) => {
      const qualityDiff =
        getSyncQualityRank(b.result.syncQuality) - getSyncQualityRank(a.result.syncQuality)
      if (qualityDiff !== 0) return qualityDiff

      // Tie-breaker: Embedded -> Sidecar, then discovery order
      const aEmbedded = isEmbeddedSource(a.result.source) ? 1 : 0
      const bEmbedded = isEmbeddedSource(b.result.source) ? 1 : 0
      if (aEmbedded !== bEmbedded) return bEmbedded - aEmbedded

      return a.index - b.index
    })
    return normalized[0].result
  }

  if (preference === 'sidecar') {
    normalized.sort((a, b) => {
      const aSidecar = !isEmbeddedSource(a.result.source) ? 1 : 0
      const bSidecar = !isEmbeddedSource(b.result.source) ? 1 : 0
      if (aSidecar !== bSidecar) return bSidecar - aSidecar

      // Within the same source group (e.g. multiple sidecars), prefer higher actual sync quality
      const qualityDiff =
        getSyncQualityRank(b.result.syncQuality) - getSyncQualityRank(a.result.syncQuality)
      if (qualityDiff !== 0) return qualityDiff

      return a.index - b.index
    })
    return normalized[0].result
  }

  // Default: 'embedded' (Embedded -> Sidecar)
  normalized.sort((a, b) => {
    const aEmbedded = isEmbeddedSource(a.result.source) ? 1 : 0
    const bEmbedded = isEmbeddedSource(b.result.source) ? 1 : 0
    if (aEmbedded !== bEmbedded) return bEmbedded - aEmbedded

    const qualityDiff =
      getSyncQualityRank(b.result.syncQuality) - getSyncQualityRank(a.result.syncQuality)
    if (qualityDiff !== 0) return qualityDiff

    return a.index - b.index
  })

  return normalized[0].result
}

export async function getLyrics(
  filePath: string,
  preferenceOrOptions?: LyricsSourcePreference | { preference?: LyricsSourcePreference },
): Promise<LyricsResult> {
  const preference: LyricsSourcePreference =
    typeof preferenceOrOptions === 'string'
      ? preferenceOrOptions
      : preferenceOrOptions?.preference ?? 'embedded'

  const embedded = await getEmbeddedLyrics(filePath)
  if (preference === 'embedded' && embedded.lines.length > 0) {
    return embedded
  }

  const sidecars = getSidecarCandidates(filePath)
  const allCandidates: LyricsResult[] = [
    ...(embedded.lines.length > 0 ? [embedded] : []),
    ...sidecars,
  ]

  return resolveLyricsCandidates(allCandidates, preference)
}
