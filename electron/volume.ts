export const DEFAULT_VOLUME = 0.8

export function normalizeVolume(value: unknown, fallback: number = DEFAULT_VOLUME): number {
  const safeFallback =
    typeof fallback === 'number' && Number.isFinite(fallback)
      ? Math.max(0, Math.min(1, fallback))
      : DEFAULT_VOLUME

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return safeFallback
    return Math.max(0, Math.min(1, value))
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return safeFallback
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) return safeFallback
    return Math.max(0, Math.min(1, parsed))
  }

  return safeFallback
}

export function toMpvVolume(value: unknown, fallback: number = DEFAULT_VOLUME): number {
  return Math.round(normalizeVolume(value, fallback) * 100)
}

export function fromMpvVolume(mpvValue: unknown, fallback: number = DEFAULT_VOLUME): number {
  if (typeof mpvValue === 'number' && Number.isFinite(mpvValue)) {
    return normalizeVolume(mpvValue / 100, fallback)
  }
  if (typeof mpvValue === 'string' && mpvValue.trim()) {
    const parsed = Number(mpvValue.trim())
    if (Number.isFinite(parsed)) {
      return normalizeVolume(parsed / 100, fallback)
    }
  }
  return normalizeVolume(undefined, fallback)
}

export interface AudioElementVolumeTarget {
  volume: number
}

export interface VolumeControllerOptions<TAudio extends AudioElementVolumeTarget = AudioElementVolumeTarget> {
  initialVolume?: number
  loadPersistedVolume?: () => Promise<unknown> | unknown
  persistVolume?: (volume: number) => Promise<void> | void
  applyMpvVolume?: (volume: number) => Promise<void> | void
  createAudioElement?: () => TAudio
  applyElementVolume?: (element: TAudio, volume: number) => void
  onVolumeApplied?: (volume: number) => void
}

export class VolumeController<TAudio extends AudioElementVolumeTarget = AudioElementVolumeTarget> {
  private volume: number
  private hydrated = false
  private userModified = false
  private hydrationPromise: Promise<number> | null = null
  private audioElement: TAudio | null = null
  private readonly options: VolumeControllerOptions<TAudio>

  constructor(options: VolumeControllerOptions<TAudio> = {}) {
    this.options = options
    this.volume = normalizeVolume(options.initialVolume, DEFAULT_VOLUME)

    if (options.createAudioElement) {
      this.audioElement = this.createAndConfigureAudioElement()
    }
  }

  private writeElementVolume(element: TAudio, volume: number): void {
    if (this.options.applyElementVolume) {
      this.options.applyElementVolume(element, volume)
    } else {
      element.volume = volume
    }
  }

  private createAndConfigureAudioElement(): TAudio {
    if (!this.options.createAudioElement) {
      throw new Error('No createAudioElement factory configured')
    }
    const element = this.options.createAudioElement()
    this.writeElementVolume(element, this.volume)
    return element
  }

  public getVolume(): number {
    return this.volume
  }

  public isHydrated(): boolean {
    return this.hydrated
  }

  public isUserModified(): boolean {
    return this.userModified
  }

  public getAudioElement(): TAudio | null {
    if (this.audioElement) {
      this.writeElementVolume(this.audioElement, this.volume)
    }
    return this.audioElement
  }

  public setAudioElement(element: TAudio): TAudio {
    this.writeElementVolume(element, this.volume)
    this.audioElement = element
    return element
  }

  public recreateAudioElement(): TAudio {
    const element = this.createAndConfigureAudioElement()
    this.audioElement = element
    return element
  }

  public applyToAudioElement(element?: TAudio | null): number {
    const target = element ?? this.audioElement
    if (target) {
      this.writeElementVolume(target, this.volume)
    }
    return this.volume
  }

  public hydrate(persistedValue: unknown): number {
    this.hydrated = true
    if (!this.userModified && persistedValue !== undefined && persistedValue !== null) {
      this.volume = normalizeVolume(persistedValue, this.volume)
      this.applyToAudioElement()
      void this.options.applyMpvVolume?.(this.volume)
      this.options.onVolumeApplied?.(this.volume)
    }
    return this.volume
  }

  public async ensureHydrated(): Promise<number> {
    if (this.hydrated) {
      this.applyToAudioElement()
      return this.volume
    }

    if (!this.options.loadPersistedVolume) {
      this.hydrated = true
      this.applyToAudioElement()
      return this.volume
    }

    if (!this.hydrationPromise) {
      this.hydrationPromise = Promise.resolve()
        .then(() => this.options.loadPersistedVolume!())
        .then((persisted) => this.hydrate(persisted))
        .catch(() => {
          this.hydrated = true
          this.applyToAudioElement()
          return this.volume
        })
    }

    return this.hydrationPromise
  }

  public setVolume(nextVolume: unknown): number {
    const clamped = normalizeVolume(nextVolume, this.volume)
    this.userModified = true
    this.volume = clamped
    this.applyToAudioElement()
    void this.options.applyMpvVolume?.(clamped)
    void this.options.persistVolume?.(clamped)
    this.options.onVolumeApplied?.(clamped)
    return clamped
  }

  public syncFromBackend(backendVolume: unknown): number {
    const clamped = normalizeVolume(backendVolume, this.volume)
    this.volume = clamped
    this.applyToAudioElement()
    return clamped
  }

  public async prepareForPlayback(targetBackend: 'mpv' | 'browser'): Promise<number> {
    await this.ensureHydrated()
    if (targetBackend === 'browser') {
      this.applyToAudioElement()
    } else {
      await this.options.applyMpvVolume?.(this.volume)
    }
    return this.volume
  }
}
