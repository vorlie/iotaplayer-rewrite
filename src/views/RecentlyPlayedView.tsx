import { useEffect, useState } from 'react'
import { History, Play, Trash2 } from 'lucide-react'
import { useFormatDuration } from '../hooks/useLibrary'
import { usePlaybackStore } from '../store'
import type { Track } from '../types/electron'
import { TracksTable } from './TracksView'
import '../styles/library.css'

export function RecentlyPlayedView() {
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
    if (window.confirm('Clear all playback history?')) {
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
        <div className="loading-state">Loading history…</div>
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Recently Played</h1>
          <p className="page-subtitle">Your playback history</p>
        </div>
        <div className="page-body">
          <div className="empty-state">
            <div className="empty-state-title">No playback history yet</div>
            <div className="empty-state-body">
              Play music from your library and your recently played tracks will appear here.
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
          <div className="detail-kind">History</div>
          <div className="detail-title">Recently Played</div>
          <div className="detail-meta">
            <span>{tracks.length} tracks</span>
            <span className="detail-meta-dot" />
            <span>{fmt(totalDuration)}</span>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              className="detail-play-btn"
              onClick={() => playQueue(tracks, undefined, { name: 'Recently Played' })}
            >
              <Play size={14} fill="currentColor" />
              Play all
            </button>

            <button
              className="player-btn"
              onClick={handleClear}
              title="Clear playback history"
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
