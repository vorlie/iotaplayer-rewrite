import test from 'node:test'
import assert from 'node:assert/strict'

const { parseLrc } = await import('../dist-electron/lyrics.js')

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
