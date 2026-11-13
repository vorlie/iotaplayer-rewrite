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
