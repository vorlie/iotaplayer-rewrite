import { useEffect, useRef } from 'react'

interface BrowserSpectrumProps {
  className?: string
  barColor?: string
}

export function BrowserSpectrum({
  className,
  barColor,
}: BrowserSpectrumProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')

    if (!canvas || !ctx) return

    let animationFrame = 0
    const gap = 2
    const color = barColor ?? getComputedStyle(canvas).color

    function draw() {
      animationFrame = requestAnimationFrame(draw)

      const width = canvas.clientWidth
      const height = canvas.clientHeight

      if (width === 0 || height === 0) return

      const dpr = window.devicePixelRatio || 1
      const pixelWidth = Math.round(width * dpr)
      const pixelHeight = Math.round(height * dpr)

      if (
        canvas.width !== pixelWidth ||
        canvas.height !== pixelHeight
      ) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      }

      ctx!.clearRect(0, 0, width, height)

      const spectrum = window.playback.getSpectrum()

      // No browser playback? Leave the canvas empty.
      if (!spectrum) return

      const barWidth = Math.max(
        0,
        (width - gap * (spectrum.length - 1)) / spectrum.length,
      )

      ctx!.fillStyle = color

      spectrum.forEach((value, index) => {
        const barHeight = Math.max(2, value * height)
        const x = index * (barWidth + gap)
        const y = height - barHeight

        ctx!.fillRect(x, y, barWidth, barHeight)
      })
    }

    draw()

    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [barColor])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label="Audio spectrum visualizer"
      role="img"
    />
  )
}