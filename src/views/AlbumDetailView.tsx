import { ArrowLeft, Disc3, Play } from 'lucide-react'
import { useAlbum, useArtwork, useFormatDuration, useTracks } from '../hooks/useLibrary'
import { useAppStore, usePlaybackStore } from '../store'
import { TracksTable } from './TracksView'
import '../styles/library.css'

export function AlbumDetailView() {
  const albumId = useAppStore((s) => s.nav.albumId)
  const { navigate } = useAppStore()
  const { album, loading } = useAlbum(albumId)
  const { tracks } = useTracks({ albumId: albumId ?? undefined })
  const artworkSrc = useArtwork(album?.artwork_id)
  const { play } = usePlaybackStore()
  const fmt = useFormatDuration()

  if (loading) {
    return <div className="loading-state">Loading…</div>
  }

  if (!album) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Album not found</div>
      </div>
    )
  }

  const totalDuration = tracks.reduce((s, t) => s + t.duration, 0)

  return (
    <div className="page">
      {/* Hero */}
      <div className="detail-hero">
        <button
          className="sidebar__item"
          style={{ marginBottom: 'auto', alignSelf: 'flex-start' }}
          onClick={() => navigate('albums')}
        >
          <ArrowLeft size={14} />
          Albums
        </button>

        <div className="detail-artwork">
          {artworkSrc ? (
            <img src={artworkSrc} alt={album.title} />
          ) : (
            <div className="detail-artwork-placeholder">
              <Disc3 size={64} />
            </div>
          )}
        </div>

        <div className="detail-info">
          <div className="detail-kind">Album</div>
          <div className="detail-title">{album.title}</div>
          <div className="detail-meta">
            <span
              style={{ cursor: album.artist_id ? 'pointer' : 'default', color: 'var(--color-accent)' }}
              onClick={() => album.artist_id && navigate('artist-detail', { artistId: album.artist_id })}
            >
              {album.artist_name ?? 'Unknown Artist'}
            </span>
            {album.year && (
              <>
                <span className="detail-meta-dot" />
                <span>{album.year}</span>
              </>
            )}
            <span className="detail-meta-dot" />
            <span>{album.track_count} tracks</span>
            <span className="detail-meta-dot" />
            <span>{fmt(totalDuration)}</span>
          </div>

          <button
            className="detail-play-btn"
            onClick={() => tracks.length > 0 && play(tracks[0], tracks, album.title)}
          >
            <Play size={14} fill="currentColor" />
            Play
          </button>
        </div>
      </div>

      {/* Track list */}
      <div className="page-body">
        <TracksTable tracks={tracks} showAlbum={false} />
      </div>
    </div>
  )
}
