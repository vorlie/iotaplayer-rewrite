import { useFormatDuration, useTracks } from '../hooks/useLibrary'
import { useAppStore, usePlaybackStore } from '../store'
import type { Track } from '../types/electron'
import '../styles/library.css'

interface TrackRowProps {
  track: Track
  index: number
  showAlbum?: boolean
  showArtwork?: boolean
  isPlaying?: boolean
  onClick: () => void
}

function TrackRow({ track, index, showAlbum = true, isPlaying = false, onClick }: TrackRowProps) {
  const fmt = useFormatDuration()
  const navigate = useAppStore((s) => s.navigate)

  return (
    <div
      className={`track-row ${isPlaying ? 'playing' : ''}`}
      onDoubleClick={onClick}
    >
      <div className={`track-num ${isPlaying ? 'track-num--playing' : ''}`}>
        {isPlaying ? '▶' : (track.track_number ?? index + 1)}
      </div>

      <div className="track-info">
        <div className="track-name-block">
          <div className="track-title">{track.title}</div>
          <div
            className="track-artist-small"
            onClick={(e) => {
              e.stopPropagation()
              if (track.artist_id) navigate('artist-detail', { artistId: track.artist_id })
            }}
            style={{ cursor: track.artist_id ? 'pointer' : 'default' }}
          >
            {track.artist ?? track.album_artist ?? '—'}
          </div>
        </div>
      </div>

      {showAlbum && (
        <div className="track-album">{track.album ?? '—'}</div>
      )}

      <div className="track-year">{track.year ?? '—'}</div>
      <div className="track-duration">{fmt(track.duration)}</div>
    </div>
  )
}

interface TracksTableProps {
  tracks: Track[]
  showAlbum?: boolean
}

export function TracksTable({ tracks, showAlbum = true }: TracksTableProps) {
  const { play } = usePlaybackStore()
  const { currentTrack, isPlaying } = usePlaybackStore()

  return (
    <div className="tracks-table">
      <div className="tracks-header">
        <span>#</span>
        <span>Title</span>
        {showAlbum && <span>Album</span>}
        <span>Year</span>
        <span style={{ textAlign: 'right' }}>Time</span>
      </div>
      {tracks.map((track, i) => (
        <TrackRow
          key={track.id}
          track={track}
          index={i}
          showAlbum={showAlbum}
          isPlaying={currentTrack?.id === track.id && isPlaying}
          onClick={() => play(track, tracks)}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Full tracks view page
// ---------------------------------------------------------------------------

export function TracksView() {
  const { tracks, loading } = useTracks({ limit: 1000 })
  const fmt = useFormatDuration()

  const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0)

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">Loading tracks…</div>
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-title">No tracks yet</div>
          <div className="empty-state-body">
            Go to Settings and scan your music library to get started.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Tracks</h1>
        <p className="page-subtitle">
          {tracks.length} tracks · {fmt(totalDuration)}
        </p>
      </div>
      <div className="page-body">
        <TracksTable tracks={tracks} showAlbum />
      </div>
    </div>
  )
}
