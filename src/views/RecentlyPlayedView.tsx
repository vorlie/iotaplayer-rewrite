import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History, Play, Trash2 } from 'lucide-react'
import { useFormatDuration } from '../hooks/useLibrary'
import { usePlaybackStore } from '../store'
import type { Track } from '../types/electron'
import { TracksTable } from './TracksView'
import '../styles/library.css'

export function RecentlyPlayedView() {
  const { t } = useTranslation(['library', 'common'])
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(() => typeof window !== 'undefined' && 'library' in window)
  const fmt = useFormatDuration()
  const { currentTrack, playQueue } = usePlaybackStore()

  useEffect(() => {
    let cancelled = false
    if (typeof window !== 'undefined' && 'library' in window) {
      window.library
        .recentlyPlayed(100)
        .then((items) => {
          if (!cancelled) {
            setTracks(items)
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
  }, [currentTrack?.id])

  const handleClear = async () => {
    if (window.confirm(t('recentlyPlayed.confirmClear'))) {
      if (typeof window !== 'undefined' && 'library' in window) {
        await window.library.clearHistory()
        setTracks([])
      }
    }
  }

  const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0)

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">{t('recentlyPlayed.loading')}</div>
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{t('recentlyPlayed.title')}</h1>
          <p className="page-subtitle">{t('recentlyPlayed.subtitle')}</p>
        </div>
        <div className="page-body">
          <div className="empty-state">
            <div className="empty-state-title">{t('recentlyPlayed.emptyTitle')}</div>
            <div className="empty-state-body">
              {t('recentlyPlayed.emptyBody')}
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
            color: 'var(--color-accent)',
            background: 'var(--color-accent-dim)',
          }}
        >
          <History size={54} />
        </div>

        <div className="detail-info">
          <div className="detail-kind">{t('recentlyPlayed.history')}</div>
          <div className="detail-title">{t('recentlyPlayed.title')}</div>
          <div className="detail-meta">
            <span>{t('counts.track', { count: tracks.length })}</span>
            <span className="detail-meta-dot" />
            <span>{fmt(totalDuration)}</span>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              className="detail-play-btn"
              onClick={() => playQueue(tracks, undefined, { name: t('recentlyPlayed.title') })}
            >
              <Play size={14} fill="currentColor" />
              {t('common:actions.playAllLower')}
            </button>

            <button
              className="player-btn"
              onClick={handleClear}
              title={t('recentlyPlayed.clearHistory')}
            >
              <Trash2 size={14} />
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
