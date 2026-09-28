import { Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { usePlaybackStore } from '../store'
import { useArtwork, useFormatDuration } from '../hooks/useLibrary'
import { Music2 } from 'lucide-react'
import '../styles/layout.css'

export function PlayerBar() {
  const { currentTrack, isPlaying, position, duration, volume, toggle, next, previous, seek, setVolume } =
    usePlaybackStore()
  const artworkSrc = useArtwork(currentTrack?.artwork_id)
  const fmt = useFormatDuration()

  const progress = duration > 0 ? (position / duration) * 100 : 0

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    seek(ratio * duration)
  }

  function handleVolumeClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    setVolume(ratio)
  }

  return (
    <div className="player-bar">
      {/* Track info */}
      <div className="player-track">
        <div className="player-artwork">
          {artworkSrc ? (
            <img src={artworkSrc} alt="" />
          ) : (
            <Music2 size={20} color="var(--color-text-3)" />
          )}
        </div>
        {currentTrack ? (
          <div className="player-track-info">
            <div className="player-track-title">{currentTrack.title}</div>
            <div className="player-track-artist">
              {currentTrack.artist ?? currentTrack.album_artist ?? '—'}
            </div>
          </div>
        ) : (
          <div className="player-track-info">
            <div className="player-track-title" style={{ color: 'var(--color-text-3)' }}>
              No track playing
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="player-controls">
        <div className="player-buttons">
          <button className="player-btn" onClick={previous} title="Previous">
            <SkipBack size={16} />
          </button>
          <button className="player-btn player-btn--play" onClick={toggle} title="Play/Pause">
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button className="player-btn" onClick={next} title="Next">
            <SkipForward size={16} />
          </button>
        </div>

        <div className="player-progress">
          <span className="player-time">{fmt(position)}</span>
          <div className="progress-track" onClick={handleProgressClick}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="player-time player-time--end">{fmt(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="player-volume">
        <Volume2 size={14} color="var(--color-text-3)" />
        <div
          className="volume-track"
          onClick={handleVolumeClick}
          style={{ background: 'var(--color-surface-3)' }}
        >
          <div
            className="volume-fill"
            style={{
              width: `${volume * 100}%`,
              height: '100%',
              background: 'var(--color-accent)',
              borderRadius: 2,
            }}
          />
        </div>
      </div>
    </div>
  )
}
