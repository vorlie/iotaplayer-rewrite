import { ArrowLeft, Mic2, Play } from 'lucide-react'
import { AlbumCard } from '../components/AlbumCard'
import { useAlbums, useArtist, useFormatDuration, useTracks } from '../hooks/useLibrary'
import { useAppStore, usePlaybackStore } from '../store'
import '../styles/library.css'

export function ArtistDetailView() {
  const artistId = useAppStore((s) => s.nav.artistId)
  const { navigate } = useAppStore()
  const { artist, loading } = useArtist(artistId)
  const { albums } = useAlbums(artistId ?? undefined)
  const { tracks } = useTracks({ artistId: artistId ?? undefined })
  const { play } = usePlaybackStore()
  const fmt = useFormatDuration()

  if (loading) {
    return <div className="loading-state">Loading…</div>
  }

  if (!artist) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Artist not found</div>
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
          onClick={() => navigate('artists')}
        >
          <ArrowLeft size={14} />
          Artists
        </button>

        <div
          className="detail-artwork"
          style={{
            background: 'var(--color-surface-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Mic2 size={64} color="var(--color-text-3)" />
        </div>

        <div className="detail-info">
          <div className="detail-kind">Artist</div>
          <div className="detail-title">{artist.name}</div>
          <div className="detail-meta">
            <span>{artist.album_count} albums</span>
            <span className="detail-meta-dot" />
            <span>{artist.track_count} tracks</span>
            <span className="detail-meta-dot" />
            <span>{fmt(totalDuration)}</span>
          </div>

          <button
            className="detail-play-btn"
            onClick={() => tracks.length > 0 && play(tracks[0], tracks, artist?.name ?? 'Artist')} 
          >
            <Play size={14} fill="currentColor" />
            Play All
          </button>
        </div>
      </div>

      {/* Albums section */}
      <div className="page-body">
        {albums.length > 0 && (
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <div className="section-header">
              <h2 className="section-title">Albums</h2>
            </div>
            <div className="albums-grid">
              {albums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  onClick={() => navigate('album-detail', { albumId: album.id })}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
