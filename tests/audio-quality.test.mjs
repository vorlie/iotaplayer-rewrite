import test from 'node:test'
import assert from 'node:assert/strict'

const {
  classifyAudioQuality,
  formatFileSize,
  formatSampleRate,
  normalizeCodecLabel,
} = await import('../dist-electron/audioQuality.js')

test('classifies CD-quality FLAC and ALAC as lossless (not hi-res)', () => {
  const flac = classifyAudioQuality({
    codec: 'FLAC',
    format: 'FLAC',
    bitrate: 950,
    sample_rate: 44100,
    bits_per_sample: 16,
    path: '/music/album/01.flac',
    is_lossless: 1,
  })
  assert.equal(flac.tier, 'lossless')
  assert.equal(flac.codecLabel, 'FLAC')
  assert.equal(flac.isLossless, true)
  assert.equal(flac.isHiRes, false)
  assert.equal(flac.badgeLabel, 'FLAC')

  const alac = classifyAudioQuality({
    codec: 'ALAC',
    format: 'MPEG-4',
    bitrate: 1020,
    sample_rate: 48000,
    bits_per_sample: 16,
    path: '/music/album/01.m4a',
    is_lossless: null,
  })
  assert.equal(alac.tier, 'lossless')
  assert.equal(alac.codecLabel, 'ALAC')
  assert.equal(alac.isLossless, true)
  assert.equal(alac.isHiRes, false)
})

test('classifies 24-bit or >48kHz lossless tracks as hi-res', () => {
  const flac24_96 = classifyAudioQuality({
    codec: 'FLAC',
    format: 'FLAC',
    bitrate: 2800,
    sample_rate: 96000,
    bits_per_sample: 24,
    path: '/music/hires.flac',
    is_lossless: 1,
  })
  assert.equal(flac24_96.tier, 'hi-res')
  assert.equal(flac24_96.isHiRes, true)
  assert.equal(flac24_96.badgeLabel, 'FLAC 24/96')

  const wav24_44 = classifyAudioQuality({
    codec: 'PCM',
    format: 'WAVE',
    bitrate: 2116,
    sample_rate: 44100,
    bits_per_sample: 24,
    path: '/music/master.wav',
    is_lossless: null,
  })
  assert.equal(wav24_44.tier, 'hi-res')
  assert.equal(wav24_44.codecLabel, 'WAV')
  assert.equal(wav24_44.badgeLabel, 'WAV 24/44.1')
})

test('distinguishes lossy AAC in M4A, MP3, and Opus without misclassifying as lossless', () => {
  const aac = classifyAudioQuality({
    codec: 'AAC',
    format: 'MPEG-4',
    bitrate: 256,
    sample_rate: 44100,
    bits_per_sample: null,
    path: '/music/song.m4a',
    is_lossless: 0,
  })
  assert.equal(aac.tier, 'lossy')
  assert.equal(aac.isLossless, false)
  assert.equal(aac.isHiRes, false)
  assert.equal(aac.badgeLabel, 'AAC 256')

  const mp3 = classifyAudioQuality({
    codec: 'MPEG 1 Layer 3',
    format: 'MPEG',
    bitrate: 320,
    sample_rate: 44100,
    bits_per_sample: null,
    path: '/music/song.mp3',
    is_lossless: null,
  })
  assert.equal(mp3.tier, 'lossy')
  assert.equal(mp3.codecLabel, 'MP3')
  assert.equal(mp3.badgeLabel, 'MP3 320')

  const opus = classifyAudioQuality({
    codec: 'Opus',
    format: 'Ogg',
    bitrate: 160,
    sample_rate: 48000,
    bits_per_sample: null,
    path: '/music/song.opus',
    is_lossless: null,
  })
  assert.equal(opus.tier, 'lossy')
  assert.equal(opus.codecLabel, 'Opus')
  assert.equal(opus.badgeLabel, 'Opus 160')
})

test('handles unknown/missing metadata gracefully', () => {
  const unknown = classifyAudioQuality({
    codec: null,
    format: null,
    bitrate: null,
    sample_rate: null,
    bits_per_sample: null,
    path: '/music/mystery.bin',
    is_lossless: null,
  })
  assert.equal(unknown.tier, 'unknown')
  assert.equal(unknown.isLossless, false)
  assert.equal(normalizeCodecLabel(null, null, '/music/test.flac'), 'FLAC')
  assert.equal(formatSampleRate(44100), '44.1 kHz')
  assert.equal(formatSampleRate(96000), '96 kHz')
  assert.equal(formatFileSize(1024 * 1024 * 42.5), '42.5 MB')
})
