import test from 'node:test'
import assert from 'node:assert/strict'

const { normalizeMediaControlSnapshot } = await import('../dist-electron/mediaControls.js')

test('media control snapshot normalizes values for OS media integrations', () => {
  const snapshot = normalizeMediaControlSnapshot({
    title: 'Song Name',
    artist: '',
    album: null,
    duration: 240,
    position: 42,
    isPlaying: true,
    artworkUrl: 'data:image/png;base64,abc123',
  })

  assert.equal(snapshot.title, 'Song Name')
  assert.equal(snapshot.artist, 'Unknown artist')
  assert.equal(snapshot.album, 'Unknown album')
  assert.equal(snapshot.position, 42)
  assert.equal(snapshot.duration, 240)
  assert.equal(snapshot.isPlaying, true)
  assert.equal(snapshot.artworkUrl, 'data:image/png;base64,abc123')
})
