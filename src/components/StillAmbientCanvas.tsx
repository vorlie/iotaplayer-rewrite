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
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_energy;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

float blob(vec2 p, vec2 c, float r) {
  vec2 d = p - c;
  return exp(-dot(d, d) / (r * r));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / max(u_res.y, 1.0);
  vec2 p = vec2((uv.x - 0.5) * asp, uv.y - 0.5);

  float t = u_time * 0.22;

  // Domain-warped silk folds (inspired by Still's Flow/Field shader)
  vec2 w = vec2(
    fbm(p * 1.15 + vec2(t * 0.06, -t * 0.05)),
    fbm(p * 1.15 + vec2(5.2 - t * 0.04, 1.3 + t * 0.05))
  );
  vec2 pw = p + (w - 0.5) * 0.65;

  float foldA = fbm(pw * 1.6 + vec2(t * 0.04, -t * 0.03));
  float foldB = fbm(pw * 2.2 - vec2(t * 0.03, t * 0.04) + foldA * 0.8);
  float sheen = smoothstep(0.32, 0.78, foldB);

  vec2 c0 = vec2(sin(t * 0.14) * 0.42 * asp, sin(t * 0.11 + 1.7) * 0.24);
  vec2 c1 = vec2(sin(t * 0.12 + 2.4) * 0.44 * asp, cos(t * 0.09 + 0.6) * 0.26);
  vec2 c2 = vec2(cos(t * 0.10 + 4.1) * 0.38 * asp, sin(t * 0.13 + 3.3) * 0.24);
  vec2 c3 = vec2(cos(t * 0.08 + 1.0) * 0.32 * asp, cos(t * 0.10 + 2.2) * 0.20);

  vec3 base = vec3(0.028, 0.036, 0.058);
  vec3 col = base;
  col = mix(col, u_c3 * 0.72, blob(pw, c3, 0.78) * 0.72);
  col = mix(col, u_c2 * 0.78, blob(pw, c2, 0.56) * 0.82);
  col = mix(col, u_c1 * 0.85, blob(pw, c1, 0.52) * 0.86);
  col = mix(col, u_c0 * 0.90, blob(pw, c0, 0.56) * 0.90);

  // Soft silk-fold highlight
  vec3 sheenTint = mix(u_c0, u_c2, 0.5) * 0.42 + vec3(0.06, 0.08, 0.11);
  col += sheenTint * sheen * (0.45 + u_energy * 0.15);

  // Center vignette
  float v = smoothstep(1.30, 0.15, length((uv - 0.5) * vec2(asp * 0.85, 1.0)));
  col *= mix(0.48, 1.0, v);

  // Static dither against banding
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
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
