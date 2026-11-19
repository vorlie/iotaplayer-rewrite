import { useEffect, useRef, useState } from 'react'

type RgbTuple = [number, number, number]

const DEFAULT_PALETTE: [RgbTuple, RgbTuple, RgbTuple, RgbTuple] = [
  [0.14, 0.12, 0.24],
  [0.36, 0.22, 0.34],
  [0.24, 0.32, 0.48],
  [0.52, 0.30, 0.36],
]

const VERT_SRC = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const FRAG_SRC = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_energy;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

float blob(vec2 p, vec2 c, float r) {
  vec2 d = p - c;
  return exp(-dot(d, d) / (r * r));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / max(u_res.y, 1.0);
  vec2 p = vec2((uv.x - 0.5) * asp, uv.y - 0.5);

  float t = u_time * 0.14;
  vec2 c0 = vec2(sin(t * 0.9) * 0.42, cos(t * 0.7) * 0.30);
  vec2 c1 = vec2(cos(t * 0.6 + 1.8) * 0.48, sin(t * 0.8 + 0.9) * 0.34);
  vec2 c2 = vec2(sin(t * 0.5 + 3.4) * 0.38, cos(t * 0.9 + 2.4) * 0.28);
  vec2 c3 = vec2(cos(t * 0.7 + 4.7) * 0.44, sin(t * 0.5 + 3.7) * 0.32);

  float b0 = blob(p, c0, 0.62);
  float b1 = blob(p, c1, 0.58);
  float b2 = blob(p, c2, 0.66);
  float b3 = blob(p, c3, 0.54);

  vec3 base = vec3(0.035, 0.035, 0.055);
  vec3 col = base;
  col += u_c0 * b0 * (0.58 + u_energy * 0.14);
  col += u_c1 * b1 * (0.52 + u_energy * 0.12);
  col += u_c2 * b2 * (0.48 + u_energy * 0.12);
  col += u_c3 * b3 * (0.44 + u_energy * 0.10);

  // Subtle vignette
  float vig = smoothstep(1.25, 0.25, length(p));
  col *= mix(0.68, 1.0, vig);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

function extractArtworkPalette(
  src: string,
): Promise<[RgbTuple, RgbTuple, RgbTuple, RgbTuple]> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const size = 24
        const offscreen = document.createElement('canvas')
        offscreen.width = size
        offscreen.height = size
        const ctx = offscreen.getContext('2d')
        if (!ctx) {
          resolve(DEFAULT_PALETTE)
          return
        }
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)

        const buckets: Array<{ r: number; g: number; b: number; sat: number }> = []
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i] / 255
          const g = data[i + 1] / 255
          const b = data[i + 2] / 255
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          const sat = max > 0 ? (max - min) / max : 0
          const lum = 0.299 * r + 0.587 * g + 0.114 * b
          if (lum > 0.08 && lum < 0.92) {
            buckets.push({ r, g, b, sat })
          }
        }

        if (buckets.length < 4) {
          resolve(DEFAULT_PALETTE)
          return
        }

        buckets.sort((a, b) => b.sat - a.sat)
        const pick = (idx: number): RgbTuple => {
          const item = buckets[Math.min(idx, buckets.length - 1)]
          return [item.r, item.g, item.b]
        }

        const step = Math.max(1, Math.floor(buckets.length / 4))
        resolve([pick(0), pick(step), pick(step * 2), pick(step * 3)])
      } catch {
        resolve(DEFAULT_PALETTE)
      }
    }
    img.onerror = () => resolve(DEFAULT_PALETTE)
    img.src = src
  })
}

interface StillAmbientCanvasProps {
  artworkSrc: string | null
  active: boolean
  isPlaying: boolean
}

export function StillAmbientCanvas({
  artworkSrc,
  active,
  isPlaying,
}: StillAmbientCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const targetPaletteRef = useRef<[RgbTuple, RgbTuple, RgbTuple, RgbTuple]>(DEFAULT_PALETTE)
  const currentPaletteRef = useRef<[RgbTuple, RgbTuple, RgbTuple, RgbTuple]>([
    [...DEFAULT_PALETTE[0]],
    [...DEFAULT_PALETTE[1]],
    [...DEFAULT_PALETTE[2]],
    [...DEFAULT_PALETTE[3]],
  ])
  const isPlayingRef = useRef(isPlaying)
  const [webglUnsupported, setWebglUnsupported] = useState(false)

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    let cancelled = false
    if (!artworkSrc) {
      targetPaletteRef.current = DEFAULT_PALETTE
      return
    }

    void extractArtworkPalette(artworkSrc).then((palette) => {
      if (!cancelled) {
        targetPaletteRef.current = palette
      }
    })

    return () => {
      cancelled = true
    }
  }, [artworkSrc])

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    })

    if (!gl) {
      queueMicrotask(() => setWebglUnsupported(true))
      return
    }

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vert = compileShader(gl.VERTEX_SHADER, VERT_SRC)
    const frag = compileShader(gl.FRAGMENT_SHADER, FRAG_SRC)
    if (!vert || !frag) {
      queueMicrotask(() => setWebglUnsupported(true))
      return
    }

    const program = gl.createProgram()
    if (!program) {
      queueMicrotask(() => setWebglUnsupported(true))
      return
    }
    gl.attachShader(program, vert)
    gl.attachShader(program, frag)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      queueMicrotask(() => setWebglUnsupported(true))
      return
    }

    gl.useProgram(program)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    )
    const posLoc = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(program, 'u_res')
    const uTime = gl.getUniformLocation(program, 'u_time')
    const uEnergy = gl.getUniformLocation(program, 'u_energy')
    const uC0 = gl.getUniformLocation(program, 'u_c0')
    const uC1 = gl.getUniformLocation(program, 'u_c1')
    const uC2 = gl.getUniformLocation(program, 'u_c2')
    const uC3 = gl.getUniformLocation(program, 'u_c3')

    canvas.width = 320
    canvas.height = 180
    gl.viewport(0, 0, canvas.width, canvas.height)

    let rafId = 0
    let lastTs = performance.now()
    let elapsed = 0
    let energy = isPlayingRef.current ? 1 : 0.2

    const render = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000)
      lastTs = now
      elapsed += dt * (isPlayingRef.current ? 1 : 0.35)
      energy += ((isPlayingRef.current ? 1 : 0.2) - energy) * 0.05

      const curr = currentPaletteRef.current
      const target = targetPaletteRef.current
      for (let i = 0; i < 4; i++) {
        for (let ch = 0; ch < 3; ch++) {
          curr[i][ch] += (target[i][ch] - curr[i][ch]) * 0.04
        }
      }

      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, elapsed)
      gl.uniform1f(uEnergy, energy)
      gl.uniform3fv(uC0, curr[0])
      gl.uniform3fv(uC1, curr[1])
      gl.uniform3fv(uC2, curr[2])
      gl.uniform3fv(uC3, curr[3])

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(rafId)
      gl.deleteBuffer(buf)
      gl.deleteProgram(program)
      gl.deleteShader(vert)
      gl.deleteShader(frag)
    }
  }, [active])

  return (
    <div className="still-bg" aria-hidden="true">
      {!webglUnsupported ? (
        <canvas ref={canvasRef} className="still-bg__canvas" />
      ) : (
        <div className="still-bg__fallback" />
      )}
      <div className="still-bg__scrim" />
      <div className="still-grain" />
    </div>
  )
}
