import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const {
  getAppSettings,
  setAppSettings,
  normalizeAppLanguage,
} = await import('../dist-electron/settings.js')

const {
  resolveSystemLocale,
  resolveElectronLanguage,
  getElectronStrings,
} = await import('../dist-electron/i18n.js')

const { formatScanError } = await import('../dist-electron/scanner.js')

const NAMESPACES = ['common', 'player', 'library', 'playlists', 'settings']
const LOCALES_DIR = path.resolve('src/i18n/locales')

function flattenEntries(obj, prefix = '') {
  const entries = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      entries.push(...flattenEntries(value, fullKey))
    } else {
      entries.push([fullKey, value])
    }
  }
  return entries
}

function stripPluralSuffix(key) {
  return key.replace(/_(zero|one|two|few|many|other)$/, '')
}

function extractPlaceholders(str) {
  const matches = String(str).match(/\{\{\s*[\w.]+\s*\}\}/g) ?? []
  return matches.map((m) => m.replace(/\s+/g, '')).sort()
}

test('en and pl translation files have full key, plural, and placeholder parity', () => {
  for (const ns of NAMESPACES) {
    const enJson = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en', `${ns}.json`), 'utf8'))
    const plJson = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'pl', `${ns}.json`), 'utf8'))

    const enEntries = flattenEntries(enJson)
    const plEntries = flattenEntries(plJson)

    const enMap = new Map(enEntries)
    const plMap = new Map(plEntries)

    const enBases = new Set(enEntries.map(([k]) => stripPluralSuffix(k)))
    const plBases = new Set(plEntries.map(([k]) => stripPluralSuffix(k)))

    for (const base of enBases) {
      assert.ok(plBases.has(base), `Missing Polish key "${ns}:${base}"`)
    }

    for (const base of plBases) {
      assert.ok(enBases.has(base), `Extra Polish key "${ns}:${base}" not present in English`)
    }

    for (const [key, val] of enEntries) {
      assert.equal(typeof val, 'string', `Expected string at en/${ns}:${key}`)
      assert.ok(val.trim().length > 0, `Empty string at en/${ns}:${key}`)
    }

    for (const [key, val] of plEntries) {
      assert.equal(typeof val, 'string', `Expected string at pl/${ns}:${key}`)
      assert.ok(val.trim().length > 0, `Empty string at pl/${ns}:${key}`)
    }

    const pluralBases = new Set(
      enEntries.filter(([k]) => /_one$/.test(k)).map(([k]) => stripPluralSuffix(k)),
    )

    for (const base of pluralBases) {
      for (const suffix of ['_one', '_few', '_many', '_other']) {
        assert.ok(plMap.has(`${base}${suffix}`), `Missing Polish plural form "${ns}:${base}${suffix}"`)
      }

      const enPlaceholders = extractPlaceholders(enMap.get(`${base}_other`) ?? enMap.get(`${base}_one`))
      for (const suffix of ['_one', '_few', '_many', '_other']) {
        const plPlaceholders = extractPlaceholders(plMap.get(`${base}${suffix}`))
        assert.deepEqual(
          plPlaceholders,
          enPlaceholders,
          `Placeholder mismatch in "${ns}:${base}${suffix}"`,
        )
      }
    }

    for (const [key, enVal] of enEntries) {
      if (/_(one|other)$/.test(key)) continue
      const plVal = plMap.get(key)
      assert.ok(plVal !== undefined, `Missing pl/${ns}:${key}`)
      assert.deepEqual(
        extractPlaceholders(plVal),
        extractPlaceholders(enVal),
        `Placeholder mismatch in "${ns}:${key}"`,
      )
    }
  }
})

test('normalizeAppLanguage, resolveSystemLocale, and resolveElectronLanguage handle valid and fallback inputs', () => {
  assert.equal(normalizeAppLanguage('system'), 'system')
  assert.equal(normalizeAppLanguage('en'), 'en')
  assert.equal(normalizeAppLanguage('pl'), 'pl')
  assert.equal(normalizeAppLanguage('de'), 'system')
  assert.equal(normalizeAppLanguage(null), 'system')

  assert.equal(resolveSystemLocale('pl-PL'), 'pl')
  assert.equal(resolveSystemLocale('pl'), 'pl')
  assert.equal(resolveSystemLocale('en-US'), 'en')
  assert.equal(resolveSystemLocale('fr-FR'), 'en')
  assert.equal(resolveSystemLocale(undefined), 'en')

  assert.equal(resolveElectronLanguage('system', 'pl-PL'), 'pl')
  assert.equal(resolveElectronLanguage('system', 'en-GB'), 'en')
  assert.equal(resolveElectronLanguage('en', 'pl-PL'), 'en')
  assert.equal(resolveElectronLanguage('pl', 'en-US'), 'pl')
})

test('language preference persists system, en, and pl in settings', () => {
  const previous = getAppSettings().language
  try {
    setAppSettings({ language: 'pl' })
    assert.equal(getAppSettings().language, 'pl')

    setAppSettings({ language: 'en' })
    assert.equal(getAppSettings().language, 'en')

    setAppSettings({ language: 'system' })
    assert.equal(getAppSettings().language, 'system')
  } finally {
    setAppSettings({ language: previous })
  }
})

test('Electron strings and scan errors localize cleanly for en and pl', () => {
  assert.equal(getElectronStrings('en').pickLibraryRootTitle, 'Select your music library folder')
  assert.equal(getElectronStrings('pl').pickLibraryRootTitle, 'Wybierz folder biblioteki muzycznej')

  const enErr = formatScanError('C:/Music/song.flac', new Error('Unsupported codec'), 'en')
  const plErr = formatScanError('C:/Music/song.flac', new Error('Unsupported codec'), 'pl')

  assert.match(enErr, /Unsupported or unreadable codec/)
  assert.match(plErr, /Nieobsługiwany lub nieczytelny kodek/)
})
