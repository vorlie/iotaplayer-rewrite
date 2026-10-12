import { ListMusic, Play, Plus, Pencil, Trash2 } from 'lucide-react'
import { useAppStore, usePlaybackStore } from '../store'

export function PlaylistsView() {
  const {
    playlists,
    playPlaylist,
    createPlaylist,
    currentTrack,
    queue,
    saveCurrentQueueAsPlaylist,
    renamePlaylist,
    deletePlaylist,
  } = usePlaybackStore()
  const navigate = useAppStore((s) => s.navigate)

  function handleCreateDefault() {
    const name = `My Playlist ${playlists.length + 1}`
    createPlaylist(name, queue.length > 0 ? queue : currentTrack ? [currentTrack] : [])
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Playlists</h1>
        <p className="page-subtitle">Saved queues and listening sessions</p>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <button className="detail-play-btn" onClick={handleCreateDefault}>
            <Plus size={14} />
            New playlist
          </button>

          <button
            className="sidebar__item"
            onClick={() => saveCurrentQueueAsPlaylist()}
            disabled={queue.length === 0}
            style={{ opacity: queue.length === 0 ? 0.5 : 1 }}
          >
            <ListMusic size={14} />
            Save current queue
          </button>
        </div>

        {playlists.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No playlists yet</div>
            <div className="empty-state-body">Create one from the current queue or your favorite tracks.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                onClick={() => navigate('playlist-detail', { playlistId: playlist.id })}
                style={{ background: 'var(--color-surface-1)', borderRadius: 14, padding: 16, display: 'grid', gap: 12, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>{playlist.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{playlist.tracks.length} tracks</div>
                </div>

                <div style={{ color: 'var(--color-text-3)', fontSize: 12 }}>
                  {playlist.tracks[0]?.title ?? 'Empty playlist'}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="detail-play-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      playPlaylist(playlist.id)
                    }}
                    style={{ flex: 1 }}
                  >
                    <Play size={14} fill="currentColor" />
                    Play
                  </button>

                  <button
                    className="player-btn"
                    title="Rename playlist"
                    onClick={(e) => {
                      e.stopPropagation()
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
                    onClick={(e) => {
                      e.stopPropagation()
                      if (window.confirm(`Delete playlist "${playlist.name}"?`)) {
                        deletePlaylist(playlist.id)
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
