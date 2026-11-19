import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListMusic, Music2, Pencil, Play, Plus, Trash2, X } from 'lucide-react'
import { useAppStore, usePlaybackStore } from '../store'
import type { Playlist } from '../types/electron'
import '../styles/playlists.css'

type PlaylistModalState =
  | { mode: 'create' }
  | { mode: 'edit'; playlist: Playlist }
  | null

export function PlaylistsView() {
  const { t } = useTranslation(['playlists', 'library', 'common'])
  const {
    playlists,
    playPlaylist,
    createPlaylist,
    queue,
    saveCurrentQueueAsPlaylist,
    updatePlaylistDetails,
    deletePlaylist,
  } = usePlaybackStore()
  const navigate = useAppStore((s) => s.navigate)

  const [modalState, setModalState] = useState<PlaylistModalState>(null)
  const [nameInput, setNameInput] = useState('')
  const [descriptionInput, setDescriptionInput] = useState('')

  function openCreateModal() {
    setNameInput(t('defaultName', { number: playlists.length + 1 }))
    setDescriptionInput('')
    setModalState({ mode: 'create' })
  }

  function openEditModal(playlist: Playlist) {
    setNameInput(playlist.name)
    setDescriptionInput(playlist.description ?? '')
    setModalState({ mode: 'edit', playlist })
  }

  function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = nameInput.trim()
    if (!trimmedName || !modalState) return

    if (modalState.mode === 'create') {
      createPlaylist(trimmedName, [], descriptionInput.trim())
    } else {
      updatePlaylistDetails(modalState.playlist.id, {
        name: trimmedName,
        description: descriptionInput.trim(),
      })
    }

    setModalState(null)
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
            <button className="detail-play-btn playlist-toolbar-btn" onClick={openCreateModal}>
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
                        title={t('actions.editDetails')}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditModal(playlist)
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

      {modalState && (
        <div
          className="playlist-modal-backdrop"
          onClick={() => setModalState(null)}
        >
          <div
            className="playlist-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="playlist-modal__header">
              <h2 className="playlist-modal__title">
                {modalState.mode === 'create'
                  ? t('actions.newPlaylist')
                  : t('actions.editDetails')}
              </h2>
              <button
                type="button"
                className="player-btn"
                title={t('common:actions.close')}
                onClick={() => setModalState(null)}
              >
                <X size={14} />
              </button>
            </div>

            <form className="playlist-modal__form" onSubmit={handleModalSubmit}>
              <label className="playlist-field">
                <span>{t('editor.name')}</span>
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
                  required
                />
              </label>

              <label className="playlist-field">
                <span>{t('editor.description')}</span>
                <textarea
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  rows={3}
                  placeholder={t('editor.descriptionPlaceholder')}
                />
              </label>

              <div className="playlist-editor-actions">
                <button
                  type="submit"
                  className="detail-play-btn playlist-toolbar-btn"
                  disabled={!nameInput.trim()}
                >
                  {modalState.mode === 'create'
                    ? t('actions.newPlaylist')
                    : t('common:actions.saveChanges')}
                </button>
                <button
                  type="button"
                  className="secondary-btn playlist-toolbar-btn"
                  onClick={() => setModalState(null)}
                >
                  {t('common:actions.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
