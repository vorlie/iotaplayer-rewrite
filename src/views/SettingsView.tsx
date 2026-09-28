import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAppStore } from '../store'
import type { ScanResult } from '../types/electron'
import '../styles/library.css'

// Default library root
const DEFAULT_LIBRARY_ROOT = 'D:\\Media\\Music'

export function SettingsView() {
  const { library, scanLibrary } = useAppStore()
  const [libraryRoot, setLibraryRoot] = useState(DEFAULT_LIBRARY_ROOT)
  const [scanning, setScanning] = useState(false)
  const [lastResult, setLastResult] = useState<ScanResult | null>(library.lastScanResult)
  const scanProgress = library.scanProgress

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
