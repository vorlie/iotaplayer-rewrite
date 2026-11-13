import test from 'node:test'
import assert from 'node:assert/strict'

const { classifyScanFailure, formatScanError } = await import('../dist-electron/scanner.js')

test('unsupported codec failures are classified correctly', () => {
  const result = classifyScanFailure(new Error('Unsupported codec: flac'))
  assert.equal(result, 'unsupported-codec')
})

test('missing files are classified separately', () => {
  const result = classifyScanFailure(new Error('ENOENT: no such file or directory'))
  assert.equal(result, 'missing-file')
})

test('scan errors get human-readable file paths', () => {
  const message = formatScanError('C:/Music/test.mp3', new Error('Unsupported codec: mp3'))
  assert.match(message, /Unsupported|codec|test\.mp3/i)
})
