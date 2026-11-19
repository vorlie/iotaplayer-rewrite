import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Pencil, Play, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { SmartPlaylistEditorModal } from '../components/SmartPlaylistEditorModal'
import { useFormatDuration } from '../hooks/useLibrary'
import { useAppStore, usePlaybackStore } from '../store'
import type { SmartPlaylist } from '../types/electron'
import { TracksTable } from './TracksView'
import '../styles/playlists.css'

export function SmartPlaylistDetailView() {
  const { t } = useTranslation(['playlists', 'library', 'common'])
  const smartPlaylistId = useAppStore((s) => s.nav.playlistId)
  const navigate = useAppStore((s) => s.navigate)
  const { playQueue, updateSmartPlaylist, deleteSmartPlaylist } = usePlaybackStore()
  const fmt = useFormatDuration()

  const [playlist, setPlaylist] = useState<SmartPlaylist | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  const loadEvaluated = useCallback(async () => {
    if (!smartPlaylistId || typeof window === 'undefined' || !('library' in window)) {
      return
    }
    setLoading(true)
    try {
      const evaluated = await window.library.evaluateSmartPlaylist(smartPlaylistId)
      setPlaylist(evaluated)
    } finally {
      setLoading(false)
    }
  }, [smartPlaylistId])

  useEffect(() => {
    let cancelled = false
    if (!smartPlaylistId || typeof window === 'undefined' || !('library' in window)) {
      return
    }
    window.library
      .evaluateSmartPlaylist(smartPlaylistId)
      .then((evaluated) => {
        if (!cancelled) {
          setPlaylist(evaluated)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [smartPlaylistId])

  if (loading && !playlist) {
    return (
      <div className="page">
        <div className="loading-state">{t('common:states.loading')}</div>
      </div>
    )
  }

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

  const tracks = playlist.tracks ?? []
  const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0)

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

        <div className="detail-artwork detail-artwork--playlist detail-artwork--smart">
          <Sparkles size={40} />
        </div>

        <div className="detail-info">
          <div className="detail-kind">{t('smart.kind')}</div>
          <div className="detail-title">{playlist.name}</div>
          <div className="detail-meta">
            <span>{t('library:counts.track', { count: tracks.length })}</span>
            <span className="detail-meta-dot" />
            <span>{fmt(totalDuration)}</span>
          </div>

          <div className="playlist-description-block">
            {playlist.description?.trim() ? (
              <p>{playlist.description}</p>
            ) : (
              <p className="playlist-description-empty">{t('empty.noDescription')}</p>
            )}
          </div>

          <div className="playlist-detail-actions">
            <button
              className="detail-play-btn playlist-toolbar-btn"
              disabled={tracks.length === 0}
              onClick={() => playQueue(tracks, undefined, { name: playlist.name })}
            >
              <Play size={13} fill="currentColor" />
              {t('common:actions.play')}
            </button>

            <button
              className="player-btn playlist-icon-btn"
              title={t('smart.refresh')}
              onClick={() => void loadEvaluated()}
            >
              <RefreshCw size={13} />
            </button>

            <button
              className="player-btn playlist-icon-btn"
              title={t('smart.editTitle')}
              onClick={() => setEditing(true)}
            >
              <Pencil size={13} />
            </button>

            <button
              className="player-btn playlist-icon-btn"
              title={t('actions.deletePlaylist')}
              onClick={() => {
                if (window.confirm(t('actions.confirmDelete', { name: playlist.name }))) {
                  void deleteSmartPlaylist(playlist.id).then(() => navigate('playlists'))
                }
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {tracks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">{t('smart.emptyTitle')}</div>
            <div className="empty-state-body">{t('smart.emptyBody')}</div>
          </div>
        ) : (
          <TracksTable tracks={tracks} showAlbum />
        )}
      </div>

      {editing && (
        <SmartPlaylistEditorModal
          initial={playlist}
          onSave={async (input) => {
            await updateSmartPlaylist(playlist.id, input)
            await loadEvaluated()
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
