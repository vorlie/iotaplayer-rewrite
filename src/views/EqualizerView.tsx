import { useEffect, useState } from 'react'

const DEFAULT_EQUALIZER_BANDS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
const EQUALIZER_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
const EQUALIZER_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Warm: [2, 3, 4, 3, 2, 0, -1, -2, -1, 0],
  Bright: [-1, -1, 0, 1, 2, 3, 2, 1, 0, -1],
  Bass: [5, 4, 3, 2, 1, 0, -1, -2, -2, -1],
  Vocal: [0, 0, -1, 0, 2, 4, 3, 1, 0, 0],
  Club: [3, 2, 1, 0, 2, 4, 5, 4, 3, 2],
}

export function EqualizerView() {
  const [equalizerEnabled, setEqualizerEnabled] = useState(false)
  const [equalizerPreset, setEqualizerPreset] = useState('Flat')
  const [equalizerBands, setEqualizerBands] = useState<number[]>(DEFAULT_EQUALIZER_BANDS)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    void window.settings.get().then((settings) => {
      setEqualizerEnabled(settings.equalizerEnabled)
      setEqualizerPreset(settings.equalizerPreset || 'Flat')
      setEqualizerBands(settings.equalizerBands?.length ? settings.equalizerBands : DEFAULT_EQUALIZER_BANDS)
    })
  }, [])

  useEffect(() => {
    if (!equalizerEnabled) {
      void window.playback.setEqualizer(DEFAULT_EQUALIZER_BANDS)
      return
    }

    void window.playback.setEqualizer(equalizerBands)
  }, [equalizerEnabled, equalizerBands])

  async function handleSaveSettings() {
    setSavingSettings(true)
    try {
      await window.settings.set({
        equalizerEnabled,
        equalizerPreset,
        equalizerBands,
      })
      await window.playback.setEqualizer(equalizerEnabled ? equalizerBands : DEFAULT_EQUALIZER_BANDS)
    } finally {
      setSavingSettings(false)
    }
  }

  function applyPreset(name: string) {
    const preset = EQUALIZER_PRESETS[name]
    if (!preset) return

    setEqualizerPreset(name)
    setEqualizerBands([...preset])
  }

  function updateBand(index: number, value: number) {
    setEqualizerBands((current) => {
      const next = [...current]
      next[index] = value
      return next
    })
    setEqualizerPreset('Custom')
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Equalizer</h1>
      </div>

      <div className="page-body" style={{ maxWidth: 760 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
            flexWrap: 'wrap',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={equalizerEnabled}
              onChange={(e) => setEqualizerEnabled(e.target.checked)}
            />
            Enable equalizer
          </label>

          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={equalizerPreset}
              onChange={(e) => applyPreset(e.target.value)}
              style={{
                minWidth: 180,
                background: 'var(--color-surface-2)',
                color: 'var(--color-text-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-2) var(--space-3)',
              }}
            >
              {Object.keys(EQUALIZER_PRESETS).map((presetName) => (
                <option key={presetName} value={presetName}>
                  {presetName}
                </option>
              ))}
              <option value="Custom">Custom</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setEqualizerPreset('Flat')
                setEqualizerBands([...DEFAULT_EQUALIZER_BANDS])
              }}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius)',
                background: 'var(--color-surface-2)',
                color: 'var(--color-text-1)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {equalizerBands.map((gain, index) => (
              <div
                key={EQUALIZER_BANDS[index]}
                style={{
                  display: 'grid',
                  alignItems: 'center',
                  gridTemplateColumns: '64px minmax(160px, 1fr) 56px',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-3)', fontWeight: 600 }}>
                  {EQUALIZER_BANDS[index]} Hz
                </div>

                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={gain}
                  onChange={(event) => updateBand(index, Number(event.target.value))}
                  disabled={!equalizerEnabled}
                  style={{ width: '100%' }}
                />

                <div
                  style={{
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--color-text-2)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  {gain > 0 ? '+' : ''}{gain.toFixed(1)} dB
                </div>
              </div>
            ))}
          </div>
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
      </div>
    </div>
  )
}
