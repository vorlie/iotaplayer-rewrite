import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronUp,
  Disc,
  Heart,
  ListMusic,
  Mic2,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import {
  getActiveLyricIndex,
  getLineWordSyncStates,
} from '../../electron/lyricsSync'
import { getLocalizedLyricsSourceLabel } from '../i18n/lyricsSource'
import {
  useArtwork,
  useFormatDuration,
  useInterpolatedPosition,
  useLyrics,
} from '../hooks/useLibrary'
import { useAppStore, usePlaybackStore } from '../store'
import { LyricGapIndicator } from './LyricGapIndicator'
import '../styles/fullscreen-now-playing.css'

export function FullscreenNowPlaying() {
  const { t } = useTranslation(['player', 'library', 'common'])
  const isFullscreen = useAppStore((s) => s.isFullscreenNowPlaying)
  const setFullscreen = useAppStore((s) => s.setFullscreenNowPlaying)

  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    volume,
    queue,
    queueIndex,
    repeatMode,
    shuffle,
    playbackRate,
    activeBackend,
    favoriteIds,
    toggleFavorite,
    toggle,
    previous,
    next,
    seek,
    setVolume,
    toggleRepeat,
    toggleShuffle,
    play,
    removeFromQueue,
    clearQueue,
    moveQueueItem,
  } = usePlaybackStore()

  const fmt = useFormatDuration()
  const artworkSrc = useArtwork(currentTrack?.artwork_id)
  const { lyrics, loading: lyricsLoading, reload: reloadLyrics } = useLyrics(currentTrack?.id)

  const isFav = currentTrack ? favoriteIds.includes(currentTrack.id) : false
  const progress = duration > 0 ? (position / duration) * 100 : 0

  // Display mode: 'split' (both), 'artwork' (focus on cover), 'lyrics' (focus on lyrics)
  const [viewMode, setViewMode] = useState<'split' | 'artwork' | 'lyrics'>('split')
  // Secondary pane tab: 'lyrics' or 'queue'
  const [secondaryTab, setSecondaryTab] = useState<'lyrics' | 'queue'>('lyrics')

  const lyricsListRef = useRef<HTMLDivElement>(null)
  const userScrolledLyricsUntil = useRef(0)
  const isLyricsPointerDown = useRef(false)
  const prevVolume = useRef(volume || 0.8)

  const syncPosition = useInterpolatedPosition(
    position,
    isPlaying,
    lyrics,
    isFullscreen,
    duration,
    playbackRate,
  )

  // Find active lyric line index based on current playback position
  const activeLyricIndex = getActiveLyricIndex(lyrics, syncPosition)

  // Auto-scroll active lyric into center view
  useEffect(() => {
    if (
      !isFullscreen ||
      secondaryTab !== 'lyrics' ||
      viewMode === 'artwork' ||
      activeLyricIndex < 0 ||
      isLyricsPointerDown.current ||
      Date.now() < userScrolledLyricsUntil.current
    ) {
      return
    }

    const container = lyricsListRef.current
    if (!container) return

    const lineEl = container.querySelector<HTMLElement>(
      `[data-lyric-index="${activeLyricIndex}"]`,
    )
    if (lineEl) {
      const containerRect = container.getBoundingClientRect()
      const lineRect = lineEl.getBoundingClientRect()
      const targetTop =
        container.scrollTop +
        (lineRect.top - containerRect.top) -
        container.clientHeight / 2 +
        lineRect.height / 2

      container.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth',
      })
    }
  }, [activeLyricIndex, isFullscreen, secondaryTab, viewMode])

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seek(ratio * duration)
  }

  function handleVolumeClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setVolume(ratio)
  }

  function handleToggleMute() {
    if (volume > 0) {
      prevVolume.current = volume
      setVolume(0)
    } else {
      setVolume(prevVolume.current || 0.8)
    }
  }

  const repeatLabel =
    repeatMode === 'off'
      ? t('controls.repeatOff')
      : repeatMode === 'all'
        ? t('controls.repeatAll')
        : t('controls.repeatOne')

  // Lyrics source human-readable tag
  const lyricsSource = getLocalizedLyricsSourceLabel(lyrics)

  return (
    <div
      className={`fullscreen-now-playing ${isFullscreen ? 'is-active' : ''}`}
      aria-hidden={!isFullscreen}
    >
      {/* Dynamic blurred artwork background */}
      <div className="fullscreen-bg">
        {artworkSrc ? (
          <div
            className="fullscreen-bg__image"
            style={{ backgroundImage: `url("${artworkSrc}")` }}
          />
        ) : (
          <div className="fullscreen-bg__fallback" />
        )}
        <div className="fullscreen-bg__scrim" />
      </div>

      {/* Top Header */}
      <header className="fullscreen-header">
        <div className="fullscreen-header__left">
          <div className="fullscreen-header__brand">
            <Disc size={16} />
            <span>{t('common:app.name')}</span>
          </div>
          <span
            className={`player-backend-badge player-backend-badge--${activeBackend}`}
            title={t('status.backendLabel', { backend: activeBackend.toUpperCase() })}
          >
            {activeBackend}
          </span>
        </div>

        {/* View mode toggle */}
        <div className="fullscreen-header__center">
          <button
            type="button"
            className={`fullscreen-nav-tab ${viewMode === 'split' ? 'is-active' : ''}`}
            onClick={() => setViewMode('split')}
            title={t('fullscreen.splitTitle')}
          >
            {t('fullscreen.split')}
          </button>
          <button
            type="button"
            className={`fullscreen-nav-tab ${viewMode === 'artwork' ? 'is-active' : ''}`}
            onClick={() => setViewMode('artwork')}
            title={t('fullscreen.artworkTitle')}
          >
            {t('fullscreen.artwork')}
          </button>
          <button
            type="button"
            className={`fullscreen-nav-tab ${viewMode === 'lyrics' ? 'is-active' : ''}`}
            onClick={() => {
              setViewMode('lyrics')
              setSecondaryTab('lyrics')
            }}
            title={t('fullscreen.lyricsTitle')}
          >
            {t('fullscreen.lyrics')}
          </button>
        </div>

        <div className="fullscreen-header__right">
          {viewMode !== 'artwork' && (
            <>
              <button
                type="button"
                className={`fullscreen-icon-btn ${secondaryTab === 'lyrics' ? 'is-active' : ''}`}
                onClick={() => setSecondaryTab('lyrics')}
                title={t('fullscreen.showLyrics')}
              >
                <Mic2 size={16} />
              </button>
              <button
                type="button"
                className={`fullscreen-icon-btn ${secondaryTab === 'queue' ? 'is-active' : ''}`}
                onClick={() => setSecondaryTab('queue')}
                title={t('fullscreen.showQueue')}
              >
                <ListMusic size={16} />
              </button>
            </>
          )}

          <button
            type="button"
            className="fullscreen-icon-btn"
            onClick={() => setFullscreen(false)}
            title={t('controls.exitFullscreen')}
          >
            <Minimize2 size={16} />
          </button>
        </div>
      </header>

      {/* Main Viewport Body */}
      <main className={`fullscreen-body mode-${viewMode}`}>
        {/* Left Column: Artwork & Playback Controls */}
        <section className="fullscreen-main-pane">
          <div className="fullscreen-artwork-wrapper">
            {artworkSrc ? (
              <img
                src={artworkSrc}
                alt={currentTrack?.title ?? t('status.albumArt')}
                className="fullscreen-artwork-img"
              />
            ) : (
              <div className="fullscreen-artwork-placeholder">♫</div>
            )}
          </div>

          <div className="fullscreen-meta">
            <div className="fullscreen-meta__header">
              <div style={{ minWidth: 0, flex: 1 }}>
                <h1 className="fullscreen-meta__title">
                  {currentTrack?.title ?? t('status.noTrackSelected')}
                </h1>
                <div className="fullscreen-meta__artist">
                  {currentTrack?.artist ?? currentTrack?.album_artist ?? t('common:fallbacks.unknownArtist')}
                </div>
                <div className="fullscreen-meta__album">
                  <span>{currentTrack?.album ?? t('common:fallbacks.unknownAlbum')}</span>
                  {currentTrack?.year != null && currentTrack.year > 0 && (
                    <>
                      <span>•</span>
                      <span className="fullscreen-meta__year">{currentTrack.year}</span>
                    </>
                  )}
                </div>
              </div>

              {currentTrack && (
                <button
                  type="button"
                  className={`player-fav-btn ${isFav ? 'is-fav' : ''}`}
                  onClick={() => toggleFavorite(currentTrack)}
                  title={isFav ? t('common:actions.removeFromFavorites') : t('common:actions.addToFavorites')}
                >
                  <Heart size={22} fill={isFav ? 'currentColor' : 'none'} />
                </button>
              )}
            </div>
          </div>

          {/* Progress / Seek bar */}
          <div className="fullscreen-progress-row">
            <span className="fullscreen-time">{fmt(position)}</span>
            <div
              className="fullscreen-progress-track"
              onClick={handleProgressClick}
              role="slider"
              aria-label={t('status.seekProgress')}
              aria-valuenow={position}
              aria-valuemin={0}
              aria-valuemax={duration}
            >
              <div className="fullscreen-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="fullscreen-time fullscreen-time--end">{fmt(duration)}</span>
          </div>

          {/* Primary Playback Controls */}
          <div className="fullscreen-controls">
            <button
              type="button"
              className={`fullscreen-btn ${shuffle ? 'is-active' : ''}`}
              title={shuffle ? t('controls.shuffleOn') : t('controls.shuffleOff')}
              onClick={toggleShuffle}
            >
              <Shuffle size={18} />
            </button>
            <button
              type="button"
              className="fullscreen-btn"
              onClick={previous}
              title={t('controls.previousTrack')}
            >
              <SkipBack size={22} />
            </button>
            <button
              type="button"
              className="fullscreen-btn fullscreen-btn--play"
              onClick={toggle}
              title={t('controls.playPauseShortcut')}
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
            <button
              type="button"
              className="fullscreen-btn"
              onClick={next}
              title={t('controls.nextTrack')}
            >
              <SkipForward size={22} />
            </button>
            <button
              type="button"
              className={`fullscreen-btn ${repeatMode !== 'off' ? 'is-active' : ''}`}
              title={repeatLabel}
              onClick={toggleRepeat}
            >
              {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </button>
          </div>

          {/* Volume Control */}
          <div className="fullscreen-volume-row">
            <button
              type="button"
              className="player-fav-btn"
              onClick={handleToggleMute}
              title={volume === 0 ? t('controls.unmute') : t('controls.mute')}
              style={{ padding: 4 }}
            >
              {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <div
              className="fullscreen-volume-track"
              onClick={handleVolumeClick}
              role="slider"
              aria-label={t('status.volume')}
              aria-valuenow={volume}
              aria-valuemin={0}
              aria-valuemax={1}
            >
              <div className="fullscreen-volume-fill" style={{ width: `${volume * 100}%` }} />
            </div>
          </div>
        </section>

        {/* Right Column: Lyrics or Queue Panel */}
        {viewMode !== 'artwork' && (
          <section className="fullscreen-secondary-pane">
            {secondaryTab === 'lyrics' ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, width: '100%', minWidth: 0, overflow: 'hidden' }}>
                {(lyricsSource || currentTrack) && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px clamp(20px, 3vw, 28px) 0',
                      flexShrink: 0,
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        color: 'var(--color-text-3)',
                      }}
                    >
                      {lyricsSource ?? t('status.lyrics')}
                    </span>
                    {currentTrack && lyrics.lines.length > 0 && (
                      <button
                        type="button"
                        className="fullscreen-reload-btn"
                        onClick={reloadLyrics}
                        title={t('status.searchLyricsFileAgain')}
                        style={{ padding: '4px 10px' }}
                      >
                        <RotateCcw size={11} />
                        {t('common:actions.checkAgain')}
                      </button>
                    )}
                  </div>
                )}
                <div
                  ref={lyricsListRef}
                  className={`fullscreen-lyrics-container ${lyrics.synchronized ? 'is-synced' : ''}`}
                  onWheel={() => {
                    userScrolledLyricsUntil.current = Date.now() + 3500
                  }}
                  onTouchMove={() => {
                    userScrolledLyricsUntil.current = Date.now() + 3500
                  }}
                  onPointerDown={() => {
                    isLyricsPointerDown.current = true
                  }}
                  onPointerUp={() => {
                    isLyricsPointerDown.current = false
                    userScrolledLyricsUntil.current = Date.now() + 3500
                  }}
                  onPointerCancel={() => {
                    isLyricsPointerDown.current = false
                  }}
                >
                  {lyricsLoading ? (
                    <div className="fullscreen-lyrics-empty">
                      <div className="fullscreen-lyrics-empty__title">{t('status.loadingLyrics')}</div>
                    </div>
                  ) : lyrics.lines.length > 0 ? (
                    <div className="fullscreen-lyrics-list">
                      {lyrics.lines.map((line, index) => {
                        const isActive = index === activeLyricIndex
                        const isGap = Boolean(line.isGap || (!line.text && line.timestamp != null))

                        if (isGap) {
                          return (
                            <LyricGapIndicator
                              key={`${line.timestamp ?? 'gap'}-${index}`}
                              index={index}
                              isActive={isActive}
                              timestamp={line.timestamp}
                              onSeek={seek}
                              formattedTimestamp={line.timestamp != null ? fmt(line.timestamp) : undefined}
                              variant="fullscreen"
                            />
                          )
                        }

                        const isClickable = line.timestamp != null && Boolean(line.text)
                        const words = line.words && line.words.length > 0 ? line.words : null
                        const nextLineTimestamp = lyrics.lines[index + 1]?.timestamp
                        const wordStates =
                          words && isActive
                            ? getLineWordSyncStates(line, syncPosition, nextLineTimestamp)
                            : null
                        const hasEmbeddedSpaces = words
                          ? words.some((w) => /^\s|\s$/.test(w.text))
                          : false
                        const hasLineSpaces = words ? /\s/.test(line.text) : false

                        return (
                          <button
                            key={`${line.timestamp ?? 'text'}-${index}`}
                            type="button"
                            data-lyric-index={index}
                            className={`fullscreen-lyric-line ${isActive ? 'is-active' : ''} ${words ? 'is-word-synced' : ''}`}
                            disabled={!isClickable}
                            onClick={() => {
                              if (line.timestamp != null) {
                                seek(line.timestamp)
                              }
                            }}
                            title={line.timestamp != null ? t('status.seekTo', { time: fmt(line.timestamp) }) : undefined}
                          >
                            {words
                              ? words.map((word, wIdx) => {
                                  const wordState = wordStates?.[wIdx]
                                  const status = wordState
                                    ? wordState.status
                                    : activeLyricIndex >= 0 && index < activeLyricIndex
                                      ? 'past'
                                      : 'upcoming'
                                  const visibleText = word.text.trim() || word.text
                                  const needsTrailingSpace =
                                    /\s$/.test(word.text) ||
                                    (!hasEmbeddedSpaces &&
                                      hasLineSpaces &&
                                      wIdx < words.length - 1)
                                  const needsLeadingSpace =
                                    /^\s/.test(word.text) &&
                                    wIdx > 0 &&
                                    !/\s$/.test(words[wIdx - 1].text)

                                  return (
                                    <span
                                      key={`${word.timestamp}-${wIdx}`}
                                      className="fullscreen-lyric-word-group"
                                    >
                                      {needsLeadingSpace ? ' ' : null}
                                      <span
                                        className={`fullscreen-lyric-word is-${status}`}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          seek(word.timestamp)
                                        }}
                                        title={t('status.seekToWord', { word: visibleText, time: fmt(word.timestamp) })}
                                      >
                                        {visibleText}
                                      </span>
                                      {needsTrailingSpace ? ' ' : null}
                                    </span>
                                  )
                                })
                              : line.text}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="fullscreen-lyrics-empty">
                      <Mic2 size={36} className="fullscreen-lyrics-empty__icon" />
                      <div className="fullscreen-lyrics-empty__title">{t('status.noLyricsAvailable')}</div>
                      <div className="fullscreen-lyrics-empty__desc">
                        {currentTrack
                          ? t('status.noLyricsDetail', { title: currentTrack.title })
                          : t('status.selectTrackLyricsDetail')}
                      </div>
                      {currentTrack && (
                        <button
                          type="button"
                          className="fullscreen-reload-btn"
                          onClick={reloadLyrics}
                          title={t('status.searchLyricsFileAgain')}
                        >
                          <RotateCcw size={13} />
                          {t('common:actions.checkAgain')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Queue Panel */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, width: '100%', minWidth: 0, overflow: 'hidden' }}>
                <div className="fullscreen-queue-header">
                  <div>
                    <div className="fullscreen-queue-title">{t('status.upNextTitle')}</div>
                    <div className="fullscreen-queue-subtitle">
                      {t('library:counts.track', { count: queue.length })}
                    </div>
                  </div>
                  {queue.length > 0 && (
                    <button
                      type="button"
                      className="fullscreen-reload-btn"
                      onClick={clearQueue}
                      title={t('status.clearQueueShort')}
                      style={{ padding: '4px 10px' }}
                    >
                      <Trash2 size={12} />
                      {t('common:actions.clear')}
                    </button>
                  )}
                </div>

                <div className="fullscreen-queue-list">
                  {queue.length === 0 ? (
                    <div className="fullscreen-lyrics-empty">
                      <div className="fullscreen-lyrics-empty__desc">{t('status.noTracksInQueue')}</div>
                    </div>
                  ) : (
                    queue.map((track, idx) => {
                      const isCurrent = idx === queueIndex

                      return (
                        <div
                          key={`${track.id}-${idx}`}
                          className={`fullscreen-queue-item ${isCurrent ? 'is-current' : ''}`}
                          onClick={() => play(track, queue)}
                        >
                          <span className="fullscreen-queue-index">{idx + 1}</span>
                          <div style={{ minWidth: 0 }}>
                            <div className="fullscreen-queue-item-title">{track.title}</div>
                            <div className="fullscreen-queue-item-artist">
                              {track.artist ?? track.album_artist ?? t('common:fallbacks.unknownArtist')}
                            </div>
                          </div>
                          <span className="fullscreen-queue-item-duration">{fmt(track.duration)}</span>
                          <div
                            className="fullscreen-queue-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="queue-icon-btn"
                              disabled={idx === 0}
                              onClick={() => moveQueueItem(idx, idx - 1)}
                              title={t('common:actions.moveUp')}
                            >
                              <ChevronUp size={13} />
                            </button>
                            <button
                              type="button"
                              className="queue-icon-btn"
                              disabled={idx === queue.length - 1}
                              onClick={() => moveQueueItem(idx, idx + 1)}
                              title={t('common:actions.moveDown')}
                            >
                              <ChevronDown size={13} />
                            </button>
                            <button
                              type="button"
                              className="queue-icon-btn queue-icon-btn--danger"
                              onClick={() => removeFromQueue(idx)}
                              title={t('common:actions.removeFromQueue')}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
