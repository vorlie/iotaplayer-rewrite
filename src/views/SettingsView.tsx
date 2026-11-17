import { useEffect, useState } from 'react'
import { AudioLines, ExternalLink, Library, RefreshCw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { notifyLyricsReload } from '../hooks/useLibrary'
import { useAppStore } from '../store'
import type { AppInfo, LyricsSourcePreference, PlaybackBackendMode, ScanResult } from '../types/electron'
import '../styles/settings.css'

const DEFAULT_LIBRARY_ROOT = ''

const settingsCategories = [
  { id: 'playback', label: 'Playback', Icon: AudioLines },
  { id: 'library', label: 'Library', Icon: Library },
  { id: 'integrations', label: 'Integrations', Icon: ShieldCheck },
]

export function SettingsView() {
  const { library, scanLibrary, cleanupMissingTracks } = useAppStore()
  const [libraryRoot, setLibraryRoot] = useState(DEFAULT_LIBRARY_ROOT)
  const [scanning, setScanning] = useState(false)
  const [cleaningMissing, setCleaningMissing] = useState(false)
  const [lastResult, setLastResult] = useState<ScanResult | null>(library.lastScanResult)
  const [backendMode, setBackendMode] = useState<PlaybackBackendMode>('auto')
  const [lyricsSourcePreference, setLyricsSourcePreference] = useState<LyricsSourcePreference>('embedded')
  const [discordEnabled, setDiscordEnabled] = useState(true)
  const [discordClientId, setDiscordClientId] = useState('')
  const [imgurClientId, setImgurClientId] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const scanProgress = library.scanProgress

  useEffect(() => {
    void window.playback.getPreferredBackend().then((mode) => {
      setBackendMode(mode)
    })
    void window.settings.get().then((settings) => {
      setDiscordEnabled(settings.discordEnabled)
      setDiscordClientId(settings.discordClientId)
      setImgurClientId(settings.imgurClientId)
      setLibraryRoot(settings.libraryRoot || DEFAULT_LIBRARY_ROOT)
      setLyricsSourcePreference(settings.lyricsSourcePreference ?? 'embedded')
    })
    void window.appInfo?.getInfo().then((info) => {
      setAppInfo(info)
    })
  }, [])

  useEffect(() => {
    void window.playback.setPreferredBackend(backendMode)
  }, [backendMode])

  async function handleLyricsPreferenceChange(nextPreference: LyricsSourcePreference) {
    setLyricsSourcePreference(nextPreference)
    await window.settings.set({ lyricsSourcePreference: nextPreference })
    notifyLyricsReload()
  }

  async function handleSaveSettings() {
    setSavingSettings(true)
    try {
      await window.settings.set({
        discordEnabled,
        discordClientId,
        imgurClientId,
        libraryRoot,
        lyricsSourcePreference,
      })
      await window.discord.setEnabled(discordEnabled)
      notifyLyricsReload()
    } finally {
      setSavingSettings(false)
    }
  }

  async function handlePickLibraryRoot() {
    const selectedPath = await window.settings.pickLibraryRoot()
    if (selectedPath) {
      setLibraryRoot(selectedPath)
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

  async function handleCleanupMissing() {
    if (cleaningMissing) return
    setCleaningMissing(true)

    try {
      const result = await cleanupMissingTracks()
      setLastResult((previous) => {
        if (!previous) {
          return {
            total: 0,
            unchanged: 0,
            added: 0,
            updated: 0,
            removed: result.removed,
            failed: 0,
            errors: result.errors,
            duration_ms: 0,
          }
        }

        return {
          ...previous,
          removed: previous.removed + result.removed,
          errors: [...previous.errors, ...result.errors],
        }
      })
    } finally {
      setCleaningMissing(false)
    }
  }

  const stats = library.stats

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage playback, library, and app integrations.</p>
      </div>

      <div className="page-body settings-page-body">
        <div className="settings-shell">
          <aside className="settings-sidebar">
            <div className="settings-sidebar__label">Navigation</div>
            {settingsCategories.map(({ id, label, Icon }) => (
              <a key={id} href={`#${id}`} className="settings-sidebar__link">
                <Icon size={14} />
                <span>{label}</span>
              </a>
            ))}
            <div className="settings-sidebar__divider" />
            <div className="settings-actions">
              <button type="button" className="settings-button settings-button--primary settings-button--save" onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </aside>

          <main className="settings-content">
            <section id="playback" className="settings-section">
              <header className="settings-section__header">
                <div>
                  <p className="settings-section__eyebrow">Playback</p>
                  <h2>Audio settings</h2>
                </div>
                <Sparkles size={16} className="settings-section__icon" />
              </header>

              <div className="settings-card">
                <div className="settings-field">
                  <label htmlFor="audio-backend">Audio backend</label>
                  <select
                    id="audio-backend"
                    value={backendMode}
                    onChange={(e) => setBackendMode(e.target.value as PlaybackBackendMode)}
                  >
                    <option value="auto">Automatic</option>
                    <option value="mpv">MPV only</option>
                    <option value="browser">Browser fallback only</option>
                  </select>
                  <small>.wav files always use MPV.</small>
                </div>

                <div className="settings-field">
                  <p className="settings-section__eyebrow" style={{ marginBottom: 2 }}>Lyrics</p>
                  <label htmlFor="lyrics-source-preference">Lyrics source preference</label>
                  <select
                    id="lyrics-source-preference"
                    value={lyricsSourcePreference}
                    onChange={(e) => void handleLyricsPreferenceChange(e.target.value as LyricsSourcePreference)}
                  >
                    <option value="embedded">Embedded (default)</option>
                    <option value="synchronized">Synchronized</option>
                    <option value="sidecar">Sidecar</option>
                  </select>
                  <small>
                    {lyricsSourcePreference === 'embedded' &&
                      'Prefer lyrics embedded in audio files, then fall back to sidecars.'}
                    {lyricsSourcePreference === 'synchronized' &&
                      'Prefer lyrics with the highest synchronization quality, regardless of source.'}
                    {lyricsSourcePreference === 'sidecar' &&
                      'Prefer external lyrics files, then fall back to embedded lyrics.'}
                  </small>
                </div>

                <div className="settings-toggle-row">
                  <div>
                    <h3>Discord Rich Presence</h3>
                    <p>Shows the current track and audio progress in Discord.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={discordEnabled}
                    onChange={(e) => setDiscordEnabled(e.target.checked)}
                  />
                </div>

                <div className="settings-field">
                  <label htmlFor="discord-app-id">Discord Application ID</label>
                  <input
                    id="discord-app-id"
                    type="text"
                    value={discordClientId}
                    onChange={(e) => setDiscordClientId(e.target.value)}
                    placeholder="Paste your Discord app ID"
                  />
                </div>

                <div className="settings-field">
                  <label htmlFor="imgur-client-id">Imgur Client ID</label>
                  <input
                    id="imgur-client-id"
                    type="text"
                    value={imgurClientId}
                    onChange={(e) => setImgurClientId(e.target.value)}
                    placeholder="Paste your Imgur client ID"
                  />
                </div>
              </div>
            </section>

            <section id="library" className="settings-section">
              <header className="settings-section__header">
                <div>
                  <p className="settings-section__eyebrow">Library</p>
                  <h2>Music collection</h2>
                </div>
                <Library size={16} className="settings-section__icon" />
              </header>

              <div className="settings-card">
                <div className="settings-field">
                  <label htmlFor="library-root">Library root</label>
                  <div className="settings-input-row">
                    <input
                      id="library-root"
                      type="text"
                      value={libraryRoot}
                      onChange={(e) => setLibraryRoot(e.target.value)}
                      placeholder="e.g. D:\Media\Music"
                    />
                    <button type="button" className="settings-button settings-button--secondary" onClick={handlePickLibraryRoot}>
                      Browse
                    </button>
                  </div>
                </div>

                <div className="settings-button-row">
                  <button type="button" className="settings-button settings-button--primary" onClick={handleScan} disabled={scanning}>
                    <RefreshCw size={14} className={scanning ? 'spin' : ''} />
                    {scanning ? 'Scanning…' : 'Scan Library'}
                  </button>

                  <button type="button" className="settings-button settings-button--ghost" onClick={handleCleanupMissing} disabled={cleaningMissing}>
                    <Trash2 size={14} />
                    {cleaningMissing ? 'Cleaning…' : 'Clean missing'}
                  </button>
                </div>

                {scanning && scanProgress && (
                  <div className="settings-progress">
                    <div className="settings-progress__label">
                      {scanProgress.phase === 'discovering' && 'Discovering files…'}
                      {scanProgress.phase === 'scanning' && (
                        <>Scanning {scanProgress.current} / {scanProgress.total}…</>
                      )}
                      {scanProgress.phase === 'removing' && 'Cleaning up…'}
                      {scanProgress.phase === 'done' && 'Done!'}
                    </div>
                    {scanProgress.current_file && (
                      <div className="settings-progress__file">{scanProgress.current_file}</div>
                    )}
                    {scanProgress.total > 0 && (
                      <div className="settings-progress__track">
                        <div
                          className="settings-progress__fill"
                          style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {lastResult && !scanning && (
                  <div className="settings-summary">
                    <div className="settings-summary__header">
                      <span>Last scan</span>
                      <strong>{(lastResult.duration_ms / 1000).toFixed(1)}s</strong>
                    </div>
                    <div className="settings-summary__grid">
                      {[
                        ['Total', lastResult.total],
                        ['Unchanged', lastResult.unchanged],
                        ['Added', lastResult.added],
                        ['Updated', lastResult.updated],
                        ['Removed', lastResult.removed],
                        ['Failed', lastResult.failed],
                      ].map(([label, value]) => (
                        <div key={label as string} className="settings-summary__item">
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>

                    {lastResult.errors.length > 0 && (
                      <details className="settings-errors">
                        <summary>{lastResult.errors.length} errors</summary>
                        <div className="settings-errors__list">
                          {lastResult.errors.map((error, index) => (
                            <div key={`${error}-${index}`}>{error}</div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}

                {stats && (
                  <div className="settings-stat-grid">
                    {[
                      ['Tracks', stats.track_count],
                      ['Albums', stats.album_count],
                      ['Artists', stats.artist_count],
                    ].map(([label, value]) => (
                      <div key={label as string} className="settings-stat">
                        <div className="settings-stat__value">{value}</div>
                        <div className="settings-stat__label">{label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section id="integrations" className="settings-section">
              <header className="settings-section__header">
                <div>
                  <p className="settings-section__eyebrow">Integrations</p>
                  <h2>Connected services</h2>
                </div>
                <ShieldCheck size={16} className="settings-section__icon" />
              </header>

              <div className="settings-card settings-card--compact">
                <div className="settings-status">
                  <span className="settings-status__dot" />
                  Discord presence is {discordEnabled ? 'enabled' : 'disabled'}
                </div>
                <div className="settings-status settings-status--muted">
                  <span className="settings-status__dot settings-status__dot--muted" />
                  Imgur client ID {imgurClientId ? 'configured' : 'not configured'}
                </div>
              </div>

              <div className="settings-card settings-card--compact" style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>
                      {appInfo?.name ?? 'IotaPlayer'} {appInfo?.version ? `v${appInfo.version}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                      Published by {appInfo?.publisher ?? 'vorlie'} · Identifier: pl.vorlie.iotaplayer
                    </div>
                  </div>
                  <a
                    href={appInfo?.projectUrl ?? 'https://vorlie.pl/projects/iotaplayer'}
                    target="_blank"
                    rel="noreferrer"
                    className="settings-button settings-button--secondary"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>vorlie.pl</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
