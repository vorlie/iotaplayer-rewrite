import { useTranslation } from 'react-i18next'
import { ArrowLeft, ImagePlus, Pencil, Play, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAppStore, usePlaybackStore } from '../store'
import { TracksTable } from './TracksView'
import '../styles/playlists.css'

export function PlaylistDetailView() {
  const { t } = useTranslation(['playlists', 'library', 'common'])
  const playlistId = useAppStore((s) => s.nav.playlistId)
  const navigate = useAppStore((s) => s.navigate)
  const playlists = usePlaybackStore((s) => s.playlists)
  const playlist = playlists.find((item) => item.id === playlistId) ?? null
  const { playPlaylist, updatePlaylistDetails, deletePlaylist, removeTrackFromPlaylist, reorderPlaylist } =
    usePlaybackStore()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(playlist?.name ?? '')
  const [description, setDescription] = useState(playlist?.description ?? '')

  if (!playlist) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-title">{t('empty.notFoundTitle')}</div>
          <div className="empty-state-body">{t('empty.notFoundBody')}</div>
        </div>
      </div>
    )
  }

  const totalDuration = playlist.tracks.reduce((sum, track) => sum + track.duration, 0)
  const coverUrl = playlist.coverData && playlist.coverMimeType
    ? `data:${playlist.coverMimeType};base64,${playlist.coverData}`
    : null

  const beginEditing = () => {
    setName(playlist.name)
    setDescription(playlist.description ?? '')
    setIsEditing(true)
  }

  const saveDetails = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    updatePlaylistDetails(playlist.id, {
      name: trimmedName,
      description: description.trim(),
    })
    setIsEditing(false)
  }

  const handleCoverChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const [, base64Part = ''] = result.split(';base64,')
      updatePlaylistDetails(playlist.id, {
        coverData: base64Part || result,
        coverMimeType: file.type || 'image/jpeg',
      })
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <div className="page">
      <div className="detail-hero playlist-detail-hero">
        <button
          className="sidebar__item"
          style={{ marginBottom: 'auto', alignSelf: 'flex-start' }}
          onClick={() => navigate('playlists')}
        >
          <ArrowLeft size={14} />
          {t('title')}
        </button>

        <div className="detail-artwork detail-artwork--playlist">
          {coverUrl ? <img src={coverUrl} alt={playlist.name} /> : <div>♫</div>}
        </div>

        <div className="detail-info">
          <div className="detail-kind">{t('kind')}</div>

          {isEditing ? (
            <div className="playlist-detail-editor">
              <label className="playlist-field">
                <span>{t('editor.name')}</span>
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>

              <label className="playlist-field">
                <span>{t('editor.description')}</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  placeholder={t('editor.descriptionPlaceholder')}
                />
              </label>

              <div className="playlist-editor-actions">
                <button className="detail-play-btn playlist-toolbar-btn" onClick={saveDetails}>{t('common:actions.saveChanges')}</button>
                <button className="secondary-btn playlist-toolbar-btn" onClick={() => setIsEditing(false)}>{t('common:actions.cancel')}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="detail-title">{playlist.name}</div>
              <div className="detail-meta">
                <span>{t('library:counts.track', { count: playlist.tracks.length })}</span>
                <span className="detail-meta-dot" />
                <span>{t('meta.minutes', { count: playlist.tracks.length > 0 ? Math.floor(totalDuration / 60) : 0 })}</span>
              </div>

              <div className="playlist-description-block">
                {playlist.description?.trim() ? (
                  <p>{playlist.description}</p>
                ) : (
                  <p className="playlist-description-empty">{t('empty.noDescriptionDetail')}</p>
                )}
              </div>

              <div className="playlist-detail-actions">
                <button className="detail-play-btn playlist-toolbar-btn" onClick={() => playPlaylist(playlist.id)}>
                  <Play size={13} fill="currentColor" />
                  {t('common:actions.play')}
                </button>

                <button className="player-btn playlist-icon-btn" title={t('actions.editDetails')} onClick={beginEditing}>
                  <Pencil size={13} />
                </button>

                <button
                  className="player-btn playlist-icon-btn"
                  title={t('actions.changeCover')}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={13} />
                </button>

                <button
                  className="player-btn playlist-icon-btn"
                  title={t('actions.deletePlaylist')}
                  onClick={() => {
                    if (window.confirm(t('actions.confirmDelete', { name: playlist.name }))) {
                      deletePlaylist(playlist.id)
                      navigate('playlists')
                    }
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleCoverChange}
      />

      <div className="page-body">
        {playlist.tracks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">{t('empty.noTracksTitle')}</div>
            <div className="empty-state-body">{t('empty.noTracksBody')}</div>
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
