import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAppStore } from '../store'
import type { PlaybackBackendMode, ScanResult } from '../types/electron'
import '../styles/library.css'

// Default library root
const DEFAULT_LIBRARY_ROOT = 'D:\\Media\\Music'

export function SettingsView() {
  const { library, scanLibrary } = useAppStore()
  const [libraryRoot, setLibraryRoot] = useState(DEFAULT_LIBRARY_ROOT)
  const [scanning, setScanning] = useState(false)
  const [lastResult, setLastResult] = useState<ScanResult | null>(library.lastScanResult)
  const [backendMode, setBackendMode] = useState<PlaybackBackendMode>('auto')
  const [discordEnabled, setDiscordEnabled] = useState(true)
  const [discordClientId, setDiscordClientId] = useState('')
  const [imgurClientId, setImgurClientId] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const scanProgress = library.scanProgress

  useEffect(() => {
    void window.playback.getPreferredBackend().then((mode) => {
      setBackendMode(mode)
    })
    void window.settings.get().then((settings) => {
      setDiscordEnabled(settings.discordEnabled)
      setDiscordClientId(settings.discordClientId)
      setImgurClientId(settings.imgurClientId)
    })
  }, [])

  useEffect(() => {
    void window.playback.setPreferredBackend(backendMode)
  }, [backendMode])

  async function handleSaveSettings() {
    setSavingSettings(true)
    try {
      await window.settings.set({
        discordEnabled,
        discordClientId,
        imgurClientId,
      })
      await window.discord.setEnabled(discordEnabled)
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleScan() {
    if (scanning) return
    setScanning(true)
    setLastResult(null)
    try {
      const result = await scanLibrary(libraryRoot)
      setLastResult(result)
    } finally {
      setScanning(false)
    }
  }

  const stats = library.stats

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="page-body" style={{ maxWidth: 560 }}>
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            Playback
          </h2>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
                marginBottom: 'var(--space-2)',
              }}
            >
              Audio backend
            </label>

            <select
              value={backendMode}
              onChange={(e) => setBackendMode(e.target.value as PlaybackBackendMode)}
              style={{
                width: '100%',
                background: 'var(--color-surface-2)',
                color: 'var(--color-text-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-2) var(--space-3)',
              }}
            >
              <option value="auto">Automatic</option>
              <option value="mpv">MPV only</option>
              <option value="browser">Browser fallback only</option>
            </select>

            <div
              style={{
                marginTop: 'var(--space-2)',
                color: 'var(--color-text-3)',
                fontSize: 'var(--text-xs)',
              }}
            >
              .wav files always use MPV.
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-4)' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>Discord Rich Presence</div>
                <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
                  Shows the current track and audio progress in Discord.
                </div>
              </div>

              <input
                type="checkbox"
                checked={discordEnabled}
                onChange={(e) => setDiscordEnabled(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
            </label>
          </div>

          <div style={{ marginTop: 'var(--space-4)' }}>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
                marginBottom: 'var(--space-2)',
              }}
            >
              Discord Application ID
            </label>
            <input
              type="text"
              value={discordClientId}
              onChange={(e) => setDiscordClientId(e.target.value)}
              placeholder="Paste your Discord app ID"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginTop: 'var(--space-4)' }}>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
                marginBottom: 'var(--space-2)',
              }}
            >
              Imgur Client ID
            </label>
            <input
              type="text"
              value={imgurClientId}
              onChange={(e) => setImgurClientId(e.target.value)}
              placeholder="Paste your Imgur client ID"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={savingSettings}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                background: savingSettings ? 'var(--color-surface-3)' : 'var(--color-accent)',
                color: savingSettings ? 'var(--color-text-3)' : '#fff',
                borderRadius: 'var(--radius)',
                fontWeight: 600,
                cursor: savingSettings ? 'not-allowed' : 'pointer',
              }}
            >
              {savingSettings ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </section>

        {/* Library section */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            Music Library
          </h2>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
                marginBottom: 'var(--space-2)',
              }}
            >
              Library Root
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                type="text"
                value={libraryRoot}
                onChange={(e) => setLibraryRoot(e.target.value)}
                style={{ flex: 1 }}
                placeholder="e.g. D:\Media\Music"
              />
              <button
                onClick={handleScan}
                disabled={scanning}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-4)',
                  background: scanning ? 'var(--color-surface-3)' : 'var(--color-accent)',
                  color: scanning ? 'var(--color-text-3)' : '#fff',
                  borderRadius: 'var(--radius)',
                  fontWeight: 600,
                  fontSize: 'var(--text-sm)',
                  cursor: scanning ? 'not-allowed' : 'pointer',
                  transition: 'background var(--transition)',
                  whiteSpace: 'nowrap',
                }}
              >
                <RefreshCw size={14} className={scanning ? 'spin' : ''} />
                {scanning ? 'Scanning…' : 'Scan Library'}
              </button>
            </div>
          </div>

          {/* Scan progress */}
          {scanning && scanProgress && (
            <div
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-sm)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <div style={{ color: 'var(--color-text-2)', marginBottom: 'var(--space-2)' }}>
                {scanProgress.phase === 'discovering' && 'Discovering files…'}
                {scanProgress.phase === 'scanning' && (
                  <>Scanning {scanProgress.current} / {scanProgress.total}…</>
                )}
                {scanProgress.phase === 'removing' && 'Cleaning up…'}
                {scanProgress.phase === 'done' && 'Done!'}
              </div>
              {scanProgress.current_file && (
                <div
                  style={{
                    color: 'var(--color-text-3)',
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {scanProgress.current_file}
                </div>
              )}
              {scanProgress.total > 0 && (
                <div
                  style={{
                    marginTop: 'var(--space-2)',
                    height: 3,
                    background: 'var(--color-surface-3)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${(scanProgress.current / scanProgress.total) * 100}%`,
                      height: '100%',
                      background: 'var(--color-accent)',
                      transition: 'width 0.15s ease',
                      borderRadius: 2,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Last scan result */}
          {lastResult && !scanning && (
            <div
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-sm)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <div style={{ color: 'var(--color-text-2)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                Last scan · {(lastResult.duration_ms / 1000).toFixed(1)}s
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
                {[
                  ['Total', lastResult.total],
                  ['Unchanged', lastResult.unchanged],
                  ['Added', lastResult.added],
                  ['Updated', lastResult.updated],
                  ['Removed', lastResult.removed],
                  ['Failed', lastResult.failed],
                ].map(([label, value]) => (
                  <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-3)' }}>{label}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                  </div>
                ))}
              </div>

              {lastResult.errors.length > 0 && (
                <details style={{ marginTop: 'var(--space-3)' }}>
                  <summary style={{ color: '#ef4444', cursor: 'pointer', fontSize: 'var(--text-xs)' }}>
                    {lastResult.errors.length} errors
                  </summary>
                  <div
                    style={{
                      marginTop: 'var(--space-2)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-3)',
                      maxHeight: 120,
                      overflowY: 'auto',
                    }}
                  >
                    {lastResult.errors.map((e, i) => (
                      <div key={i}>{e}</div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Library stats */}
          {stats && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 'var(--space-3)',
              }}
            >
              {[
                ['Tracks', stats.track_count],
                ['Albums', stats.album_count],
                ['Artists', stats.artist_count],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  style={{
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                    padding: 'var(--space-3) var(--space-4)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{value}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
