import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store'

type RgbTuple = [number, number, number]
type LabTuple = [number, number, number]

// Calm default deep-navy / teal / rose palette in sRGB (converted to OKLab for the shader)
const DEFAULT_RGB_PALETTE: [RgbTuple, RgbTuple, RgbTuple, RgbTuple, RgbTuple] = [
  [0.10, 0.24, 0.46],
  [0.14, 0.42, 0.44],
  [0.24, 0.34, 0.58],
  [0.16, 0.30, 0.48],
  [0.32, 0.26, 0.46],
]

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function rgbToOklab([rIn, gIn, bIn]: RgbTuple): LabTuple {
  const r = srgbToLinear(rIn)
  const g = srgbToLinear(gIn)
  const b = srgbToLinear(bIn)

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ]
}

const DEFAULT_LAB_PALETTE: [LabTuple, LabTuple, LabTuple, LabTuple, LabTuple] = [
  rgbToOklab(DEFAULT_RGB_PALETTE[0]),
  rgbToOklab(DEFAULT_RGB_PALETTE[1]),
  rgbToOklab(DEFAULT_RGB_PALETTE[2]),
  rgbToOklab(DEFAULT_RGB_PALETTE[3]),
  rgbToOklab(DEFAULT_RGB_PALETTE[4]),
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
uniform float u_kick;
uniform vec3 u_bg;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

vec3 m289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 m289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 perm(vec3 x) { return m289(((x * 34.0) + 1.0) * x); }

float sn(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = m289(i);
  vec3 p = perm(perm(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec3 oklabToSrgb(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.291485548 * c.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  vec3 v = clamp(
    vec3(
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ),
    0.0,
    1.0
  );
  return mix(v * 12.92, 1.055 * pow(v, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, v));
}

float blobWeight(vec2 p, vec2 c, float r, float w) {
  vec2 d = p - c;
  return w * exp(-dot(d, d) / (r * r));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / max(u_res.y, 1.0);
  vec2 st = vec2(uv.x, 1.0 - uv.y);
  vec2 p = vec2(st.x * asp, st.y);

  float t = u_time;

  // Flow: space bent along a slow, tilted current
  const mat2 R = mat2(0.906, -0.423, 0.423, 0.906);
  vec2 q = (R * p) * vec2(0.55, 1.5);
  vec2 w = vec2(sn(q + vec2(t * 0.05, 0.0)), sn(q + vec2(3.1, 7.7) - vec2(0.0, t * 0.04)));
  vec2 w2 = vec2(sn(q * 2.0 + w * 1.6 + 11.0), sn(q * 2.0 + w * 1.6 + 23.0));
  p += 0.22 * (w + 0.4 * w2);

  float e = u_energy + u_kick * 0.35;
  vec3 acc = u_bg;
  float W = 1.0;
  float rs = clamp(sqrt(asp / 1.4), 0.5, 1.0);

  vec2 c0 = vec2(0.22 * asp, 0.28) + 0.06 * vec2(sin(t * 0.21), cos(t * 0.17));
  vec2 c1 = vec2(0.78 * asp, 0.24) + 0.06 * vec2(sin(t * 0.26 + 1.7), cos(t * 0.21 + 2.9));
  vec2 c2 = vec2(0.50 * asp, 0.52) + 0.06 * vec2(sin(t * 0.31 + 3.4), cos(t * 0.25 + 5.8));
  vec2 c3 = vec2(0.18 * asp, 0.78) + 0.06 * vec2(sin(t * 0.36 + 5.1), cos(t * 0.29 + 8.7));
  vec2 c4 = vec2(0.82 * asp, 0.76) + 0.06 * vec2(sin(t * 0.41 + 6.8), cos(t * 0.33 + 11.6));

  float k0 = blobWeight(p, c0, 0.58 * rs * (1.0 + e * 0.08), 1.6 * (1.0 + e * 0.25));
  float k1 = blobWeight(p, c1, 0.56 * rs * (1.0 + e * 0.08), 1.5 * (1.0 + e * 0.25));
  float k2 = blobWeight(p, c2, 0.62 * rs * (1.0 + e * 0.08), 1.3 * (1.0 + e * 0.25));
  float k3 = blobWeight(p, c3, 0.58 * rs * (1.0 + e * 0.08), 1.4 * (1.0 + e * 0.25));
  float k4 = blobWeight(p, c4, 0.56 * rs * (1.0 + e * 0.08), 1.3 * (1.0 + e * 0.25));

  acc += k0 * u_c0 + k1 * u_c1 + k2 * u_c2 + k3 * u_c3 + k4 * u_c4;
  W += k0 + k1 + k2 + k3 + k4;

  vec3 lab = acc / W;
  float cov = 1.0 - 1.0 / W;

  // Sheen: long, soft silk folds of light where the colour is, swelling on bass/kick hits
  float fold = sn((R * p) * vec2(0.8, 3.2) + w * 0.9 + vec2(t * 0.03, 0.0)) * 0.5 + 0.5;
  float fold3 = fold * fold * fold;
  float fold4 = fold3 * fold;
  lab.x += ((0.14 + u_kick * 0.22) * fold3 + 0.12 * u_kick * fold4 + e * 0.02) * cov;
  lab.x = min(lab.x, 0.64);

  vec3 col = oklabToSrgb(mix(u_bg, lab, 0.92));

  // Soft vignette & static 1/255 dither against banding
  float vig = smoothstep(1.3, 0.2, length((uv - 0.5) * vec2(asp * 0.85, 1.0)));
  col *= mix(0.68, 1.0, vig);
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

function extractArtworkLabPalette(
  src: string,
): Promise<[LabTuple, LabTuple, LabTuple, LabTuple, LabTuple]> {
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
          resolve(DEFAULT_LAB_PALETTE)
          return
        }
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)

        const buckets: Array<{ rgb: RgbTuple; sat: number }> = []
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i] / 255
          const g = data[i + 1] / 255
          const b = data[i + 2] / 255
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          const sat = max > 0 ? (max - min) / max : 0
          const lum = 0.299 * r + 0.587 * g + 0.114 * b
          if (lum > 0.07 && lum < 0.90) {
            buckets.push({ rgb: [r, g, b], sat })
          }
        }

        if (buckets.length < 5) {
          resolve(DEFAULT_LAB_PALETTE)
          return
        }

        buckets.sort((a, b) => b.sat - a.sat)
        const pickLab = (idx: number): LabTuple => {
          const item = buckets[Math.min(idx, buckets.length - 1)]
          const lab = rgbToOklab(item.rgb)
          // Keep lightness calm and rich so white text remains crisp
          return [Math.min(0.58, Math.max(0.24, lab[0])), lab[1], lab[2]]
        }

        const step = Math.max(1, Math.floor(buckets.length / 5))
        resolve([
          pickLab(0),
          pickLab(step),
          pickLab(step * 2),
          pickLab(step * 3),
          pickLab(step * 4),
        ])
      } catch {
        resolve(DEFAULT_LAB_PALETTE)
      }
    }
    img.onerror = () => resolve(DEFAULT_LAB_PALETTE)
    img.src = src
  })
}

let cachedGrainTile: { url: string; sizePx: number } | null = null

function getGrainTile(): { url: string; sizePx: number } | null {
  if (cachedGrainTile) return cachedGrainTile
  if (typeof document === 'undefined') return null

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const img = ctx.createImageData(size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    // Triangular distribution (two uniforms summed) for film-like grain
    const v = (Math.random() + Math.random()) * 127.5
    d[i] = v
    d[i + 1] = v
    d[i + 2] = v
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  cachedGrainTile = {
    url: canvas.toDataURL('image/png'),
    sizePx: size / dpr,
  }
  return cachedGrainTile
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
  const lowPerformanceMode = useAppStore((s) => s.lowPerformanceMode)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [grainTile] = useState(() => getGrainTile())
  const targetPaletteRef = useRef<[LabTuple, LabTuple, LabTuple, LabTuple, LabTuple]>(DEFAULT_LAB_PALETTE)
  const currentPaletteRef = useRef<[LabTuple, LabTuple, LabTuple, LabTuple, LabTuple]>([
    [...DEFAULT_LAB_PALETTE[0]],
    [...DEFAULT_LAB_PALETTE[1]],
    [...DEFAULT_LAB_PALETTE[2]],
    [...DEFAULT_LAB_PALETTE[3]],
    [...DEFAULT_LAB_PALETTE[4]],
  ])
  const isPlayingRef = useRef(isPlaying)
  const [webglUnsupported, setWebglUnsupported] = useState(false)

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    let cancelled = false
    if (!artworkSrc) {
      targetPaletteRef.current = DEFAULT_LAB_PALETTE
      return
    }

    void extractArtworkLabPalette(artworkSrc).then((palette) => {
      if (!cancelled) {
        targetPaletteRef.current = palette
      }
    })

    return () => {
      cancelled = true
    }
  }, [artworkSrc])

  useEffect(() => {
    if (!active || lowPerformanceMode) return
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
    const uKick = gl.getUniformLocation(program, 'u_kick')
    const uBg = gl.getUniformLocation(program, 'u_bg')
    const uC0 = gl.getUniformLocation(program, 'u_c0')
    const uC1 = gl.getUniformLocation(program, 'u_c1')
    const uC2 = gl.getUniformLocation(program, 'u_c2')
    const uC3 = gl.getUniformLocation(program, 'u_c3')
    const uC4 = gl.getUniformLocation(program, 'u_c4')

    const bgLab = rgbToOklab([0.03, 0.04, 0.065])

    canvas.width = 256
    canvas.height = 144
    gl.viewport(0, 0, canvas.width, canvas.height)

    let rafId = 0
    let lastTs = performance.now()
    let elapsed = 0
    let energy = isPlayingRef.current ? 0.45 : 0.1
    let bassAvg = 0
    let kick = 0

    const render = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000)
      lastTs = now
      elapsed += dt * (isPlayingRef.current ? 1 : 0.3)
      energy += ((isPlayingRef.current ? 0.45 : 0.1) - energy) * 0.05

      const spectrum =
        isPlayingRef.current && typeof window !== 'undefined' && 'playback' in window
          ? window.playback.getSpectrum()
          : null

      if (spectrum && spectrum.length >= 6) {
        const bass =
          (spectrum[0] + spectrum[1] + spectrum[2] + spectrum[3] + spectrum[4] + spectrum[5]) / 6
        bassAvg += (bass - bassAvg) * Math.min(1, dt * 4.0)
        const transient = Math.max(0, bass - bassAvg * 1.12)
        const targetKick = Math.min(1, transient * 4.5 + Math.max(0, bass - 0.55) * 0.7)
        if (targetKick > kick) {
          kick += (targetKick - kick) * Math.min(1, dt * 28.0)
        } else {
          kick *= Math.exp(-dt * 7.5)
        }
      } else {
        bassAvg *= Math.exp(-dt * 4.0)
        kick *= Math.exp(-dt * 6.0)
      }

      const curr = currentPaletteRef.current
      const target = targetPaletteRef.current
      for (let i = 0; i < 5; i++) {
        for (let ch = 0; ch < 3; ch++) {
          curr[i][ch] += (target[i][ch] - curr[i][ch]) * 0.04
        }
      }

      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, elapsed)
      gl.uniform1f(uEnergy, energy)
      gl.uniform1f(uKick, kick)
      gl.uniform3fv(uBg, bgLab)
      gl.uniform3fv(uC0, curr[0])
      gl.uniform3fv(uC1, curr[1])
      gl.uniform3fv(uC2, curr[2])
      gl.uniform3fv(uC3, curr[3])
      gl.uniform3fv(uC4, curr[4])

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
  }, [active, lowPerformanceMode])

  return (
    <div className="still-bg" aria-hidden="true">
      {!webglUnsupported && !lowPerformanceMode ? (
        <canvas ref={canvasRef} className="still-bg__canvas" />
      ) : (
        <div className="still-bg__fallback" />
      )}
      <div className="still-bg__scrim" />
      {!lowPerformanceMode && grainTile && (
        <div
          className="still-grain"
          style={{
            backgroundImage: `url(${grainTile.url})`,
            backgroundSize: `${grainTile.sizePx}px`,
          }}
        />
      )}
    </div>
  )
}
