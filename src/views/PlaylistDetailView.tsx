import { ArrowLeft, ImagePlus, Pencil, Play, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAppStore, usePlaybackStore } from '../store'
import { TracksTable } from './TracksView'
import '../styles/library.css'

export function PlaylistDetailView() {
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
          <div className="empty-state-title">Playlist not found</div>
          <div className="empty-state-body">This playlist may have been removed or is no longer available.</div>
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
      <div className="detail-hero">
        <button
          className="sidebar__item"
          style={{ marginBottom: 'auto', alignSelf: 'flex-start' }}
          onClick={() => navigate('playlists')}
        >
          <ArrowLeft size={14} />
          Playlists
        </button>

        <div className="detail-artwork detail-artwork--playlist">
          {coverUrl ? <img src={coverUrl} alt={playlist.name} /> : <div>♫</div>}
        </div>

        <div className="detail-info">
          <div className="detail-kind">Playlist</div>

          {isEditing ? (
            <div className="playlist-detail-editor">
              <label className="playlist-field">
                <span>Playlist name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>

              <label className="playlist-field">
                <span>Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="Add a short description..."
                />
              </label>

              <div className="playlist-editor-actions">
                <button className="detail-play-btn" onClick={saveDetails}>Save changes</button>
                <button className="secondary-btn" onClick={() => setIsEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="detail-title">{playlist.name}</div>
              <div className="detail-meta">
                <span>{playlist.tracks.length} tracks</span>
                <span className="detail-meta-dot" />
                <span>{playlist.tracks.length > 0 ? `${Math.floor(totalDuration / 60)} min` : '0 min'}</span>
              </div>

              <div className="playlist-description-block">
                {playlist.description?.trim() ? (
                  <p>{playlist.description}</p>
                ) : (
                  <p className="playlist-description-empty">No description yet. Add one to give this playlist a little personality.</p>
                )}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {!isEditing && (
              <>
                <button className="detail-play-btn" onClick={() => playPlaylist(playlist.id)}>
                  <Play size={14} fill="currentColor" />
                  Play
                </button>

                <button className="player-btn" title="Edit playlist details" onClick={beginEditing}>
                  <Pencil size={14} />
                </button>

                <button
                  className="player-btn"
                  title="Change cover art"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={14} />
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
              </>
            )}
          </div>
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
