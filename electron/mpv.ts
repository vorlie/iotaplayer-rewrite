import { ChildProcess, spawn } from 'child_process'
import net from 'net'
import path from 'path'
import type { PlaybackStateEvent } from './types'

export class MpvController {
  private process: ChildProcess | null = null
  private socket: net.Socket | null = null
  private pipePath: string
  private buffer = ''
  private isConnected = false
  private isDestroyed = false
  private isPlaying = false
  private currentVolume = 0.8

  private onStateChangeCb?: (state: PlaybackStateEvent) => void
  private onTrackEndedCb?: () => void

  constructor() {
    this.pipePath =
      process.platform === 'win32'
        ? `\\\\.\\pipe\\iotaplayer-mpv-${process.pid}`
        : path.join('/tmp', `iotaplayer-mpv-${process.pid}.sock`)
  }

  public setCallbacks(
    onStateChange: (state: PlaybackStateEvent) => void,
    onTrackEnded: () => void,
  ): void {
    this.onStateChangeCb = onStateChange
    this.onTrackEndedCb = onTrackEnded
  }

  public init(): Promise<void> {
    return new Promise((resolve) => {
      this.spawnProcess()
      this.connectSocket(resolve)
    })
  }

  private spawnProcess(): void {
    const args = [
      '--idle=yes',
      '--no-video',
      '--no-terminal',
      `--input-ipc-server=${this.pipePath}`,
      '--keep-open=yes',
      '--gapless-audio=yes',
      `--volume=${Math.round(this.currentVolume * 100)}`,
    ]

    try {
      this.process = spawn('mpv', args, {
        windowsHide: true,
        stdio: 'ignore',
      })

      this.process.on('error', (err) => {
        console.error('[MPV] Process error:', err.message)
      })

      this.process.on('exit', (code, signal) => {
        console.log(`[MPV] Process exited with code ${code}, signal ${signal}`)
        this.process = null
        this.isConnected = false
      })
    } catch (err) {
      console.error('[MPV] Failed to spawn mpv process:', err)
    }
  }

  private connectSocket(onReady?: () => void, retryCount = 0): void {
    if (this.isDestroyed) return

    const socket = net.connect(this.pipePath, () => {
      console.log('[MPV] Connected to IPC socket')
      this.socket = socket
      this.isConnected = true
      this.setupObservers()
      onReady?.()
    })

    socket.on('data', (data) => {
      this.handleSocketData(data)
    })

    socket.on('error', () => {
      if (!this.isConnected && retryCount < 30) {
        setTimeout(() => this.connectSocket(onReady, retryCount + 1), 100)
      }
    })

    socket.on('close', () => {
      this.isConnected = false
      this.socket = null
    })
  }

  private sendCommand(command: (string | number | boolean)[]): void {
    if (!this.socket || !this.isConnected) {
      return
    }

    const payload = JSON.stringify({ command }) + '\n'
    this.socket.write(payload)
  }

  private setupObservers(): void {
    // Observe core playback properties
    this.sendCommand(['observe_property', 1, 'time-pos'])
    this.sendCommand(['observe_property', 2, 'duration'])
    this.sendCommand(['observe_property', 3, 'pause'])
    this.sendCommand(['observe_property', 4, 'volume'])
  }

  private handleSocketData(chunk: Buffer): void {
    this.buffer += chunk.toString('utf8')
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const msg = JSON.parse(trimmed)
        this.handleMpvMessage(msg)
      } catch {
        // incomplete json
      }
    }
  }

  private handleMpvMessage(msg: {
    event?: string
    name?: string
    data?: unknown
    reason?: string
  }): void {
    if (msg.event === 'property-change') {
      if (msg.name === 'time-pos') {
        const pos = typeof msg.data === 'number' ? msg.data : 0
        this.onStateChangeCb?.({ position: pos })
      } else if (msg.name === 'duration') {
        const dur = typeof msg.data === 'number' ? msg.data : 0
        this.onStateChangeCb?.({ duration: dur })
      } else if (msg.name === 'pause') {
        const isPaused = Boolean(msg.data)
        this.isPlaying = !isPaused
        this.onStateChangeCb?.({ isPlaying: this.isPlaying })
      } else if (msg.name === 'volume') {
        const vol = typeof msg.data === 'number' ? msg.data / 100 : 0.8
        this.currentVolume = vol
        this.onStateChangeCb?.({ volume: vol })
      }
    } else if (msg.event === 'end-file') {
      // eof = track reached end naturally
      if (msg.reason === 'eof') {
        console.log('[MPV] Track finished (EOF)')
        this.isPlaying = false
        this.onStateChangeCb?.({ isPlaying: false })
        this.onTrackEndedCb?.()
      }
    }
  }

  public async play(filePath: string): Promise<void> {
    if (!this.isConnected) {
      await this.init()
    }
    console.log(`[MPV] Playing file: ${filePath}`)
    this.sendCommand(['loadfile', filePath, 'replace'])
    this.sendCommand(['set_property', 'pause', false])
    this.isPlaying = true
    this.onStateChangeCb?.({ isPlaying: true })
  }

  public pause(): void {
    this.sendCommand(['set_property', 'pause', true])
    this.isPlaying = false
    this.onStateChangeCb?.({ isPlaying: false })
  }

  public resume(): void {
    this.sendCommand(['set_property', 'pause', false])
    this.isPlaying = true
    this.onStateChangeCb?.({ isPlaying: true })
  }

  public toggle(): void {
    if (this.isPlaying) {
      this.pause()
    } else {
      this.resume()
    }
  }

  public seek(positionSeconds: number): void {
    this.sendCommand(['seek', Math.max(0, positionSeconds), 'absolute'])
    this.onStateChangeCb?.({ position: Math.max(0, positionSeconds) })
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol))
    this.currentVolume = clamped
    this.sendCommand(['set_property', 'volume', Math.round(clamped * 100)])
    this.onStateChangeCb?.({ volume: clamped })
  }

  public stop(): void {
    this.sendCommand(['stop'])
    this.isPlaying = false
    this.onStateChangeCb?.({ isPlaying: false, position: 0 })
  }

  public destroy(): void {
    this.isDestroyed = true

    try {
      if (this.isConnected && this.socket) {
        this.sendCommand(['stop'])
        this.sendCommand(['quit'])
      }

      setTimeout(() => {
        try {
          if (this.socket) {
            this.socket.destroy()
            this.socket = null
          }
          if (this.process && !this.process.killed) {
            this.process.kill()
            this.process = null
          }
        } catch (err) {
          console.error('[MPV] Error destroying mpv:', err)
        }
      }, 150)
    } catch (err) {
      console.error('[MPV] Error destroying mpv:', err)
    }
  }
}

// Global singleton instance
let mpvInstance: MpvController | null = null

export function getMpv(): MpvController {
  if (!mpvInstance) {
    mpvInstance = new MpvController()
  }
  return mpvInstance
}
