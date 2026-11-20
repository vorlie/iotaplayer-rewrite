import { useEffect, useRef } from 'react'
import { useAppStore } from '../store'

interface BrowserSpectrumProps {
  className?: string
  barColor?: string
}

export function BrowserSpectrum({
  className,
  barColor,
}: BrowserSpectrumProps) {
  const lowPerformanceMode = useAppStore((s) => s.lowPerformanceMode)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (lowPerformanceMode) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')

    if (!canvas || !ctx) return

    const canvasEl = canvas
    const ctx2d = ctx
    let animationFrame = 0
    const gap = 2
    const color = barColor ?? getComputedStyle(canvasEl).color

    function draw() {
      animationFrame = requestAnimationFrame(draw)

      const width = canvasEl.clientWidth
      const height = canvasEl.clientHeight

      if (width === 0 || height === 0) return

      const dpr = window.devicePixelRatio || 1
      const pixelWidth = Math.round(width * dpr)
      const pixelHeight = Math.round(height * dpr)

      if (
        canvasEl.width !== pixelWidth ||
        canvasEl.height !== pixelHeight
      ) {
        canvasEl.width = pixelWidth
        canvasEl.height = pixelHeight
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
      }

      ctx2d.clearRect(0, 0, width, height)

      const spectrum = window.playback.getSpectrum()

      // No browser playback? Leave the canvas empty.
      if (!spectrum) return

      const barWidth = Math.max(
        0,
        (width - gap * (spectrum.length - 1)) / spectrum.length,
      )

      ctx2d.fillStyle = color

      spectrum.forEach((value: number, index: number) => {
        const barHeight = Math.max(2, value * height)
        const x = index * (barWidth + gap)
        const y = height - barHeight

        ctx2d.fillRect(x, y, barWidth, barHeight)
      })
    }

    draw()

    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [barColor, lowPerformanceMode])

  if (lowPerformanceMode) return null

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label="Audio spectrum visualizer"
      role="img"
    />
  )
}