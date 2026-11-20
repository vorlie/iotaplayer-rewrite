import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AMBIENT_REACTIVITY_PRESETS,
  evaluateSpectrumRange,
  stepAmbientExposure,
} from '../../electron/ambientReactivity'
import { useAppStore, usePlaybackStore } from '../store'

type DragMode =
  | 'move'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | null

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function getCursorForDragMode(mode: DragMode): string {
  switch (mode) {
    case 'left':
    case 'right':
      return 'ew-resize'
    case 'top':
    case 'bottom':
      return 'ns-resize'
    case 'top-left':
    case 'bottom-right':
      return 'nwse-resize'
    case 'top-right':
    case 'bottom-left':
      return 'nesw-resize'
    case 'move':
      return 'grab'
    default:
      return 'crosshair'
  }
}

export function AmbientRangeEditor() {
  const { t } = useTranslation(['settings'])
  const config = useAppStore((s) => s.ambientReactivity)
  const setConfig = useAppStore((s) => s.setAmbientReactivity)
  const activeBackend = usePlaybackStore((s) => s.activeBackend)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const configRef = useRef(config)
  const [cursor, setCursor] = useState('default')

  const dragRef = useRef<{
    mode: DragMode
    startX: number
    startY: number
    initial: typeof config
  } | null>(null)

  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let rafId = 0
    let envelope = 0
    let lastTs = performance.now()

    const draw = (now: number) => {
      rafId = requestAnimationFrame(draw)
      const dt = Math.min(0.1, (now - lastTs) / 1000)
      lastTs = now

      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (width === 0 || height === 0) return

      const dpr = window.devicePixelRatio || 1
      const pw = Math.round(width * dpr)
      const ph = Math.round(height * dpr)
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw
        canvas.height = ph
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }

      const cfg = configRef.current
      const maxAmp = cfg.spectrumCeiling ?? 1.5
      const meterWidth = 34
      const gap = 12
      const specWidth = Math.max(80, width - meterWidth - gap)

      ctx.clearRect(0, 0, width, height)

      // Background
      ctx.fillStyle = 'rgba(10, 9, 12, 0.85)'
      ctx.fillRect(0, 0, specWidth, height)
      ctx.fillRect(specWidth + gap, 0, meterWidth, height)

      // Horizontal reference grid lines (0.25..maxAmp, with 1.0 as spectrum ceiling)
      ctx.lineWidth = 1
      for (let level = 0.25; level < maxAmp; level += 0.25) {
        const gy = Math.round((1 - level / maxAmp) * height) + 0.5
        ctx.strokeStyle =
          Math.abs(level - 1.0) < 0.001
            ? 'rgba(255, 255, 255, 0.16)'
            : 'rgba(255, 255, 255, 0.07)'
        ctx.beginPath()
        ctx.moveTo(0, gy)
        ctx.lineTo(specWidth, gy)
        ctx.moveTo(specWidth + gap, gy)
        ctx.lineTo(width, gy)
        ctx.stroke()
      }

      const spectrum =
        typeof window !== 'undefined' && 'playback' in window
          ? window.playback.getSpectrum()
          : null

      // Draw 64 spectrum bars (0..1 mapped within 0..maxAmp so headroom remains above)
      if (spectrum && spectrum.length > 0) {
        const barW = specWidth / spectrum.length
        ctx.fillStyle = cfg.enabled
          ? 'rgba(255, 167, 167, 0.48)'
          : 'rgba(255, 255, 255, 0.18)'
        for (let i = 0; i < spectrum.length; i++) {
          const val = spectrum[i]
          const bh = Math.max(1, (val / maxAmp) * height)
          ctx.fillRect(
            i * barW,
            height - bh,
            Math.max(1, barW - 1),
            bh,
          )
        }
      }

      // Compute range output + envelope
      const rawOut =
        spectrum && spectrum.length > 0 && cfg.enabled
          ? evaluateSpectrumRange(spectrum, cfg)
          : 0
      const stepped = stepAmbientExposure(envelope, rawOut, dt, cfg)
      envelope = stepped.envelope

      // Draw Output Meter on the right
      const meterX = specWidth + gap
      if (cfg.enabled) {
        const envH = envelope * height
        ctx.fillStyle = 'rgba(84, 230, 194, 0.28)'
        ctx.fillRect(meterX, height - envH, meterWidth, envH)

        const rawH = rawOut * height
        ctx.fillStyle = 'rgba(84, 230, 194, 0.85)'
        ctx.fillRect(meterX, height - rawH, meterWidth, rawH)
      }

      // Draw interactive Sound Keys Range Box
      const boxX1 = cfg.freqStart * specWidth
      const boxX2 = cfg.freqEnd * specWidth
      const boxY1 = (1 - cfg.ampCeiling / maxAmp) * height
      const boxY2 = (1 - cfg.ampFloor / maxAmp) * height
      const boxW = Math.max(6, boxX2 - boxX1)
      const boxH = Math.max(6, boxY2 - boxY1)

      ctx.fillStyle = cfg.enabled
        ? 'rgba(84, 230, 194, 0.12)'
        : 'rgba(255, 255, 255, 0.04)'
      ctx.fillRect(boxX1, boxY1, boxW, boxH)

      ctx.strokeStyle = cfg.enabled ? '#54e6c2' : 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(boxX1 + 0.5, boxY1 + 0.5, boxW - 1, boxH - 1)

      // Corner handles
      ctx.fillStyle = cfg.enabled ? '#54e6c2' : 'rgba(255, 255, 255, 0.35)'
      const hs = 5
      for (const [cx, cy] of [
        [boxX1, boxY1],
        [boxX2, boxY1],
        [boxX1, boxY2],
        [boxX2, boxY2],
      ]) {
        ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs)
      }
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [])

  const hitTest = (clientX: number, clientY: number): DragMode => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const specWidth = Math.max(80, rect.width - 46)
    const x = clientX - rect.left
    const y = clientY - rect.top
    if (x < 0 || x > specWidth || y < 0 || y > rect.height) return null

    const cfg = configRef.current
    const maxAmp = cfg.spectrumCeiling ?? 1.5
    const x1 = cfg.freqStart * specWidth
    const x2 = cfg.freqEnd * specWidth
    const y1 = (1 - cfg.ampCeiling / maxAmp) * rect.height
    const y2 = (1 - cfg.ampFloor / maxAmp) * rect.height
    const edge = 8

    const nearL = Math.abs(x - x1) <= edge
    const nearR = Math.abs(x - x2) <= edge
    const nearT = Math.abs(y - y1) <= edge
    const nearB = Math.abs(y - y2) <= edge
    const inX = x >= x1 - edge && x <= x2 + edge
    const inY = y >= y1 - edge && y <= y2 + edge

    if (nearL && nearT) return 'top-left'
    if (nearR && nearT) return 'top-right'
    if (nearL && nearB) return 'bottom-left'
    if (nearR && nearB) return 'bottom-right'
    if (nearL && inY) return 'left'
    if (nearR && inY) return 'right'
    if (nearT && inX) return 'top'
    if (nearB && inX) return 'bottom'
    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return 'move'
    return null
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const mode = hitTest(e.clientX, e.clientY)
    if (!mode) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      initial: { ...configRef.current },
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const specWidth = Math.max(80, rect.width - 46)

    if (!dragRef.current) {
      setCursor(getCursorForDragMode(hitTest(e.clientX, e.clientY)))
      return
    }

    const { mode, startX, startY, initial } = dragRef.current
    const maxAmp = initial.spectrumCeiling ?? 1.5
    const dx = (e.clientX - startX) / specWidth
    const dy = ((e.clientY - startY) / rect.height) * maxAmp // positive = down = lower amplitude

    let { freqStart, freqEnd, ampFloor, ampCeiling } = initial
    const minW = 0.05
    const minH = 0.1

    if (mode === 'move') {
      const w = freqEnd - freqStart
      const h = ampCeiling - ampFloor
      freqStart = clamp(freqStart + dx, 0, 1 - w)
      freqEnd = freqStart + w
      ampFloor = clamp(ampFloor - dy, 0, maxAmp - h)
      ampCeiling = ampFloor + h
    } else {
      if (mode?.includes('left')) {
        freqStart = clamp(initial.freqStart + dx, 0, freqEnd - minW)
      }
      if (mode?.includes('right')) {
        freqEnd = clamp(initial.freqEnd + dx, freqStart + minW, 1)
      }
      if (mode?.includes('top')) {
        ampCeiling = clamp(initial.ampCeiling - dy, ampFloor + minH, maxAmp)
      }
      if (mode?.includes('bottom')) {
        ampFloor = clamp(initial.ampFloor - dy, 0, ampCeiling - minH)
      }
    }

    setConfig({ freqStart, freqEnd, ampFloor, ampCeiling })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      dragRef.current = null
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  return (
    <div className="ambient-editor">
      <div className="ambient-editor__header">
        <div>
          <h3>{t('ambient.title')}</h3>
          <p>{t('ambient.description')}</p>
        </div>
        <div className="ambient-editor__presets">
          <button
            type="button"
            className="settings-button settings-button--secondary settings-button--sm"
            onClick={() => setConfig(AMBIENT_REACTIVITY_PRESETS.lowTones)}
          >
            {t('ambient.presets.lowTones')}
          </button>
          <button
            type="button"
            className="settings-button settings-button--secondary settings-button--sm"
            onClick={() => setConfig(AMBIENT_REACTIVITY_PRESETS.subBass)}
          >
            {t('ambient.presets.subBass')}
          </button>
          <button
            type="button"
            className="settings-button settings-button--secondary settings-button--sm"
            onClick={() => setConfig(AMBIENT_REACTIVITY_PRESETS.fullBeat)}
          >
            {t('ambient.presets.fullBeat')}
          </button>
          <button
            type="button"
            className={`settings-button settings-button--sm ${config.enabled ? 'settings-button--primary' : 'settings-button--secondary'}`}
            onClick={() => setConfig({ enabled: !config.enabled })}
          >
            {config.enabled ? t('ambient.enabled') : t('ambient.disabled')}
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="ambient-editor__canvas"
        style={{ cursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      <div className="ambient-editor__meta">
        <span>
          {t('ambient.rangeSummary', {
            freqStart: Math.round(config.freqStart * 100),
            freqEnd: Math.round(config.freqEnd * 100),
            ampFloor: Math.round(config.ampFloor * 100),
            ampCeiling: Math.round(config.ampCeiling * 100),
          })}
        </span>
        {activeBackend !== 'browser' && (
          <span className="ambient-editor__notice">
            {t('ambient.browserOnlyHint')}
          </span>
        )}
      </div>

      <div className="ambient-editor__controls">
        <label className="ambient-editor__control">
          <span>{t('ambient.modeLabel')}</span>
          <select
            value={config.mode}
            onChange={(e) =>
              setConfig({ mode: e.target.value as 'average' | 'peak' })
            }
          >
            <option value="average">{t('ambient.modes.average')}</option>
            <option value="peak">{t('ambient.modes.peak')}</option>
          </select>
        </label>

        <label className="ambient-editor__control">
          <span>
            {t('ambient.ceilingLabel')} ({Math.round((config.spectrumCeiling ?? 1.5) * 100)}%)
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={config.spectrumCeiling ?? 1.5}
            onChange={(e) => setConfig({ spectrumCeiling: Number(e.target.value) })}
          />
        </label>

        <label className="ambient-editor__control">
          <span>
            {t('ambient.releaseLabel')} ({config.release.toFixed(1)})
          </span>
          <input
            type="range"
            min={1}
            max={15}
            step={0.5}
            value={config.release}
            onChange={(e) => setConfig({ release: Number(e.target.value) })}
          />
        </label>

        <label className="ambient-editor__control">
          <span>
            {t('ambient.intensityLabel')} ({config.intensity.toFixed(2)})
          </span>
          <input
            type="range"
            min={0}
            max={1.2}
            step={0.05}
            value={config.intensity}
            onChange={(e) => setConfig({ intensity: Number(e.target.value) })}
          />
        </label>
      </div>
    </div>
  )
}
