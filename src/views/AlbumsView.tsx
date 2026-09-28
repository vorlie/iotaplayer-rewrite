import { AlbumCard } from '../components/AlbumCard'
import { useAlbums } from '../hooks/useLibrary'
import { useAppStore } from '../store'
import '../styles/library.css'

export function AlbumsView() {
  const { albums, loading } = useAlbums()
  const { navigate } = useAppStore()

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">Loading albums…</div>
      </div>
    )
  }

  if (albums.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-title">No albums yet</div>
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
        <h1 className="page-title">Albums</h1>
        <p className="page-subtitle">{albums.length} albums</p>
      </div>
      <div className="page-body">
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
    </div>
  )
}
