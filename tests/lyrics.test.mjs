import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const {
  parseLrc,
  parseLyricsfile,
  detectLyricsFormat,
  determineSyncQuality,
  parseLyricsContent,
  resolveLyricsCandidates,
  getLyrics,
  formatLyricsSourceLabel,
  getActiveLyricIndex,
  getActiveWordIndex,
  getLineWordSyncStates,
  getLyricsSyncState,
} = await import('../dist-electron/lyrics.js')

// ---------------------------------------------------------------------------
// Helper to create a minimal valid MP3 file with optional ID3v2 USLT / SYLT frames
// ---------------------------------------------------------------------------

function makeId3Frame(frameId, payload) {
  const header = Buffer.alloc(10)
  header.write(frameId, 0, 'ascii')
  header.writeUInt32BE(payload.length, 4)
  return Buffer.concat([header, payload])
}

function makeUsltFrame(lyricText) {
  const payload = Buffer.concat([
    Buffer.from([0x00]), // ISO-8859-1
    Buffer.from('eng', 'ascii'),
    Buffer.from([0x00]), // empty descriptor
    Buffer.from(lyricText, 'latin1'),
  ])
  return makeId3Frame('USLT', payload)
}

function makeSyltFrame(entries) {
  // encoding(0x00) + lang('eng') + timestampFormat(0x02 = ms) + contentType(0x01 = lyrics) + descriptor(0x00)
  const header = Buffer.from([0x00, 0x65, 0x6e, 0x67, 0x02, 0x01, 0x00])
  const parts = [header]
  for (const [text, ms] of entries) {
    const textBuf = Buffer.from(text, 'latin1')
    const nulAndTime = Buffer.alloc(5)
    nulAndTime[0] = 0x00
    nulAndTime.writeUInt32BE(ms, 1)
    parts.push(textBuf, nulAndTime)
  }
  return makeId3Frame('SYLT', Buffer.concat(parts))
}

function writeTestMp3(filePath, { uslt, sylt } = {}) {
  const frames = []
  if (uslt) frames.push(makeUsltFrame(uslt))
  if (sylt) frames.push(makeSyltFrame(sylt))

  const framesBuf = Buffer.concat(frames)
  const tagSize = framesBuf.length
  const s0 = (tagSize >> 21) & 0x7f
  const s1 = (tagSize >> 14) & 0x7f
  const s2 = (tagSize >> 7) & 0x7f
  const s3 = tagSize & 0x7f
  const id3Header = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, s0, s1, s2, s3])

  const mp3Frame = Buffer.alloc(417, 0)
  mp3Frame[0] = 0xff
  mp3Frame[1] = 0xfb
  mp3Frame[2] = 0x90
  mp3Frame[3] = 0x00

  const data = frames.length ? Buffer.concat([id3Header, framesBuf, mp3Frame]) : mp3Frame
  fs.writeFileSync(filePath, data)
}

// ---------------------------------------------------------------------------
// Existing LRC gap regression tests
// ---------------------------------------------------------------------------

test('parseLrc preserves explicit empty timestamped entries as gaps', () => {
  const lrc = `
[00:52.53] Nie martw się o mnie, przestanę za moment
[00:54.47]
[01:08.80] Ja pierdolę...
  `.trim()

  const lines = parseLrc(lrc)
  assert.equal(lines.length, 3)

  assert.equal(lines[0].text, 'Nie martw się o mnie, przestanę za moment')
  assert.equal(lines[0].timestamp, 52.53)
  assert.equal(Boolean(lines[0].isGap), false)

  assert.equal(lines[1].text, '')
  assert.equal(lines[1].timestamp, 54.47)
  assert.equal(lines[1].isGap, true)

  assert.equal(lines[2].text, 'Ja pierdolę...')
  assert.equal(lines[2].timestamp, 68.8)
  assert.equal(Boolean(lines[2].isGap), false)
})

test('parseLrc collapses multiple consecutive empty entries without rendering duplicates', () => {
  const lrc = `
[00:10.00] Intro line
[00:14.00]
[00:18.00]
[00:22.00]
[00:30.00] Verse 1
  `.trim()

  const lines = parseLrc(lrc)
  assert.equal(lines.length, 3)

  assert.equal(lines[0].text, 'Intro line')
  assert.equal(lines[0].timestamp, 10)

  // Only the first gap timestamp is retained
  assert.equal(lines[1].text, '')
  assert.equal(lines[1].timestamp, 14)
  assert.equal(lines[1].isGap, true)

  assert.equal(lines[2].text, 'Verse 1')
  assert.equal(lines[2].timestamp, 30)
})

test('parseLrc handles intro gaps and outro gaps', () => {
  const lrc = `
[00:00.00]
[00:05.00] First lyric
[00:10.00]
  `.trim()

  const lines = parseLrc(lrc)
  assert.equal(lines.length, 3)

  assert.equal(lines[0].isGap, true)
  assert.equal(lines[0].timestamp, 0)

  assert.equal(lines[1].text, 'First lyric')
  assert.equal(lines[1].timestamp, 5)

  assert.equal(lines[2].isGap, true)
  assert.equal(lines[2].timestamp, 10)
})

// ---------------------------------------------------------------------------
// Standard & Enhanced LRC parsing tests
// ---------------------------------------------------------------------------

test('parseLrc applies offset and strips metadata tags without losing line timings', () => {
  const lrc = `
[ti:Test Song]
[ar:Test Artist]
[offset:500]
[00:10.00]Line one
[00:20.50][00:30.50]Repeated chorus
  `.trim()

  const lines = parseLrc(lrc)
  assert.equal(lines.length, 3)
  assert.equal(lines[0].text, 'Line one')
  assert.equal(lines[0].timestamp, 9.5)
  assert.equal(lines[1].text, 'Repeated chorus')
  assert.equal(lines[1].timestamp, 20)
  assert.equal(lines[2].text, 'Repeated chorus')
  assert.equal(lines[2].timestamp, 30)
  assert.equal(determineSyncQuality(lines), 'line')
})

test('parseLrc parses Enhanced LRC word timestamps and preserves end timestamps', () => {
  const elrc = `
[00:12.50]<00:12.50>Never <00:12.80><00:12.90>gonna <00:13.20>give <00:13.50>you <00:13.80>up<00:14.20>
[00:15.00]Never <00:15.40>gonna <00:15.80>let <00:16.10>you <00:16.40>down<00:17.00>
  `.trim()

  const lines = parseLrc(elrc)
  assert.equal(lines.length, 2)
  assert.equal(determineSyncQuality(lines), 'word')
  assert.equal(detectLyricsFormat(elrc), 'enhanced-lrc')

  assert.equal(lines[0].text, 'Never gonna give you up')
  assert.equal(lines[0].timestamp, 12.5)
  assert.equal(lines[0].endTimestamp, 14.2)
  assert.equal(lines[0].words.length, 5)
  assert.deepEqual(lines[0].words[0], { text: 'Never', timestamp: 12.5, endTimestamp: 12.8 })
  assert.deepEqual(lines[0].words[1], { text: 'gonna', timestamp: 12.9, endTimestamp: 13.2 })
  assert.deepEqual(lines[0].words[4], { text: 'up', timestamp: 13.8, endTimestamp: 14.2 })

  assert.equal(lines[1].text, 'Never gonna let you down')
  assert.equal(lines[1].timestamp, 15)
  assert.equal(lines[1].endTimestamp, 17)
  assert.equal(lines[1].words.length, 5)
  assert.deepEqual(lines[1].words[0], { text: 'Never', timestamp: 15, endTimestamp: 15.4 })
  assert.deepEqual(lines[1].words[4], { text: 'down', timestamp: 16.4, endTimestamp: 17 })
})

// ---------------------------------------------------------------------------
// Lyricsfile YAML parsing & interoperability tests
// ---------------------------------------------------------------------------

test('parseLyricsfile parses word-synchronized Lyricsfile YAML and preserves end timestamps', () => {
  const yaml = `
version: "1.0"
metadata:
  title: "Example Song"
  artist: "Example Artist"
  duration_ms: 210000
  language: "en"

lines:
  - text: "Never gonna give you up"
    start_ms: 12500
    end_ms: 14200
    words:
      - text: "Never"
        start_ms: 12500
        end_ms: 12800
      - text: "gonna"
        start_ms: 12900
        end_ms: 13200
      - text: "give"
        start_ms: 13200
        end_ms: 13500
      - text: "you"
        start_ms: 13500
        end_ms: 13800
      - text: "up"
        start_ms: 13800
        end_ms: 14200
  - text: ""
    start_ms: 14200
  - text: "Never gonna let you down"
    start_ms: 15000
    end_ms: 17000
  `.trim()

  assert.equal(detectLyricsFormat(yaml), 'lyricsfile')
  const lines = parseLyricsfile(yaml)
  assert.equal(lines.length, 3)
  assert.equal(determineSyncQuality(lines), 'word')

  assert.equal(lines[0].text, 'Never gonna give you up')
  assert.equal(lines[0].timestamp, 12.5)
  assert.equal(lines[0].endTimestamp, 14.2)
  assert.equal(lines[0].isGap, false)
  assert.equal(lines[0].words.length, 5)
  assert.deepEqual(lines[0].words[0], { text: 'Never', timestamp: 12.5, endTimestamp: 12.8 })
  assert.deepEqual(lines[0].words[4], { text: 'up', timestamp: 13.8, endTimestamp: 14.2 })

  assert.equal(lines[1].text, '')
  assert.equal(lines[1].timestamp, 14.2)
  assert.equal(lines[1].isGap, true)

  assert.equal(lines[2].text, 'Never gonna let you down')
  assert.equal(lines[2].timestamp, 15)
  assert.equal(lines[2].endTimestamp, 17)
})

test('parseLyricsfile supports line-synchronized and plain fallback Lyricsfile YAML', () => {
  const lineYaml = `
version: "1.0"
metadata:
  title: "Line Synced"
  artist: "Artist"
lines:
  - text: "First line"
    start_ms: 2000
    end_ms: 4500
  - text: "Second line"
    start_ms: 5000
  `.trim()

  const lineResult = parseLyricsContent(lineYaml, 'sidecar-lyricsfile')
  assert.equal(lineResult.format, 'lyricsfile')
  assert.equal(lineResult.syncQuality, 'line')
  assert.equal(lineResult.synchronized, true)
  assert.equal(lineResult.lines.length, 2)
  assert.equal(lineResult.lines[0].timestamp, 2)
  assert.equal(lineResult.lines[0].endTimestamp, 4.5)
  assert.equal(lineResult.lines[0].words, undefined)

  const plainYaml = `
version: "1.0"
metadata:
  title: "Plain Only"
  artist: "Artist"
plain: |
  Unsynchronized line one
  Unsynchronized line two
  `.trim()

  const plainResult = parseLyricsContent(plainYaml, 'sidecar-lyricsfile')
  assert.equal(plainResult.format, 'lyricsfile')
  assert.equal(plainResult.syncQuality, 'none')
  assert.equal(plainResult.synchronized, false)
  assert.equal(plainResult.lines.length, 2)
  assert.equal(plainResult.lines[0].text, 'Unsynchronized line one')
  assert.equal(plainResult.lines[0].timestamp, undefined)
})

test('Enhanced LRC and Lyricsfile YAML normalize to interoperable line and word representations', () => {
  const elrc = '[00:05.00]<00:05.00>Hello <00:05.50>world<00:06.00>'
  const yaml = `
version: "1.0"
metadata:
  title: "Interop"
  artist: "Artist"
lines:
  - text: "Hello world"
    start_ms: 5000
    end_ms: 6000
    words:
      - text: "Hello"
        start_ms: 5000
        end_ms: 5500
      - text: "world"
        start_ms: 5500
        end_ms: 6000
  `.trim()

  const fromElrc = parseLrc(elrc)
  const fromYaml = parseLyricsfile(yaml)
  assert.deepEqual(fromElrc, fromYaml)
})

// ---------------------------------------------------------------------------
// Source preference resolution & tie-breaking tests
// ---------------------------------------------------------------------------

test('resolveLyricsCandidates respects embedded, synchronized, and sidecar preferences', () => {
  const embeddedPlain = parseLyricsContent('Plain embedded line 1\nPlain embedded line 2', 'embedded')
  const sidecarLine = parseLyricsContent('[00:01.00] Line synced sidecar\n[00:03.00] Second line', 'sidecar-lrc')
  const sidecarWord = parseLyricsContent(
    '[00:01.00]<00:01.00>Word <00:01.50>synced<00:02.00>',
    'sidecar-lrc',
  )

  // Embedded preference: prefers embedded even when sidecar has higher sync quality
  const embeddedWinner = resolveLyricsCandidates(
    [embeddedPlain, sidecarLine, sidecarWord],
    'embedded',
  )
  assert.equal(embeddedWinner.source, 'embedded')
  assert.equal(embeddedWinner.syncQuality, 'none')

  // Synchronized preference: Word-synchronized -> Line-synchronized -> Plain
  const syncWordWinner = resolveLyricsCandidates(
    [embeddedPlain, sidecarLine, sidecarWord],
    'synchronized',
  )
  assert.equal(syncWordWinner.source, 'sidecar-lrc')
  assert.equal(syncWordWinner.syncQuality, 'word')

  const syncLineWinner = resolveLyricsCandidates([embeddedPlain, sidecarLine], 'synchronized')
  assert.equal(syncLineWinner.source, 'sidecar-lrc')
  assert.equal(syncLineWinner.syncQuality, 'line')

  // Sidecar preference: prefers sidecar over embedded
  const sidecarPlain = parseLyricsContent('Plain sidecar text', 'sidecar-text')
  const embeddedLine = parseLyricsContent('[00:02.00] Embedded synced line', 'embedded')
  const sidecarWinner = resolveLyricsCandidates([embeddedLine, sidecarPlain], 'sidecar')
  assert.equal(sidecarWinner.source, 'sidecar-text')
  assert.equal(sidecarWinner.syncQuality, 'none')
})

test('resolveLyricsCandidates uses source priority as tie-breaker in synchronized mode', () => {
  const embeddedLine = parseLyricsContent('[00:01.00] Embedded line', 'embedded')
  const sidecarLine = parseLyricsContent('[00:01.00] Sidecar line', 'sidecar-lrc')

  const winner = resolveLyricsCandidates([sidecarLine, embeddedLine], 'synchronized')
  assert.equal(winner.source, 'embedded')
  assert.equal(winner.syncQuality, 'line')
  assert.equal(winner.lines[0].text, 'Embedded line')
})

// ---------------------------------------------------------------------------
// Real filesystem tests: fallback, content evaluation, and re-detection
// ---------------------------------------------------------------------------

test('getLyrics evaluates actual file contents and handles embedded/sidecar fallback and re-detection', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iotaplayer-lyrics-test-'))

  try {
    const trackPath = path.join(tempDir, 'song.mp3')
    const lrcPath = path.join(tempDir, 'song.lrc')
    const txtPath = path.join(tempDir, 'song.txt')
    const yfPath = path.join(tempDir, 'song.lyricsfile.yaml')

    // 1. Track with plain embedded USLT lyrics only
    writeTestMp3(trackPath, { uslt: 'Embedded plain line 1\nEmbedded plain line 2' })

    const embeddedOnly = await getLyrics(trackPath, 'embedded')
    assert.equal(embeddedOnly.source, 'embedded')
    assert.equal(embeddedOnly.format, 'plain')
    assert.equal(embeddedOnly.syncQuality, 'none')
    assert.equal(embeddedOnly.synchronized, false)
    assert.equal(formatLyricsSourceLabel(embeddedOnly), 'Embedded · Plain')

    // 2. Sidecar preference falls back to embedded when no sidecars exist
    const sidecarFallbackToEmbedded = await getLyrics(trackPath, 'sidecar')
    assert.equal(sidecarFallbackToEmbedded.source, 'embedded')

    // 3. Add a line-synchronized .lrc sidecar and re-detect ("Check Again" behavior)
    fs.writeFileSync(lrcPath, '[00:05.00] Sidecar LRC line 1\n[00:10.00] Sidecar LRC line 2', 'utf8')

    // Default ('embedded') still prefers embedded
    const stillEmbedded = await getLyrics(trackPath, 'embedded')
    assert.equal(stillEmbedded.source, 'embedded')

    // 'sidecar' and 'synchronized' pick up the newly added .lrc sidecar
    const bySidecar = await getLyrics(trackPath, 'sidecar')
    assert.equal(bySidecar.source, 'sidecar-lrc')
    assert.equal(bySidecar.format, 'lrc')
    assert.equal(bySidecar.syncQuality, 'line')
    assert.equal(formatLyricsSourceLabel(bySidecar), 'Sidecar · LRC')

    const bySync = await getLyrics(trackPath, 'synchronized')
    assert.equal(bySync.source, 'sidecar-lrc')
    assert.equal(bySync.syncQuality, 'line')

    // 4. Add a word-synchronized .lyricsfile.yaml sidecar and re-detect
    fs.writeFileSync(
      yfPath,
      `
version: "1.0"
metadata:
  title: "Song"
  artist: "Artist"
lines:
  - text: "Karaoke word line"
    start_ms: 1000
    end_ms: 3000
    words:
      - text: "Karaoke"
        start_ms: 1000
        end_ms: 1600
      - text: "word"
        start_ms: 1600
        end_ms: 2200
      - text: "line"
        start_ms: 2200
        end_ms: 3000
      `.trim(),
      'utf8',
    )

    const bySyncWord = await getLyrics(trackPath, 'synchronized')
    assert.equal(bySyncWord.source, 'sidecar-lyricsfile')
    assert.equal(bySyncWord.format, 'lyricsfile')
    assert.equal(bySyncWord.syncQuality, 'word')
    assert.equal(formatLyricsSourceLabel(bySyncWord), 'Sidecar · Lyricsfile')

    // 5. Evaluate actual contents: if .lyricsfile.yaml is modified to plain-only,
    // synchronized mode prefers the line-synced .lrc over the plain .lyricsfile.yaml!
    fs.writeFileSync(
      yfPath,
      `
version: "1.0"
metadata:
  title: "Song"
  artist: "Artist"
plain: |
  Only plain text in lyricsfile now
      `.trim(),
      'utf8',
    )

    const reevaluated = await getLyrics(trackPath, 'synchronized')
    assert.equal(reevaluated.source, 'sidecar-lrc')
    assert.equal(reevaluated.syncQuality, 'line')

    // 6. Remove embedded lyrics (write MP3 without tags) and test embedded -> sidecar fallback
    fs.unlinkSync(yfPath)
    writeTestMp3(trackPath, {})
    const fallbackToSidecar = await getLyrics(trackPath, 'embedded')
    assert.equal(fallbackToSidecar.source, 'sidecar-lrc')
    assert.equal(fallbackToSidecar.syncQuality, 'line')

    // 7. Plain .txt fallback when .lrc is removed
    fs.unlinkSync(lrcPath)
    fs.writeFileSync(txtPath, 'Plain txt line 1\nPlain txt line 2', 'utf8')
    const txtFallback = await getLyrics(trackPath, 'embedded')
    assert.equal(txtFallback.source, 'sidecar-text')
    assert.equal(txtFallback.format, 'plain')
    assert.equal(txtFallback.syncQuality, 'none')
    assert.equal(txtFallback.synchronized, false)
    assert.equal(formatLyricsSourceLabel(txtFallback), 'Sidecar · Plain')

    // 8. Embedded SYLT synchronized lyrics display as 'Embedded'
    writeTestMp3(trackPath, {
      sylt: [
        ['Embedded SYLT 1', 2000],
        ['Embedded SYLT 2', 6000],
      ],
    })
    const syltResult = await getLyrics(trackPath, 'embedded')
    assert.equal(syltResult.source, 'embedded')
    assert.equal(syltResult.synchronized, true)
    assert.equal(syltResult.syncQuality, 'line')
    assert.equal(formatLyricsSourceLabel(syltResult), 'Embedded')
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// Playback synchronization across MPV and Browser backends
// ---------------------------------------------------------------------------

test('playback synchronization resolves identically across MPV and browser backends', () => {
  const syncedLyrics = parseLyricsContent(
    `
[00:05.00] First verse
[00:12.00]
[00:18.50] Second verse
[00:25.00] Chorus line
    `.trim(),
    'sidecar-lrc',
  )

  // Before first timestamp
  const mpvBefore = getLyricsSyncState(syncedLyrics, { backend: 'mpv', position: 2.0, isPlaying: true })
  const browserBefore = getLyricsSyncState(syncedLyrics, { backend: 'browser', position: 2.0, isPlaying: true })
  assert.equal(mpvBefore.activeIndex, -1)
  assert.equal(browserBefore.activeIndex, -1)
  assert.equal(mpvBefore.backend, 'mpv')
  assert.equal(browserBefore.backend, 'browser')

  // During first verse
  const mpvVerse1 = getLyricsSyncState(syncedLyrics, { backend: 'mpv', position: 8.4, isPlaying: true })
  const browserVerse1 = getLyricsSyncState(syncedLyrics, { backend: 'browser', position: 8.4, isPlaying: true })
  assert.equal(mpvVerse1.activeIndex, 0)
  assert.equal(browserVerse1.activeIndex, 0)
  assert.equal(mpvVerse1.activeLine?.text, 'First verse')
  assert.equal(browserVerse1.activeLine?.text, 'First verse')

  // During instrumental gap
  const mpvGap = getLyricsSyncState(syncedLyrics, { backend: 'mpv', position: 14.0, isPlaying: true })
  const browserGap = getLyricsSyncState(syncedLyrics, { backend: 'browser', position: 14.0, isPlaying: true })
  assert.equal(mpvGap.activeIndex, 1)
  assert.equal(browserGap.activeIndex, 1)
  assert.equal(mpvGap.activeLine?.isGap, true)
  assert.equal(browserGap.activeLine?.isGap, true)

  // During chorus
  const mpvChorus = getLyricsSyncState(syncedLyrics, { backend: 'mpv', position: 25.0, isPlaying: true })
  const browserChorus = getLyricsSyncState(syncedLyrics, { backend: 'browser', position: 25.0, isPlaying: true })
  assert.equal(mpvChorus.activeIndex, 3)
  assert.equal(browserChorus.activeIndex, 3)
  assert.equal(mpvChorus.activeLine?.text, 'Chorus line')
  assert.equal(browserChorus.activeLine?.text, 'Chorus line')

  // Plain lyrics never report an active synchronized line on either backend
  const plainLyrics = parseLyricsContent('Line 1\nLine 2', 'sidecar-text')
  assert.equal(getActiveLyricIndex(plainLyrics, 10), -1)
  assert.equal(getLyricsSyncState(plainLyrics, { backend: 'mpv', position: 10 }).activeIndex, -1)
  assert.equal(getLyricsSyncState(plainLyrics, { backend: 'browser', position: 10 }).activeIndex, -1)
})

// ---------------------------------------------------------------------------
// Lyricsfile 1.0 Specification Compliance Tests
// ---------------------------------------------------------------------------

test('Lyricsfile 1.0 spec: preserves word whitespace so joining word.text reconstructs line.text', () => {
  const wordSyncedSpecExample = `
version: '1.0'

metadata:
  title: 'Small Hours'
  artist: 'Example Artist'
  language: 'en'

lines:
  - text: 'Stay until the morning'
    start_ms: 4200
    end_ms: 6800
    words:
      - text: 'Stay '
        start_ms: 4200
        end_ms: 4800
      - text: 'until '
        start_ms: 4800
        end_ms: 5400
      - text: 'the '
        start_ms: 5400
        end_ms: 5750
      - text: 'morning'
        start_ms: 5750
        end_ms: 6800

plain: |
  Stay until the morning
  `.trim()

  const result = parseLyricsContent(wordSyncedSpecExample, 'sidecar-lyricsfile')
  assert.equal(result.format, 'lyricsfile')
  assert.equal(result.syncQuality, 'word')
  assert.equal(result.lines.length, 1)
  const line = result.lines[0]
  assert.equal(line.text, 'Stay until the morning')
  assert.equal(line.words.map((w) => w.text).join(''), line.text)
  assert.equal(line.words[0].text, 'Stay ')
  assert.equal(line.words[3].text, 'morning')
})

test('Lyricsfile 1.0 spec: handles instrumental.lyricsfile.yaml without falling back to raw YAML lines', () => {
  const instrumentalExample = `
version: '1.0'

metadata:
  title: 'Quiet Transit'
  artist: 'Example Ensemble'
  duration_ms: 240000
  instrumental: true
  `.trim()

  assert.equal(detectLyricsFormat(instrumentalExample), 'lyricsfile')
  const parsed = parseLyricsfile(instrumentalExample)
  assert.equal(parsed.length, 0)
  assert.equal(parsed.instrumental, true)

  const content = parseLyricsContent(instrumentalExample, 'sidecar-lyricsfile')
  assert.equal(content.format, 'lyricsfile')
  assert.equal(content.instrumental, true)
  assert.equal(content.lines.length, 0)
  assert.equal(content.synchronized, false)
})

test('Lyricsfile 1.0 spec: rejects unknown versions, duplicate keys, negative timestamps, and invalid end_ms', () => {
  // Unknown version '2.0' must be rejected and not fall back to plain YAML text
  const unknownVersion = `
version: '2.0'
metadata:
  title: 'Future Song'
  artist: 'Future Artist'
plain: |
  Hello from 2.0
  `.trim()
  assert.equal(detectLyricsFormat(unknownVersion), null)
  assert.equal(parseLyricsfile(unknownVersion).length, 0)
  assert.equal(parseLyricsContent(unknownVersion, 'sidecar-lyricsfile').lines.length, 0)

  // Unquoted numeric version 1.0 (not string '1.0') must be rejected
  const numericVersion = `
version: 1.0
metadata:
  title: 'Numeric Version'
  artist: 'Artist'
plain: |
  Hello
  `.trim()
  assert.equal(detectLyricsFormat(numericVersion), null)
  assert.equal(parseLyricsfile(numericVersion).length, 0)

  // Duplicate keys in mapping must be rejected
  const duplicateKeyYaml = `
version: '1.0'
metadata:
  title: 'First Title'
  title: 'Duplicate Title'
  artist: 'Artist'
plain: |
  Some lyrics
  `.trim()
  assert.equal(detectLyricsFormat(duplicateKeyYaml), null)
  assert.equal(parseLyricsfile(duplicateKeyYaml).length, 0)
  assert.equal(parseLyricsContent(duplicateKeyYaml, 'sidecar-lyricsfile').lines.length, 0)

  // Negative start_ms or end_ms < start_ms must be rejected
  const negativeStartYaml = `
version: '1.0'
metadata:
  title: 'Negative Start'
  artist: 'Artist'
lines:
  - text: 'Invalid line'
    start_ms: -500
  `.trim()
  assert.equal(parseLyricsfile(negativeStartYaml).length, 0)

  const invalidEndYaml = `
version: '1.0'
metadata:
  title: 'Invalid End'
  artist: 'Artist'
lines:
  - text: 'Ends before start'
    start_ms: 5000
    end_ms: 3000
  `.trim()
  assert.equal(parseLyricsfile(invalidEndYaml).length, 0)

  // Instrumental with non-empty lines must be rejected per Section 3
  const invalidInstrumental = `
version: '1.0'
metadata:
  title: 'Invalid Instrumental'
  artist: 'Artist'
  instrumental: true
lines:
  - text: 'Should not have lines'
    start_ms: 1000
  `.trim()
  assert.equal(parseLyricsfile(invalidInstrumental).length, 0)
})

// ---------------------------------------------------------------------------
// Word-Level Synchronization & Karaoke Progress Tests
// ---------------------------------------------------------------------------

test('word-level synchronization: computes upcoming, active (with fractional progress), and past word states', () => {
  const wordSyncedYaml = `
version: '1.0'
metadata:
  title: 'GIRLS'
  artist: 'FIRESTARTER'
lines:
  - text: 'Stay until the morning'
    start_ms: 4000
    end_ms: 7000
    words:
      - text: 'Stay '
        start_ms: 4000
        end_ms: 4800
      - text: 'until '
        start_ms: 4800
        end_ms: 5600
      - text: 'the '
        start_ms: 5600
        end_ms: 6000
      - text: 'morning'
        start_ms: 6000
        end_ms: 7000
  - text: 'Next line starts here'
    start_ms: 8000
    end_ms: 10000
  `.trim()

  const parsed = parseLyricsContent(wordSyncedYaml, 'sidecar-lyricsfile')
  assert.equal(parsed.syncQuality, 'word')
  const line0 = parsed.lines[0]

  // Before first word starts (e.g. 3.8s)
  const beforeStates = getLineWordSyncStates(line0, 3.8, 8.0)
  assert.equal(beforeStates.length, 4)
  assert.ok(beforeStates.every((w) => w.status === 'upcoming' && w.progress === 0))
  assert.equal(getActiveWordIndex(line0, 3.8, 8.0), -1)

  // Halfway through word 0 ('Stay ', 4.0s -> 4.8s, at 4.4s => progress = 0.5)
  const midWord0 = getLyricsSyncState(parsed, { backend: 'mpv', position: 4.4, isPlaying: true })
  assert.equal(midWord0.activeIndex, 0)
  assert.equal(midWord0.activeWordIndex, 0)
  assert.equal(midWord0.activeWord?.text, 'Stay ')
  assert.ok(Math.abs(midWord0.wordProgress - 0.5) < 1e-6)
  assert.equal(midWord0.words[0].status, 'active')
  assert.equal(midWord0.words[1].status, 'upcoming')
  assert.equal(midWord0.words[2].status, 'upcoming')
  assert.equal(midWord0.words[3].status, 'upcoming')

  // Quarter-way through word 2 ('the ', 5.6s -> 6.0s, at 5.7s => progress = 0.25)
  const midWord2 = getLyricsSyncState(parsed, { backend: 'browser', position: 5.7, isPlaying: true })
  assert.equal(midWord2.activeIndex, 0)
  assert.equal(midWord2.activeWordIndex, 2)
  assert.equal(midWord2.activeWord?.text, 'the ')
  assert.ok(Math.abs(midWord2.wordProgress - 0.25) < 1e-6)
  assert.equal(midWord2.words[0].status, 'past')
  assert.equal(midWord2.words[0].progress, 1)
  assert.equal(midWord2.words[1].status, 'past')
  assert.equal(midWord2.words[1].progress, 1)
  assert.equal(midWord2.words[2].status, 'active')
  assert.equal(midWord2.words[3].status, 'upcoming')
  assert.equal(midWord2.words[3].progress, 0)

  // After last word of line 0 finishes (at 7.5s, before line 1 at 8.0s)
  const afterWords = getLyricsSyncState(parsed, { backend: 'mpv', position: 7.5, isPlaying: true })
  assert.equal(afterWords.activeIndex, 0)
  assert.equal(afterWords.activeWordIndex, -1)
  assert.ok(afterWords.words.every((w) => w.status === 'past' && w.progress === 1))

  // On line 1 (which has no word-level timestamps -> falls back to line-level sync)
  const onLine1 = getLyricsSyncState(parsed, { backend: 'mpv', position: 8.5, isPlaying: true })
  assert.equal(onLine1.activeIndex, 1)
  assert.equal(onLine1.activeWordIndex, -1)
  assert.equal(onLine1.activeWord, null)
  assert.equal(onLine1.words.length, 0)
})

test('word-level synchronization: works with Enhanced LRC inline word timestamps without explicit endTimestamp', () => {
  const enhancedLrc = `
[00:10.00] <00:10.00> Never <00:10.50> gonna <00:11.00> give <00:11.50> you <00:12.00> up
[00:14.00] Next line
  `.trim()

  const parsed = parseLyricsContent(enhancedLrc, 'sidecar-lrc')
  assert.equal(parsed.syncQuality, 'word')

  // At 10.75s: word 0 ('Never') is past, word 1 ('gonna', 10.50..11.00) is active at 50% progress
  const state = getLyricsSyncState(parsed, { backend: 'mpv', position: 10.75, isPlaying: true })
  assert.equal(state.activeIndex, 0)
  assert.equal(state.activeWordIndex, 1)
  assert.equal(state.activeWord?.text, 'gonna')
  assert.ok(Math.abs(state.wordProgress - 0.5) < 1e-6)
  assert.equal(state.words[0].status, 'past')
  assert.equal(state.words[1].status, 'active')
  assert.equal(state.words[2].status, 'upcoming')
})

test('resolveLyricsCandidates ignores embedded lyrics in synchronized mode when ignoreEmbedded is true', () => {
  const candidates = [
    {
      source: 'embedded',
      format: 'embedded',
      syncQuality: 'line',
      synchronized: true,
      lines: [{ timestamp: 1, text: 'Embedded line' }],
    },
    {
      source: 'sidecar-lrc',
      format: 'lrc',
      syncQuality: 'line',
      synchronized: true,
      lines: [{ timestamp: 1, text: 'Sidecar line' }],
    },
  ]

  const defaultResult = resolveLyricsCandidates(candidates, 'synchronized')
  assert.equal(defaultResult.source, 'embedded')

  const ignoredResult = resolveLyricsCandidates(candidates, 'synchronized', { ignoreEmbedded: true })
  assert.equal(ignoredResult.source, 'sidecar-lrc')
  assert.equal(ignoredResult.lines[0].text, 'Sidecar line')
})

