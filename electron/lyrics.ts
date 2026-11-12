import fs from 'node:fs'
import path from 'node:path'
import { parseFile } from 'music-metadata'
import type { LyricsResult, LyricLine } from './types'

const EMPTY_LYRICS: LyricsResult = { source: null, lines: [], synchronized: false }

function textLines(text: string): LyricLine[] {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => ({ text: line.trimEnd() })).filter((line) => line.text)
}

function parseLrc(text: string): LyricLine[] {
  const lines: LyricLine[] = []
  const timestamp = /\[(\d+):(\d{2})(?:[.:](\d{1,3}))?]/g

  for (const rawLine of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const lyric = rawLine.replace(timestamp, '').trim()
    timestamp.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = timestamp.exec(rawLine)) !== null) {
      const fraction = (match[3] ?? '').padEnd(3, '0')
      lines.push({
        text: lyric,
        timestamp: Number(match[1]) * 60 + Number(match[2]) + (fraction ? Number(fraction) / 1000 : 0),
      })
    }
  }

  return lines.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
}

export async function getLyrics(filePath: string): Promise<LyricsResult> {
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

    const metadata = await parseFile(filePath, { skipCovers: true })
    const tag = metadata.common.lyrics?.find((lyrics) => lyrics.syncText.length || lyrics.text)
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
