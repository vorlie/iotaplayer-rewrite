import test from 'node:test'
import assert from 'node:assert/strict'

const { getAppSettings, setAppSettings } = await import('../dist-electron/settings.js')

test('library root is persisted in settings', () => {
  const before = getAppSettings()
  const customRoot = 'C:/Users/Test/Music'

  try {
    const saved = setAppSettings({ libraryRoot: customRoot })
    assert.equal(saved.libraryRoot, customRoot)
    assert.equal(getAppSettings().libraryRoot, customRoot)
  } finally {
    setAppSettings({ libraryRoot: before.libraryRoot ?? 'D:/Media/Music' })
  }
})

test('lyricsSourcePreference defaults to embedded and persists valid options', () => {
  const before = getAppSettings()

  try {
    const reset = setAppSettings({ lyricsSourcePreference: 'embedded' })
    assert.equal(reset.lyricsSourcePreference, 'embedded')

    const synced = setAppSettings({ lyricsSourcePreference: 'synchronized' })
    assert.equal(synced.lyricsSourcePreference, 'synchronized')
    assert.equal(getAppSettings().lyricsSourcePreference, 'synchronized')

    const sidecar = setAppSettings({ lyricsSourcePreference: 'sidecar' })
    assert.equal(sidecar.lyricsSourcePreference, 'sidecar')
    assert.equal(getAppSettings().lyricsSourcePreference, 'sidecar')

    const invalid = setAppSettings({ lyricsSourcePreference: 'invalid-mode' })
    assert.equal(invalid.lyricsSourcePreference, 'embedded')
  } finally {
    setAppSettings({ lyricsSourcePreference: before.lyricsSourcePreference ?? 'embedded' })
  }
})

test('lowPerformanceMode defaults to false and persists boolean values', () => {
  const before = getAppSettings()

  try {
    const enabled = setAppSettings({ lowPerformanceMode: true })
    assert.equal(enabled.lowPerformanceMode, true)
    assert.equal(getAppSettings().lowPerformanceMode, true)

    const disabled = setAppSettings({ lowPerformanceMode: false })
    assert.equal(disabled.lowPerformanceMode, false)
    assert.equal(getAppSettings().lowPerformanceMode, false)
  } finally {
    setAppSettings({ lowPerformanceMode: before.lowPerformanceMode ?? false })
  }
})

test('visualizerEnabled defaults to true and persists boolean values', () => {
  const before = getAppSettings()

  try {
    const disabled = setAppSettings({ visualizerEnabled: false })
    assert.equal(disabled.visualizerEnabled, false)
    assert.equal(getAppSettings().visualizerEnabled, false)

    const enabled = setAppSettings({ visualizerEnabled: true })
    assert.equal(enabled.visualizerEnabled, true)
    assert.equal(getAppSettings().visualizerEnabled, true)
  } finally {
    setAppSettings({ visualizerEnabled: before.visualizerEnabled ?? true })
  }
})
