export interface MediaControlSnapshot {
  title?: string | null
  artist?: string | null
  album?: string | null
  artworkUrl?: string | null
  duration?: number
  position?: number
  isPlaying?: boolean
}

export function normalizeMediaControlSnapshot(snapshot: MediaControlSnapshot): {
  title: string
  artist: string
  album: string
  artworkUrl: string | null
  duration: number
  position: number
  isPlaying: boolean
} {
  const title = snapshot.title?.trim() || 'Unknown title'
  const artist = snapshot.artist?.trim() || 'Unknown artist'
  const album = snapshot.album?.trim() || 'Unknown album'

  const duration = typeof snapshot.duration === 'number' && Number.isFinite(snapshot.duration)
    ? snapshot.duration
    : 0

  const position = typeof snapshot.position === 'number' && Number.isFinite(snapshot.position)
    ? snapshot.position
    : 0

  return {
    title,
    artist,
    album,
    artworkUrl: snapshot.artworkUrl && snapshot.artworkUrl.trim() ? snapshot.artworkUrl.trim() : null,
    duration,
    position,
    isPlaying: Boolean(snapshot.isPlaying),
  }
}
