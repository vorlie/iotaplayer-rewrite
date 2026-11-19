import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Heart, Play } from 'lucide-react'
import { useFormatDuration } from '../hooks/useLibrary'
import { usePlaybackStore } from '../store'
import type { Track } from '../types/electron'
import { TracksTable } from './TracksView'
import '../styles/library.css'

export function FavoritesView() {
  const { t } = useTranslation(['library', 'common'])
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(() => typeof window !== 'undefined' && 'library' in window)
  const fmt = useFormatDuration()
  const { favoriteIds, playQueue } = usePlaybackStore()

  useEffect(() => {
    let cancelled = false
    if (typeof window !== 'undefined' && 'library' in window) {
      window.library
        .favorites()
        .then((favs) => {
          if (!cancelled) {
            setTracks(favs)
            setLoading(false)
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false)
        })
    }

    return () => {
      cancelled = true
    }
  }, [favoriteIds])

  const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0)

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">{t('favorites.loading')}</div>
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{t('favorites.title')}</h1>
          <p className="page-subtitle">{t('favorites.subtitle')}</p>
        </div>
        <div className="page-body">
          <div className="empty-state">
            <div className="empty-state-title">{t('favorites.emptyTitle')}</div>
            <div className="empty-state-body">
              {t('favorites.emptyBody')}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="detail-hero">
        <div
          className="detail-artwork"
          style={{
            display: 'grid',
            placeItems: 'center',
            fontSize: 48,
            color: '#ef4444',
            background: 'rgba(239, 68, 68, 0.12)',
          }}
        >
          <Heart size={54} fill="currentColor" />
        </div>

        <div className="detail-info">
          <div className="detail-kind">{t('favorites.collection')}</div>
          <div className="detail-title">{t('favorites.title')}</div>
          <div className="detail-meta">
            <span>{t('counts.track', { count: tracks.length })}</span>
            <span className="detail-meta-dot" />
            <span>{fmt(totalDuration)}</span>
          </div>

          <div>
            <button
              className="detail-play-btn"
              onClick={() => playQueue(tracks, undefined, { name: t('favorites.title') })}
            >
              <Play size={14} fill="currentColor" />
              {t('common:actions.playAllLower')}
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        <TracksTable tracks={tracks} showAlbum />
      </div>
    </div>
  )
}
