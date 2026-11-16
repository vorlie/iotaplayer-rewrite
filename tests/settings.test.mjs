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
