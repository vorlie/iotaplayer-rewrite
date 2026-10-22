import { ArrowLeft, Pencil, Play, Trash2 } from 'lucide-react'
import { useAppStore, usePlaybackStore } from '../store'
import { TracksTable } from './TracksView'
import '../styles/library.css'

export function PlaylistDetailView() {
  const playlistId = useAppStore((s) => s.nav.playlistId)
  const navigate = useAppStore((s) => s.navigate)
  const playlists = usePlaybackStore((s) => s.playlists)
  const playlist = playlists.find((item) => item.id === playlistId) ?? null
  const { playPlaylist, renamePlaylist, deletePlaylist, removeTrackFromPlaylist, reorderPlaylist } =
    usePlaybackStore()

  if (!playlist) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-title">Playlist not found</div>
          <div className="empty-state-body">This playlist may have been removed or is no longer available.</div>
        </div>
      </div>
    )
  }

  const totalDuration = playlist.tracks.reduce((sum, track) => sum + track.duration, 0)

  return (
    <div className="page">
      <div className="detail-hero">
        <button
          className="sidebar__item"
          style={{ marginBottom: 'auto', alignSelf: 'flex-start' }}
          onClick={() => navigate('playlists')}
        >
          <ArrowLeft size={14} />
          Playlists
        </button>

        <div className="detail-artwork" style={{ display: 'grid', placeItems: 'center', fontSize: 52, color: 'var(--color-text-3)' }}>
          <div>♫</div>
        </div>

        <div className="detail-info">
          <div className="detail-kind">Playlist</div>
          <div className="detail-title">{playlist.name}</div>
          <div className="detail-meta">
            <span>{playlist.tracks.length} tracks</span>
            <span className="detail-meta-dot" />
            <span>{playlist.tracks.length > 0 ? `${Math.floor(totalDuration / 60)} min` : '0 min'}</span>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="detail-play-btn" onClick={() => playPlaylist(playlist.id)}>
              <Play size={14} fill="currentColor" />
              Play
            </button>

            <button
              className="player-btn"
              title="Rename playlist"
              onClick={() => {
                const nextName = window.prompt('Rename playlist', playlist.name)?.trim()
                if (nextName) {
                  renamePlaylist(playlist.id, nextName)
                }
              }}
            >
              <Pencil size={14} />
            </button>

            <button
              className="player-btn"
              title="Delete playlist"
              onClick={() => {
                if (window.confirm(`Delete playlist "${playlist.name}"?`)) {
                  deletePlaylist(playlist.id)
                  navigate('playlists')
                }
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {playlist.tracks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">This playlist is empty</div>
            <div className="empty-state-body">Add tracks from the library or the queue to start building it.</div>
          </div>
        ) : (
          <TracksTable
            tracks={playlist.tracks}
            showAlbum
            onRemoveTrack={(position) => removeTrackFromPlaylist(playlist.id, position)}
            onMoveTrack={(fromIndex, toIndex) => reorderPlaylist(playlist.id, fromIndex, toIndex)}
          />
        )}
      </div>
    </div>
  )
}
