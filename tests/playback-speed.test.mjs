import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'

const {
  MIN_PLAYBACK_RATE,
  MAX_PLAYBACK_RATE,
  DEFAULT_PLAYBACK_RATE,
  DEFAULT_PRESERVE_PITCH,
  PLAYBACK_SPEED_PRESETS,
  normalizePlaybackRate,
  normalizePreservePitch,
  normalizePlaybackPreferences,
  matchPlaybackSpeedPreset,
  getPlaybackSpeedPreset,
  calculatePitchSemitones,
  formatPlaybackRate,
  formatPitchSemitones,
  interpolateMediaPosition,
} = await import('../dist-electron/playbackSpeed.js')

const { parseLyricsContent, getLyricsSyncState } = await import('../dist-electron/lyrics.js')
const { MpvController } = await import('../dist-electron/mpv.js')
const { getAppSettings, setAppSettings } = await import('../dist-electron/settings.js')

// ---------------------------------------------------------------------------
// 1–5 & 15. Presets, normalization, pitch semitones & zero drift
// ---------------------------------------------------------------------------

test('presets, normalization, and semitone pitch calculation cover Normal, Nightcore, Fast Nightcore, Daycore, Slowed, and Custom', () => {
  // 1. Normal (1.00x, preservePitch: true)
  const normal = getPlaybackSpeedPreset('Normal')
  assert.deepEqual(
    { playbackRate: normal.playbackRate, preservePitch: normal.preservePitch },
    { playbackRate: 1.0, preservePitch: true },
  )
  assert.equal(matchPlaybackSpeedPreset(normal), 'Normal')
  assert.equal(calculatePitchSemitones(normal.playbackRate, normal.preservePitch), 0)
  assert.equal(formatPlaybackRate(normal.playbackRate), '1.00×')

  // 2. Nightcore (1.16x, preservePitch: false) -> 12 * log2(1.16) ≈ +2.57 st
  const nightcore = getPlaybackSpeedPreset('Nightcore')
  assert.equal(nightcore.playbackRate, 1.16)
  assert.equal(nightcore.preservePitch, false)
  assert.equal(matchPlaybackSpeedPreset(nightcore), 'Nightcore')
  const ncPitch = calculatePitchSemitones(nightcore.playbackRate, nightcore.preservePitch)
  assert.equal(ncPitch, 2.57)
  assert.equal(formatPitchSemitones(ncPitch), '+2.57 st')

  // 3. Fast Nightcore (1.25x, preservePitch: false) -> 12 * log2(1.25) ≈ +3.86 st
  const fastNc = getPlaybackSpeedPreset('Fast Nightcore')
  assert.equal(fastNc.playbackRate, 1.25)
  assert.equal(fastNc.preservePitch, false)
  assert.equal(matchPlaybackSpeedPreset(fastNc), 'Fast Nightcore')
  assert.equal(calculatePitchSemitones(fastNc.playbackRate, fastNc.preservePitch), 3.86)

  // 4. Daycore (0.85x, preservePitch: false) -> 12 * log2(0.85) ≈ -2.81 st
  const daycore = getPlaybackSpeedPreset('Daycore')
  assert.equal(daycore.playbackRate, 0.85)
  assert.equal(daycore.preservePitch, false)
  assert.equal(matchPlaybackSpeedPreset(daycore), 'Daycore')
  const dcPitch = calculatePitchSemitones(daycore.playbackRate, daycore.preservePitch)
  assert.equal(dcPitch, -2.81)
  assert.equal(formatPitchSemitones(dcPitch), '−2.81 st')

  // Slowed (0.90x, preservePitch: false)
  const slowed = getPlaybackSpeedPreset('Slowed')
  assert.equal(slowed.playbackRate, 0.9)
  assert.equal(slowed.preservePitch, false)
  assert.equal(matchPlaybackSpeedPreset(slowed), 'Slowed')

  // 5. Custom speed with pitch preservation enabled -> 0 st pitch shift
  const customPreserved = normalizePlaybackPreferences({
    playbackRate: 1.16,
    preservePitch: true,
  })
  assert.equal(matchPlaybackSpeedPreset(customPreserved), 'Custom')
  assert.equal(
    calculatePitchSemitones(customPreserved.playbackRate, customPreserved.preservePitch),
    0,
  )

  // Bounds clamping & string parsing
  assert.equal(normalizePlaybackRate(0.1), MIN_PLAYBACK_RATE)
  assert.equal(normalizePlaybackRate(3.0), MAX_PLAYBACK_RATE)
  assert.equal(normalizePlaybackRate('1.164'), 1.16)
  assert.equal(normalizePlaybackRate('invalid', 1.25), 1.25)
  assert.equal(normalizePreservePitch('false'), false)
  assert.equal(normalizePreservePitch('true'), true)

  // 15. Switching presets repeatedly never accumulates floating-point drift
  let current = { playbackRate: DEFAULT_PLAYBACK_RATE, preservePitch: DEFAULT_PRESERVE_PITCH }
  for (let i = 0; i < 50; i++) {
    for (const preset of PLAYBACK_SPEED_PRESETS) {
      current = normalizePlaybackPreferences(preset, current)
      assert.equal(current.playbackRate, preset.playbackRate)
      assert.equal(current.preservePitch, preset.preservePitch)
      assert.equal(matchPlaybackSpeedPreset(current), preset.name)
    }
  }
})

// ---------------------------------------------------------------------------
// 6, 7, 9, 15. MPV IPC speed & audio-pitch-correction integration
// ---------------------------------------------------------------------------

test('MpvController applies speed and audio-pitch-correction while playing, paused, and loading tracks without redundant commands', async () => {
  const controller = new MpvController()
  const pipePath = controller.pipePath
  const receivedCommands = []

  const server = net.createServer((socket) => {
    let buf = ''
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8')
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        const parsed = JSON.parse(line)
        receivedCommands.push(parsed.command)
      }
    })
  })

  await new Promise((resolve) => server.listen(pipePath, resolve))

  try {
    // Set Nightcore while paused / before connection
    controller.setPlaybackSpeed({ playbackRate: 1.16, preservePitch: false })
    controller.process = { killed: false, kill: () => {} }
    await controller.init()
    await new Promise((r) => setTimeout(r, 30))

    assert.ok(
      receivedCommands.some(
        (cmd) =>
          cmd[0] === 'set_property' &&
          cmd[1] === 'audio-pitch-correction' &&
          cmd[2] === 'no',
      ),
    )
    assert.ok(
      receivedCommands.some(
        (cmd) => cmd[0] === 'set_property' && cmd[1] === 'speed' && cmd[2] === 1.16,
      ),
    )

    // Calling setPlaybackSpeed with the exact same values sends 0 redundant IPC commands
    const countBefore = receivedCommands.length
    controller.setPlaybackSpeed({ playbackRate: 1.16, preservePitch: false })
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(receivedCommands.length, countBefore)

    // Changing speed while playing updates immediately without restarting track
    await controller.play('/music/song-1.flac')
    await new Promise((r) => setTimeout(r, 20))
    receivedCommands.length = 0

    controller.setPlaybackSpeed({ playbackRate: 1.25, preservePitch: false })
    await new Promise((r) => setTimeout(r, 20))
    assert.deepEqual(receivedCommands, [['set_property', 'speed', 1.25]])

    // Loading another track re-applies speed and pitch preservation
    receivedCommands.length = 0
    await controller.play('/music/song-2.flac')
    await new Promise((r) => setTimeout(r, 20))
    assert.ok(
      receivedCommands.some(
        (cmd) => cmd[0] === 'set_property' && cmd[1] === 'speed' && cmd[2] === 1.25,
      ),
    )
    assert.ok(
      receivedCommands.some(
        (cmd) =>
          cmd[0] === 'set_property' &&
          cmd[1] === 'audio-pitch-correction' &&
          cmd[2] === 'no',
      ),
    )
  } finally {
    controller.destroy()
    await new Promise((resolve) => server.close(resolve))
  }
})

// ---------------------------------------------------------------------------
// 10. Settings persistence & restoration
// ---------------------------------------------------------------------------

test('playbackRate and preservePitch persist in settings and restore cleanly', () => {
  const original = getAppSettings()
  try {
    const saved = setAppSettings({
      playbackRate: 1.16,
      preservePitch: false,
    })
    assert.equal(saved.playbackRate, 1.16)
    assert.equal(saved.preservePitch, false)

    const reloaded = getAppSettings()
    assert.equal(reloaded.playbackRate, 1.16)
    assert.equal(reloaded.preservePitch, false)
  } finally {
    setAppSettings({
      playbackRate: original.playbackRate,
      preservePitch: original.preservePitch,
    })
  }
})

// ---------------------------------------------------------------------------
// 11, 12, 13, 14. Lyrics synchronization & media-time interpolation across speeds
// ---------------------------------------------------------------------------

test('lyrics synchronization and word-level interpolation scale wall-clock delta by playbackRate without double-scaling media positions', () => {
  const enhancedLrc = `
[00:10.00] <00:10.00> First <00:10.50> word <00:11.00> line <00:11.50>
[00:12.00] <00:12.00> Second <00:12.50> line <00:13.00>
  `.trim()

  const parsed = parseLyricsContent(enhancedLrc, 'sidecar-lrc')

  // 12. Media positions from MPV/browser are already in media-time: 10.6s is always word 1 ('word')
  const stateAtNormal = getLyricsSyncState(parsed, { backend: 'mpv', position: 10.6, isPlaying: true })
  const stateAtNightcore = getLyricsSyncState(parsed, { backend: 'browser', position: 10.6, isPlaying: true })
  assert.equal(stateAtNormal.activeIndex, 0)
  assert.equal(stateAtNormal.activeWordIndex, 1)
  assert.equal(stateAtNightcore.activeWordIndex, 1)

  // 13. Wall-clock interpolation scales elapsed delta by playbackRate:
  // Over 400ms of wall-clock time starting from 10.00s:
  // - At 0.85x (Daycore): 10.00 + 0.4 * 0.85 = 10.34s (still on word 0 'First')
  // - At 1.00x (Normal):  10.00 + 0.4 * 1.00 = 10.40s (still on word 0 'First')
  // - At 1.25x (Fast NC): 10.00 + 0.4 * 1.25 = 10.50s (reaches word 1 'word'!)
  const posDaycore = interpolateMediaPosition({
    anchorPosition: 10.0,
    anchorTimestampMs: 1000,
    nowMs: 1400,
    highWaterMark: 10.0,
    playbackRate: 0.85,
    duration: 180,
  })
  const posNormal = interpolateMediaPosition({
    anchorPosition: 10.0,
    anchorTimestampMs: 1000,
    nowMs: 1400,
    highWaterMark: 10.0,
    playbackRate: 1.0,
    duration: 180,
  })
  const posFastNc = interpolateMediaPosition({
    anchorPosition: 10.0,
    anchorTimestampMs: 1000,
    nowMs: 1400,
    highWaterMark: 10.0,
    playbackRate: 1.25,
    duration: 180,
  })

  assert.ok(Math.abs(posDaycore - 10.34) < 1e-6)
  assert.ok(Math.abs(posNormal - 10.4) < 1e-6)
  assert.ok(Math.abs(posFastNc - 10.5) < 1e-6)

  assert.equal(getLyricsSyncState(parsed, posDaycore).activeWordIndex, 0)
  assert.equal(getLyricsSyncState(parsed, posFastNc).activeWordIndex, 1)

  // 14. Changing speed mid-line (re-anchoring from highWaterMark = 10.50s at t=1400ms to 0.85x)
  // advancing another 200ms wall-clock -> 10.50 + 0.2 * 0.85 = 10.67s (no backward jump!)
  const posAfterMidLineRateChange = interpolateMediaPosition({
    anchorPosition: posFastNc,
    anchorTimestampMs: 1400,
    nowMs: 1600,
    highWaterMark: posFastNc,
    playbackRate: 0.85,
    duration: 180,
  })
  assert.ok(Math.abs(posAfterMidLineRateChange - 10.67) < 1e-6)
  assert.ok(posAfterMidLineRateChange > posFastNc)
})
