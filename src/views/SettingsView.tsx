import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AudioLines, ExternalLink, Globe, Library, RefreshCw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { applyAppLanguage } from '../i18n'
import { formatNumber } from '../i18n/format'
import { notifyLyricsReload } from '../hooks/useLibrary'
import { useAppStore } from '../store'
import type { AppInfo, AppLanguage, FullscreenStyle, LyricsSourcePreference, PlaybackBackendMode, ScanResult } from '../types/electron'
import '../styles/settings.css'

const DEFAULT_LIBRARY_ROOT = ''

const settingsCategories = [
  { id: 'playback', Icon: AudioLines },
  { id: 'library', Icon: Library },
  { id: 'integrations', Icon: ShieldCheck },
] as const

export function SettingsView() {
  const { t, i18n } = useTranslation(['settings', 'common'])
  const { library, scanLibrary, cleanupMissingTracks, fullscreenStyle, setFullscreenStyle } = useAppStore()
  const [libraryRoot, setLibraryRoot] = useState(DEFAULT_LIBRARY_ROOT)
  const [scanning, setScanning] = useState(false)
  const [cleaningMissing, setCleaningMissing] = useState(false)
  const [lastResult, setLastResult] = useState<ScanResult | null>(library.lastScanResult)
  const [backendMode, setBackendMode] = useState<PlaybackBackendMode>('auto')
  const [lyricsSourcePreference, setLyricsSourcePreference] = useState<LyricsSourcePreference>('embedded')
  const [language, setLanguage] = useState<AppLanguage>('system')
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
      setLanguage(settings.language ?? 'system')
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

  async function handleLanguageChange(nextLanguage: AppLanguage) {
    setLanguage(nextLanguage)
    await applyAppLanguage(nextLanguage, appInfo?.systemLocale)
    await window.settings.set({ language: nextLanguage })
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
        language,
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
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-subtitle">{t('subtitle')}</p>
      </div>

      <div className="page-body settings-page-body">
        <div className="settings-shell">
          <aside className="settings-sidebar">
            <div className="settings-sidebar__label">{t('navigation')}</div>
            {settingsCategories.map(({ id, Icon }) => (
              <a key={id} href={`#${id}`} className="settings-sidebar__link">
                <Icon size={14} />
                <span>{t(`categories.${id}`)}</span>
              </a>
            ))}
            <div className="settings-sidebar__divider" />
            <div className="settings-actions">
              <button type="button" className="settings-button settings-button--primary settings-button--save" onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? t('saving') : t('saveSettings')}
              </button>
            </div>
          </aside>

          <main className="settings-content">
            <section id="playback" className="settings-section">
              <header className="settings-section__header">
                <div>
                  <p className="settings-section__eyebrow">{t('playback.eyebrow')}</p>
                  <h2>{t('playback.heading')}</h2>
                </div>
                <Sparkles size={16} className="settings-section__icon" />
              </header>

              <div className="settings-card">
                <div className="settings-field">
                  <label htmlFor="app-language" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Globe size={13} />
                    {t('language.title')}
                  </label>
                  <select
                    id="app-language"
                    value={language}
                    onChange={(e) => void handleLanguageChange(e.target.value as AppLanguage)}
                  >
                    <option value="system">{t('language.options.system')}</option>
                    <option value="en">{t('language.options.en')}</option>
                    <option value="pl">{t('language.options.pl')}</option>
                  </select>
                  <small>{t('language.description')}</small>
                </div>

                <div className="settings-field">
                  <label htmlFor="audio-backend">{t('playback.backendLabel')}</label>
                  <select
                    id="audio-backend"
                    value={backendMode}
                    onChange={(e) => setBackendMode(e.target.value as PlaybackBackendMode)}
                  >
                    <option value="auto">{t('playback.backendOptions.auto')}</option>
                    <option value="mpv">{t('playback.backendOptions.mpv')}</option>
                    <option value="browser">{t('playback.backendOptions.browser')}</option>
                  </select>
                  <small>{t('playback.backendHint')}</small>
                </div>

                <div className="settings-field">
                  <label htmlFor="fullscreen-style">{t('playback.fullscreenStyleLabel')}</label>
                  <select
                    id="fullscreen-style"
                    value={fullscreenStyle}
                    onChange={(e) => setFullscreenStyle(e.target.value as FullscreenStyle)}
                  >
                    <option value="classic">{t('playback.fullscreenStyleOptions.classic')}</option>
                    <option value="still">{t('playback.fullscreenStyleOptions.still')}</option>
                  </select>
                  <small>{t('playback.fullscreenStyleHint')}</small>
                </div>

                <div className="settings-field">
                  <p className="settings-section__eyebrow" style={{ marginBottom: 2 }}>{t('lyrics.eyebrow')}</p>
                  <label htmlFor="lyrics-source-preference">{t('lyrics.label')}</label>
                  <select
                    id="lyrics-source-preference"
                    value={lyricsSourcePreference}
                    onChange={(e) => void handleLyricsPreferenceChange(e.target.value as LyricsSourcePreference)}
                  >
                    <option value="embedded">{t('lyrics.options.embedded')}</option>
                    <option value="synchronized">{t('lyrics.options.synchronized')}</option>
                    <option value="sidecar">{t('lyrics.options.sidecar')}</option>
                  </select>
                  <small>
                    {lyricsSourcePreference === 'embedded' && t('lyrics.hints.embedded')}
                    {lyricsSourcePreference === 'synchronized' && t('lyrics.hints.synchronized')}
                    {lyricsSourcePreference === 'sidecar' && t('lyrics.hints.sidecar')}
                  </small>
                </div>

                <div className="settings-toggle-row">
                  <div>
                    <h3>{t('discord.title')}</h3>
                    <p>{t('discord.description')}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={discordEnabled}
                    onChange={(e) => setDiscordEnabled(e.target.checked)}
                  />
                </div>

                <div className="settings-field">
                  <label htmlFor="discord-app-id">{t('discord.clientIdLabel')}</label>
                  <input
                    id="discord-app-id"
                    type="text"
                    value={discordClientId}
                    onChange={(e) => setDiscordClientId(e.target.value)}
                    placeholder={t('discord.clientIdPlaceholder')}
                  />
                </div>

                <div className="settings-field">
                  <label htmlFor="imgur-client-id">{t('discord.imgurIdLabel')}</label>
                  <input
                    id="imgur-client-id"
                    type="text"
                    value={imgurClientId}
                    onChange={(e) => setImgurClientId(e.target.value)}
                    placeholder={t('discord.imgurIdPlaceholder')}
                  />
                </div>
              </div>
            </section>

            <section id="library" className="settings-section">
              <header className="settings-section__header">
                <div>
                  <p className="settings-section__eyebrow">{t('library.eyebrow')}</p>
                  <h2>{t('library.heading')}</h2>
                </div>
                <Library size={16} className="settings-section__icon" />
              </header>

              <div className="settings-card">
                <div className="settings-field">
                  <label htmlFor="library-root">{t('library.rootLabel')}</label>
                  <div className="settings-input-row">
                    <input
                      id="library-root"
                      type="text"
                      value={libraryRoot}
                      onChange={(e) => setLibraryRoot(e.target.value)}
                      placeholder={t('library.rootPlaceholder')}
                    />
                    <button type="button" className="settings-button settings-button--secondary" onClick={handlePickLibraryRoot}>
                      {t('common:actions.browse')}
                    </button>
                  </div>
                </div>

                <div className="settings-button-row">
                  <button type="button" className="settings-button settings-button--primary" onClick={handleScan} disabled={scanning}>
                    <RefreshCw size={14} className={scanning ? 'spin' : ''} />
                    {scanning ? t('library.scanning') : t('library.scan')}
                  </button>

                  <button type="button" className="settings-button settings-button--ghost" onClick={handleCleanupMissing} disabled={cleaningMissing}>
                    <Trash2 size={14} />
                    {cleaningMissing ? t('library.cleaning') : t('library.cleanMissing')}
                  </button>
                </div>

                {scanning && scanProgress && (
                  <div className="settings-progress">
                    <div className="settings-progress__label">
                      {scanProgress.phase === 'discovering' && t('library.progress.discovering')}
                      {scanProgress.phase === 'scanning' &&
                        t('library.progress.scanning', { current: scanProgress.current, total: scanProgress.total })}
                      {scanProgress.phase === 'removing' && t('library.progress.removing')}
                      {scanProgress.phase === 'done' && t('library.progress.done')}
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
                      <span>{t('library.summary.lastScan')}</span>
                      <strong>
                        {t('library.summary.duration', {
                          seconds: formatNumber(
                            lastResult.duration_ms / 1000,
                            { minimumFractionDigits: 1, maximumFractionDigits: 1 },
                            i18n.resolvedLanguage,
                          ),
                        })}
                      </strong>
                    </div>
                    <div className="settings-summary__grid">
                      {[
                        [t('library.summary.total'), lastResult.total],
                        [t('library.summary.unchanged'), lastResult.unchanged],
                        [t('library.summary.added'), lastResult.added],
                        [t('library.summary.updated'), lastResult.updated],
                        [t('library.summary.removed'), lastResult.removed],
                        [t('library.summary.failed'), lastResult.failed],
                      ].map(([label, value]) => (
                        <div key={label as string} className="settings-summary__item">
                          <span>{label}</span>
                          <strong>{formatNumber(value as number, undefined, i18n.resolvedLanguage)}</strong>
                        </div>
                      ))}
                    </div>

                    {lastResult.errors.length > 0 && (
                      <details className="settings-errors">
                        <summary>{t('library.summary.errorsCount', { count: lastResult.errors.length })}</summary>
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
                      [t('library.stats.tracks'), stats.track_count],
                      [t('library.stats.albums'), stats.album_count],
                      [t('library.stats.artists'), stats.artist_count],
                    ].map(([label, value]) => (
                      <div key={label as string} className="settings-stat">
                        <div className="settings-stat__value">{formatNumber(value as number, undefined, i18n.resolvedLanguage)}</div>
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
                  <p className="settings-section__eyebrow">{t('integrations.eyebrow')}</p>
                  <h2>{t('integrations.heading')}</h2>
                </div>
                <ShieldCheck size={16} className="settings-section__icon" />
              </header>

              <div className="settings-card settings-card--compact">
                <div className="settings-status">
                  <span className="settings-status__dot" />
                  {discordEnabled ? t('discord.enabledStatus') : t('discord.disabledStatus')}
                </div>
                <div className="settings-status settings-status--muted">
                  <span className="settings-status__dot settings-status__dot--muted" />
                  {imgurClientId ? t('discord.imgurConfigured') : t('discord.imgurNotConfigured')}
                </div>
              </div>

              <div className="settings-card settings-card--compact" style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>
                      {appInfo?.name ?? t('common:app.name')} {appInfo?.version ? `v${appInfo.version}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                      {t('integrations.publishedBy', { publisher: appInfo?.publisher ?? 'vorlie', appId: 'pl.vorlie.iotaplayer' })}
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
