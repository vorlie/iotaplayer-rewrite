import { useArtists } from '../hooks/useLibrary'
import { useAppStore } from '../store'
import '../styles/library.css'

export function ArtistsView() {
  const { artists, loading } = useArtists()
  const { navigate } = useAppStore()

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">Loading artists…</div>
      </div>
    )
  }

  if (artists.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-title">No artists yet</div>
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
        <h1 className="page-title">Artists</h1>
        <p className="page-subtitle">{artists.length} artists</p>
      </div>
      <div className="page-body">
        <div className="artists-list">
          {artists.map((artist) => (
            <div
              key={artist.id}
              className="artist-row"
              onClick={() => navigate('artist-detail', { artistId: artist.id })}
            >
              <div className="artist-avatar">
                {artist.name.charAt(0).toUpperCase()}
              </div>
              <div className="artist-info">
                <div className="artist-name">{artist.name}</div>
                <div className="artist-meta">
                  {artist.album_count} {artist.album_count === 1 ? 'album' : 'albums'} ·{' '}
                  {artist.track_count} {artist.track_count === 1 ? 'track' : 'tracks'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
