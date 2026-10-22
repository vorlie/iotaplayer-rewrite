import { Heart, Music2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { usePlaybackStore } from '../store'
import { useArtwork, useFormatDuration } from '../hooks/useLibrary'
import '../styles/layout.css'

export function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    volume,
    repeatMode,
    shuffle,
    activeBackend,
    favoriteIds,
    toggleFavorite,
    toggle,
    next,
    previous,
    seek,
    setVolume,
    toggleRepeat,
    toggleShuffle,
  } = usePlaybackStore()
  const artworkSrc = useArtwork(currentTrack?.artwork_id)
  const fmt = useFormatDuration()

  const isFav = currentTrack ? favoriteIds.includes(currentTrack.id) : false
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
          <>
            <div className="player-track-info">
              <div className="player-track-title">{currentTrack.title}</div>
              <div className="player-track-artist">
                {currentTrack.artist ?? currentTrack.album_artist ?? '—'}
              </div>
            </div>
            <button
              className={`player-fav-btn ${isFav ? 'is-fav' : ''}`}
              onClick={() => toggleFavorite(currentTrack)}
              title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
            >
              <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
            </button>
          </>
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
          <button className={`player-btn ${shuffle ? 'is-active' : ''}`} onClick={toggleShuffle} title={shuffle ? 'Shuffle on' : 'Shuffle off'}>
            <Shuffle size={14} />
          </button>
          <button className="player-btn" onClick={previous} title="Previous">
            <SkipBack size={16} />
          </button>
          <button className="player-btn player-btn--play" onClick={toggle} title="Play/Pause">
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button className="player-btn" onClick={next} title="Next">
            <SkipForward size={16} />
          </button>
          <button
            className={`player-btn ${repeatMode !== 'off' ? 'is-active' : ''} ${repeatMode === 'one' ? 'is-repeat-one' : ''}`}
            onClick={toggleRepeat}
            title={repeatMode === 'off' ? 'Repeat off' : repeatMode === 'all' ? 'Repeat all' : 'Repeat one'}
          >
            {repeatMode === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
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

      {/* Volume & Backend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifySelf: 'end' }}>
        <span
          className={`player-backend-badge player-backend-badge--${activeBackend}`}
          title={`Active playback backend: ${activeBackend.toUpperCase()}`}
        >
          {activeBackend}
        </span>
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
    </div>
  )
}
