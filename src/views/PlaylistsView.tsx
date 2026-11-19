import { useTranslation } from 'react-i18next'
import { ListMusic, Music2, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useAppStore, usePlaybackStore } from '../store'
import '../styles/playlists.css'

export function PlaylistsView() {
  const { t } = useTranslation(['playlists', 'library', 'common'])
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
    const name = t('defaultName', { number: playlists.length + 1 })
    createPlaylist(name, queue.length > 0 ? queue : currentTrack ? [currentTrack] : [])
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="playlist-header-row">
          <div>
            <h1 className="page-title">{t('title')}</h1>
            <p className="page-subtitle">{t('subtitle')}</p>
          </div>

          <div className="playlist-header-actions">
            <button className="detail-play-btn playlist-toolbar-btn" onClick={handleCreateDefault}>
              <Plus size={14} />
              {t('actions.newPlaylist')}
            </button>

            <button
              className="secondary-btn playlist-toolbar-btn"
              onClick={() => saveCurrentQueueAsPlaylist()}
              disabled={queue.length === 0}
              style={{ opacity: queue.length === 0 ? 0.5 : 1 }}
            >
              <ListMusic size={14} />
              {t('actions.saveCurrentQueue')}
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {playlists.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">{t('empty.noPlaylists')}</div>
            <div className="empty-state-body">{t('empty.noPlaylistsBody')}</div>
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
                      <div className="playlist-card-count">{t('library:counts.track', { count: playlist.tracks.length })}</div>
                    </div>

                    <div className="playlist-card-description">
                      {playlist.description?.trim() || t('empty.noDescription')}
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
                        {t('common:actions.play')}
                      </button>

                      <button
                        className="player-btn"
                        title={t('actions.renamePlaylist')}
                        onClick={(e) => {
                          e.stopPropagation()
                          const nextName = window.prompt(t('actions.renamePlaylist'), playlist.name)?.trim()
                          if (nextName) {
                            renamePlaylist(playlist.id, nextName)
                          }
                        }}
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        className="player-btn"
                        title={t('actions.deletePlaylist')}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm(t('actions.confirmDelete', { name: playlist.name }))) {
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
