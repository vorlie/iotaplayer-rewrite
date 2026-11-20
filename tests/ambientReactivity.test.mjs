import test from 'node:test'
import assert from 'node:assert/strict'

const {
  DEFAULT_AMBIENT_REACTIVITY,
  normalizeAmbientReactivity,
  evaluateSpectrumRange,
  stepAmbientExposure,
} = await import('../dist-electron/ambientReactivity.js')

const { getAppSettings, setAppSettings } = await import('../dist-electron/settings.js')

test('normalizeAmbientReactivity clamps bounds and falls back safely', () => {
  const normalized = normalizeAmbientReactivity({
    enabled: false,
    freqStart: 0.9,
    freqEnd: 0.2,
    ampFloor: 0.85,
    ampCeiling: 0.5,
    mode: 'invalid',
    release: 99,
    intensity: -2,
  })

  assert.equal(normalized.enabled, false)
  assert.equal(normalized.freqStart, 0.9)
  assert.ok(normalized.freqEnd >= 0.95)
  assert.equal(normalized.ampFloor, 0.85)
  assert.ok(normalized.ampCeiling >= 0.95)
  assert.equal(normalized.mode, DEFAULT_AMBIENT_REACTIVITY.mode)
  assert.equal(normalized.release, 15)
  assert.equal(normalized.intensity, 0)
})

test('evaluateSpectrumRange computes average and peak within frequency and amplitude box', () => {
  const spectrum = [0.2, 0.8, 0.4, 0.6, 0.9, 0.9, 0.9, 0.9]
  const avgConfig = {
    ...DEFAULT_AMBIENT_REACTIVITY,
    freqStart: 0,
    freqEnd: 0.5, // first 4 bars: [0.2, 0.8, 0.4, 0.6]
    ampFloor: 0.2,
    ampCeiling: 0.8,
    mode: 'average',
  }

  // normalized bars: [0, 1, 0.3333, 0.6667] -> average = 0.5
  const avg = evaluateSpectrumRange(spectrum, avgConfig)
  assert.ok(Math.abs(avg - 0.5) < 1e-6)

  const peak = evaluateSpectrumRange(spectrum, { ...avgConfig, mode: 'peak' })
  assert.equal(peak, 1)

  const disabled = evaluateSpectrumRange(spectrum, { ...avgConfig, enabled: false })
  assert.equal(disabled, 0)

  const headroom = evaluateSpectrumRange([1, 1], {
    ...DEFAULT_AMBIENT_REACTIVITY,
    freqStart: 0,
    freqEnd: 1,
    ampFloor: 0,
    ampCeiling: 1.5,
    mode: 'peak',
  })
  assert.ok(Math.abs(headroom - 1 / 1.5) < 1e-6)

  const scaled = evaluateSpectrumRange([0.5, 0.5], {
    ...DEFAULT_AMBIENT_REACTIVITY,
    freqStart: 0,
    freqEnd: 1,
    ampFloor: 0,
    ampCeiling: 1,
    spectrumScale: 1.5,
    mode: 'peak',
  })
  assert.equal(scaled, 0.75)
})

test('stepAmbientExposure uses instant attack, exponential release, and exposure clamp', () => {
  const hit = stepAmbientExposure(0, 1, 0.016, DEFAULT_AMBIENT_REACTIVITY)
  assert.equal(hit.envelope, 1)
  assert.equal(hit.exposure, DEFAULT_AMBIENT_REACTIVITY.intensity)

  const decayed = stepAmbientExposure(1, 0, 0.2, DEFAULT_AMBIENT_REACTIVITY)
  assert.ok(Math.abs(decayed.envelope - Math.exp(-5 * 0.2)) < 1e-6)
})

test('ambientReactivity persists in app settings', () => {
  const before = getAppSettings()

  try {
    const custom = {
      enabled: true,
      freqStart: 0.05,
      freqEnd: 0.35,
      ampFloor: 0.15,
      ampCeiling: 1.85,
      spectrumCeiling: 2.2,
      spectrumScale: 1.25,
      mode: 'peak',
      release: 7,
      intensity: 0.75,
    }
    const saved = setAppSettings({ ambientReactivity: custom })
    assert.deepEqual(saved.ambientReactivity, custom)
    assert.deepEqual(getAppSettings().ambientReactivity, custom)
  } finally {
    setAppSettings({ ambientReactivity: before.ambientReactivity })
  }
})
