import fs from 'node:fs'
import path from 'node:path'
import { parseFile } from 'music-metadata'
import type { LyricsResult, LyricLine } from './types'

const EMPTY_LYRICS: LyricsResult = { source: null, lines: [], synchronized: false }

function textLines(text: string): LyricLine[] {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => ({ text: line.trimEnd() })).filter((line) => line.text)
}

function parseLrc(text: string): LyricLine[] {
  const raw = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  const timestamp = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?]/g
  const wordTimestamp = /<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g
  const offsetMatch = /\[offset:\s*(-?\d+)\s*]/i.exec(raw)
  const offset = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0
  const stamps: Array<{ timestamp: number; start: number; end: number }> = []

  let match: RegExpExecArray | null
  while ((match = timestamp.exec(raw)) !== null) {
    const fraction = match[3] ? Number(`0.${match[3]}`) : 0
    stamps.push({ timestamp: Number(match[1]) * 60 + Number(match[2]) + fraction, start: match.index, end: timestamp.lastIndex })
  }

  if (!stamps.length) return []

  const lines: LyricLine[] = []
  const pending: number[] = []
  for (let index = 0; index < stamps.length; index++) {
    const stamp = stamps[index]
    pending.push(stamp.timestamp)
    const nextStart = index + 1 < stamps.length ? stamps[index + 1].start : raw.length

    // Consecutive timestamps share the lyric text that follows them.
    if (index + 1 < stamps.length && nextStart === stamp.end) continue

    const lyric = raw.slice(stamp.end, nextStart)
      .replace(wordTimestamp, '')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .trim()
      .replace(/\s*\/$/, '')
      .trim()

    for (const value of pending) {
      lines.push({ text: lyric, timestamp: Math.max(0, value - offset) })
    }
    pending.length = 0
  }

  return lines.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
}

async function getEmbeddedLyrics(filePath: string): Promise<LyricsResult> {
  try {
    const metadata = await parseFile(filePath, { skipCovers: true })
    const tag = metadata.common.lyrics
      ?.filter((lyrics) => lyrics.syncText.length || lyrics.text)
      .sort((left, right) => {
        const leftCount = left.syncText.filter((line) => line.text.trim()).length || textLines(left.text ?? '').length
        const rightCount = right.syncText.filter((line) => line.text.trim()).length || textLines(right.text ?? '').length
        return rightCount - leftCount
      })[0]
    if (!tag) return EMPTY_LYRICS

    const synced = tag.syncText
      .filter((line) => line.text.trim() && line.timestamp != null)
      .map((line) => ({ text: line.text.trim(), timestamp: line.timestamp! / 1000 }))
    if (synced.length) return { source: 'embedded', lines: synced, synchronized: true }

    const lines = tag.text ? textLines(tag.text) : []
    return lines.length ? { source: 'embedded', lines, synchronized: false } : EMPTY_LYRICS
  } catch {
    return EMPTY_LYRICS
  }
}

export async function getLyrics(filePath: string): Promise<LyricsResult> {
  const embedded = await getEmbeddedLyrics(filePath)
  if (embedded.lines.length) return embedded

  const basePath = path.join(path.dirname(filePath), path.basename(filePath, path.extname(filePath)))

  try {
    const lrcPath = `${basePath}.lrc`
    if (fs.existsSync(lrcPath)) {
      const lines = parseLrc(fs.readFileSync(lrcPath, 'utf8'))
      if (lines.length) return { source: 'sidecar-lrc', lines, synchronized: lines.some((line) => line.timestamp != null) }
    }

    const textPath = `${basePath}.txt`
    if (fs.existsSync(textPath)) {
      const lines = textLines(fs.readFileSync(textPath, 'utf8'))
      if (lines.length) return { source: 'sidecar-text', lines, synchronized: false }
    }
  } catch {
    // An unreadable sidecar should not prevent the player from continuing.
  }

  return EMPTY_LYRICS
}
