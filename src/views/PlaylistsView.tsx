import { ListMusic, Music2, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useAppStore, usePlaybackStore } from '../store'
import '../styles/playlists.css'

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
        <div className="playlist-header-row">
          <div>
            <h1 className="page-title">Playlists</h1>
            <p className="page-subtitle">Saved queues and listening sessions</p>
          </div>

          <div className="playlist-header-actions">
            <button className="detail-play-btn playlist-toolbar-btn" onClick={handleCreateDefault}>
              <Plus size={14} />
              New playlist
            </button>

            <button
              className="secondary-btn playlist-toolbar-btn"
              onClick={() => saveCurrentQueueAsPlaylist()}
              disabled={queue.length === 0}
              style={{ opacity: queue.length === 0 ? 0.5 : 1 }}
            >
              <ListMusic size={14} />
              Save current queue
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {playlists.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No playlists yet</div>
            <div className="empty-state-body">Create one from the current queue or your favorite tracks.</div>
          </div>
        ) : (
          <div className="playlist-grid">
            {playlists.map((playlist) => {
              const coverUrl = playlist.coverData && playlist.coverMimeType
                ? `data:${playlist.coverMimeType};base64,${playlist.coverData}`
                : null

              return (
                <div
                  key={playlist.id}
                  className="playlist-card"
                  onClick={() => navigate('playlist-detail', { playlistId: playlist.id })}
                >
                  <div className="playlist-cover">
                    {coverUrl ? (
                      <img src={coverUrl} alt={playlist.name} />
                    ) : (
                      <div className="playlist-cover-placeholder">
                        <Music2 size={22} />
                      </div>
                    )}
                  </div>

                  <div className="playlist-card-body">
                    <div className="playlist-card-header">
                      <div className="playlist-card-name">{playlist.name}</div>
                      <div className="playlist-card-count">{playlist.tracks.length} tracks</div>
                    </div>

                    <div className="playlist-card-description">
                      {playlist.description?.trim() || 'No description yet'}
                    </div>

                    <div className="playlist-card-actions">
                      <button
                        className="detail-play-btn playlist-card-play-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          playPlaylist(playlist.id)
                        }}
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
