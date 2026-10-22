import { Client } from 'discord-rpc'
import { dbGetArtwork } from './database'
import { getAppSettings, setAppSettings } from './settings'

const DEFAULT_LARGE_IMAGE_KEY = 'default_image'
const DEFAULT_SMALL_IMAGE_KEY = 'play'
const DEFAULT_PAUSED_IMAGE_KEY = 'pause'
const DEFAULT_REPEAT_IMAGE_KEY = 'repeat'
const DEFAULT_REPEAT_ONE_IMAGE_KEY = 'repeat-one'
const DEFAULT_STOP_IMAGE_KEY = 'stop'
const DEFAULT_FALLBACK_IMAGE_KEY = 'default_image'

function getDiscordClientId(): string {
  return getAppSettings().discordClientId ?? ''
}

function getImgurClientId(): string {
  return getAppSettings().imgurClientId ?? ''
}

interface DiscordActivityInput {
  details: string
  state: string
  isPlaying: boolean
  album?: string | null
  artist?: string | null
  artworkId?: number | null
  position?: number
  duration?: number
  repeatMode?: 'off' | 'all' | 'one'
}

export class DiscordPresence {
  private client: Client | null = null
  private isReady = false
  private isStarted = false
  private enabled = true
  private currentActivity: Record<string, unknown> | null = null
  private imgurUrls = new Map<number, string>()

  public isEnabled(): boolean {
    return this.enabled
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
    setAppSettings({ discordEnabled: enabled })

    if (!enabled) {
      void this.clearActivity()
      return
    }

    if (getDiscordClientId() && !this.isStarted) {
      void this.start()
    }
  }

  public async start(): Promise<void> {
    const clientId = getDiscordClientId()
    if (!clientId || !this.enabled || this.isStarted) return

    try {
      this.client = new Client({ transport: 'ipc' })
      await this.client.login({ clientId })
      this.isReady = true
      this.isStarted = true

      if (this.currentActivity) {
        await this.client.setActivity(this.currentActivity as Parameters<Client['setActivity']>[0])
      }
    } catch (error) {
      console.error('[Discord] Failed to connect:', error)
    }
  }

  public async stop(): Promise<void> {
    if (!this.client) return

    try {
      await this.client.clearActivity()
    } catch (error) {
      console.error('[Discord] Failed to clear activity:', error)
    }

    this.isReady = false
    this.isStarted = false
    this.currentActivity = null
    this.client = null
  }

  public async setActivity(activity: DiscordActivityInput): Promise<void> {
    const clientId = getDiscordClientId()
    if (!clientId || !this.enabled) return

    const now = Date.now()
    const positionMs = Math.max(0, Number(activity.position ?? 0) * 1000)
    const durationMs = Math.max(0, Number(activity.duration ?? 0) * 1000)

    const hasProgress = durationMs > 0
    const startTimestamp = hasProgress ? now - positionMs : undefined
    const endTimestamp = hasProgress && activity.isPlaying ? now + Math.max(0, durationMs - positionMs) : undefined

    const smallImageKey = activity.isPlaying
      ? activity.repeatMode === 'one'
        ? DEFAULT_REPEAT_ONE_IMAGE_KEY
        : activity.repeatMode === 'all'
          ? DEFAULT_REPEAT_IMAGE_KEY
          : DEFAULT_SMALL_IMAGE_KEY
      : DEFAULT_PAUSED_IMAGE_KEY

    const discordActivity: Record<string, unknown> = {
      details: activity.details || 'Listening in iotaPlayer',
      state: activity.state || 'Browsing the library',
      largeImageKey: DEFAULT_LARGE_IMAGE_KEY,
      largeImageText: activity.album || 'iotaPlayer',
      smallImageKey,
      smallImageText: !activity.isPlaying
        ? 'Paused'
        : activity.repeatMode === 'one'
          ? 'Repeat one'
          : activity.repeatMode === 'all'
            ? 'Repeat all'
            : 'Playing',
      buttons: [{ label: 'Open iotaPlayer', url: 'https://example.com' }],
      ...(hasProgress ? { startTimestamp, endTimestamp } : { startTimestamp: now }),
      ...(activity.isPlaying ? {} : { endTimestamp: undefined }),
    }

    const imageKey = await this.getArtworkAssetKey(activity.artworkId)
    if (imageKey) {
      discordActivity.largeImageKey = imageKey
      ;(discordActivity as Record<string, unknown>).largeImageURL = imageKey
    } else {
      discordActivity.largeImageKey = DEFAULT_FALLBACK_IMAGE_KEY
    }

    this.currentActivity = discordActivity

    if (!this.isReady || !this.client) {
      return
    }

    try {
      await this.client.setActivity(discordActivity as Parameters<Client['setActivity']>[0])
    } catch (error) {
      console.error('[Discord] Failed to update activity:', error)
    }
  }

  public async clearActivity(): Promise<void> {
    if (!this.client) return

    try {
      await this.client.setActivity({
        details: 'Idle',
        state: 'Stopped',
        largeImageKey: DEFAULT_LARGE_IMAGE_KEY,
        largeImageText: 'iotaPlayer',
        smallImageKey: DEFAULT_STOP_IMAGE_KEY,
        smallImageText: 'Stopped',
      } as Parameters<Client['setActivity']>[0])
    } catch (error) {
      console.error('[Discord] Failed to update stopped activity:', error)
    }

    try {
      await this.client.clearActivity()
    } catch (error) {
      console.error('[Discord] Failed to clear activity:', error)
    }

    this.currentActivity = null
  }

  private async getArtworkAssetKey(artworkId: number | null | undefined): Promise<string | null> {
    if (!artworkId) return null
    if (this.imgurUrls.has(artworkId)) return this.imgurUrls.get(artworkId) ?? null

    const artwork = dbGetArtwork(artworkId)
    if (!artwork) return null

    if (!getImgurClientId()) {
      return DEFAULT_FALLBACK_IMAGE_KEY
    }

    try {
      const response = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
          Authorization: `Client-ID ${getImgurClientId()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: Buffer.from(artwork.data).toString('base64'),
          type: 'base64',
          name: `artwork-${artworkId}.png`,
        }),
      })

      if (!response.ok) {
        return DEFAULT_FALLBACK_IMAGE_KEY
      }

      const payload = (await response.json()) as { data?: { link?: string } }
      const link = payload.data?.link
      if (link) {
        this.imgurUrls.set(artworkId, link)
        return link
      }
    } catch (error) {
      console.error('[Discord] Imgur upload failed:', error)
    }

    return DEFAULT_FALLBACK_IMAGE_KEY
  }
}

export const discordPresence = new DiscordPresence()
