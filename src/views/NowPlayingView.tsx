import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Heart,
  Maximize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  Shuffle,
  Trash2,
  Volume2,
  X,
} from 'lucide-react'
import {
  formatLyricsSourceLabel,
  getActiveLyricIndex,
  getLineWordSyncStates,
} from '../../electron/lyricsSync'
import {
  useArtwork,
  useFormatDuration,
  useInterpolatedPosition,
  useLyrics,
} from '../hooks/useLibrary'
import { useAppStore, usePlaybackStore } from '../store'
import { LyricGapIndicator } from '../components/LyricGapIndicator'
import '../styles/now-playing.css'

export function NowPlayingView() {
  const setFullscreen = useAppStore((s) => s.setFullscreenNowPlaying)
  const fmt = useFormatDuration()
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    volume,
    queue,
    queueIndex,
    playlistName,
    repeatMode,
    shuffle,
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

  const artworkSrc = useArtwork(currentTrack?.artwork_id)
  const isFav = currentTrack ? favoriteIds.includes(currentTrack.id) : false
  const progress = duration > 0 ? (position / duration) * 100 : 0
  const [contextMenu, setContextMenu] = useState<{ track: NonNullable<typeof currentTrack>; x: number; y: number } | null>(null)
  const { lyrics, loading: lyricsLoading, reload: reloadLyrics } = useLyrics(currentTrack?.id)
  const [queuePanelWidth, setQueuePanelWidth] = useState(300)
  const lyricsListRef = useRef<HTMLDivElement>(null)
  const userScrolledLyricsUntil = useRef(0)
  const isLyricsPointerDown = useRef(false)
  const resizeState = useRef<{ active: boolean; startX: number; startWidth: number }>({ active: false, startX: 0, startWidth: 300 })

  // Drag and drop state for queue reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverInfo, setDragOverInfo] = useState<{ index: number; position: 'top' | 'bottom' } | null>(null)

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!resizeState.current.active) return

      const nextWidth = resizeState.current.startWidth - (event.clientX - resizeState.current.startX)
      const clampedWidth = Math.min(500, Math.max(240, nextWidth))
      setQueuePanelWidth(clampedWidth)
    }

    const handlePointerUp = () => {
      resizeState.current.active = false
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [])

  const syncPosition = useInterpolatedPosition(
    position,
    isPlaying,
    lyrics,
    true,
    duration,
  )
  const activeLyricIndex = getActiveLyricIndex(lyrics, syncPosition)
  const lyricsSource = formatLyricsSourceLabel(lyrics)

  useEffect(() => {
    if (activeLyricIndex < 0 || isLyricsPointerDown.current || Date.now() < userScrolledLyricsUntil.current) return
    const container = lyricsListRef.current
    if (!container) return
    const line = container.querySelector<HTMLElement>(`[data-lyric-index="${activeLyricIndex}"]`)
    if (line) {
      const containerRect = container.getBoundingClientRect()
      const lineRect = line.getBoundingClientRect()
      const targetTop =
        container.scrollTop +
        (lineRect.top - containerRect.top) -
        container.clientHeight / 2 +
        lineRect.height / 2
      container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
    }
  }, [activeLyricIndex])

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

  function handleTrackContextMenu(track: NonNullable<typeof currentTrack>, e: React.MouseEvent<HTMLElement>) {
    e.preventDefault()
    setContextMenu({ track, x: e.clientX, y: e.clientY })
  }

  const repeatLabel = repeatMode === 'off' ? 'Repeat off' : repeatMode === 'all' ? 'Repeat all' : 'Repeat one'

  const nowPlayingStyle = {
    ['--queue-panel-width' as string]: `${queuePanelWidth}px`,
  } as CSSProperties

  const beginResize = (event: React.PointerEvent<HTMLDivElement>) => {
    resizeState.current = {
      active: true,
      startX: event.clientX,
      startWidth: queuePanelWidth,
    }
    event.preventDefault()
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Now Playing</h1>
          <p className="page-subtitle">{playlistName}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="queue-action-btn"
            onClick={() => setFullscreen(true)}
            title="Open Immersive Fullscreen Now Playing (F)"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px' }}
          >
            <Maximize2 size={13} />
            Fullscreen
          </button>
          <span
            className={`player-backend-badge player-backend-badge--${activeBackend}`}
            title={`Active playback backend: ${activeBackend.toUpperCase()}`}
          >
            {activeBackend}
          </span>
        </div>
      </div>

      <div className="page-body now-playing-page" style={nowPlayingStyle}>
        <aside className="now-playing-panel now-playing-main-panel">
          <div className="now-playing-artwork">
            {artworkSrc ? (
              <img src={artworkSrc} alt={currentTrack?.title ?? 'Album art'} />
            ) : (
              <div className="now-playing-artwork-placeholder">♫</div>
            )}
          </div>

          <div className="now-playing-meta">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="now-playing-section-label">Now playing</div>
              {currentTrack && (
                <button
                  className={`player-fav-btn ${isFav ? 'is-fav' : ''}`}
                  onClick={() => toggleFavorite(currentTrack)}
                  title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                >
                  <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
                </button>
              )}
            </div>
            <div className="now-playing-title">{currentTrack?.title ?? 'No track selected'}</div>
            <div className="now-playing-subtitle">{currentTrack?.artist ?? currentTrack?.album_artist ?? 'Unknown artist'}</div>
            <div className="now-playing-subtitle">{currentTrack?.album ?? 'Unknown album'}</div>
          </div>

          <div className="now-playing-progress-block">
            <div className="player-progress now-playing-progress-row">
              <span className="player-time">{fmt(position)}</span>
              <div className="progress-track now-playing-progress-track" onClick={handleProgressClick}>
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="player-time player-time--end">{fmt(duration)}</span>
            </div>
          </div>

          <div className="now-playing-controls">
            <button className={`player-btn ${shuffle ? 'is-active' : ''}`} title={shuffle ? 'Shuffle on' : 'Shuffle off'} onClick={toggleShuffle}>
              <Shuffle size={16} />
            </button>
            <button className="player-btn" onClick={previous} title="Previous">
              <ChevronLeft size={18} />
            </button>
            <button className="player-btn player-btn--play" onClick={toggle} title="Play/Pause">
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <button className="player-btn" onClick={next} title="Next">
              <ChevronRight size={18} />
            </button>
            <button
              className={`player-btn ${repeatMode !== 'off' ? 'is-active' : ''} ${repeatMode === 'one' ? 'is-repeat-one' : ''}`}
              title={repeatLabel}
              onClick={toggleRepeat}
            >
              {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            </button>
          </div>

          <div className="now-playing-volume-row">
            <Volume2 size={14} />
            <div className="volume-track now-playing-volume-track" onClick={handleVolumeClick}>
              <div className="volume-fill" style={{ width: `${volume * 100}%` }} />
            </div>
          </div>
        </aside>

        <section className="now-playing-panel now-playing-queue-panel" style={{ minWidth: 0 }}>
          <div className="now-playing-queue-top">
            <div>
              <div className="now-playing-queue-header" style={{ margin: 0, padding: 0 }}>Up next</div>
              <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{queue.length} tracks · Drag to reorder</span>
            </div>
            {queue.length > 0 && (
              <button
                className="queue-action-btn"
                onClick={clearQueue}
                title="Clear all tracks except currently playing"
              >
                <Trash2 size={12} />
                Clear
              </button>
            )}
          </div>

          {queue.length === 0 ? (
            <div className="now-playing-empty-state">No tracks in the queue yet.</div>
          ) : (
            <div className="now-playing-queue-list">
              {queue.map((track, index) => {
                const isCurrent = index === queueIndex
                const isDragging = draggedIndex === index
                const dragIndicatorClass =
                  dragOverInfo?.index === index
                    ? dragOverInfo.position === 'top'
                      ? 'drag-over-top'
                      : 'drag-over-bottom'
                    : ''

                return (
                  <div
                    key={`${track.id}-${index}`}
                    className={`now-playing-track-item ${isCurrent ? 'is-current' : ''} ${isDragging ? 'is-dragging' : ''} ${dragIndicatorClass}`}
                    draggable
                    onDragStart={(e) => {
                      setDraggedIndex(index)
                      e.dataTransfer.setData('text/plain', String(index))
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragOver={(e) => {
                      if (draggedIndex === null) return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      const rect = e.currentTarget.getBoundingClientRect()
                      const mid = rect.top + rect.height / 2
                      const pos = e.clientY < mid ? 'top' : 'bottom'
                      setDragOverInfo({ index, position: pos })
                    }}
                    onDragLeave={() => {
                      setDragOverInfo((prev) => (prev?.index === index ? null : prev))
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const sourceIndex = Number(e.dataTransfer.getData('text/plain'))
                      setDraggedIndex(null)
                      setDragOverInfo(null)
                      if (!isNaN(sourceIndex) && sourceIndex !== index) {
                        moveQueueItem(sourceIndex, index)
                      }
                    }}
                    onClick={() => play(track, queue, playlistName)}
                    onContextMenu={(e) => handleTrackContextMenu(track, e)}
                    style={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }}
                  >
                    <span className="drag-handle" style={{ marginRight: 4 }}>
                      <GripVertical size={13} />
                    </span>
                    <span className={`now-playing-track-index ${isCurrent ? 'is-current' : ''}`}>{index + 1}</span>
                    <div className="now-playing-track-text" style={{ flex: 1, minWidth: 0 }}>
                      <div className="now-playing-track-name">{track.title}</div>
                      <div className="now-playing-track-artist">{track.artist ?? track.album_artist ?? 'Unknown artist'}</div>
                    </div>
                    <span className="now-playing-track-duration" style={{ marginRight: 8 }}>{fmt(track.duration)}</span>
                    <div className="queue-item-controls" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="queue-icon-btn"
                        disabled={index === 0}
                        onClick={() => moveQueueItem(index, index - 1)}
                        title="Move up"
                        style={{ opacity: index === 0 ? 0.3 : 1 }}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        className="queue-icon-btn"
                        disabled={index === queue.length - 1}
                        onClick={() => moveQueueItem(index, index + 1)}
                        title="Move down"
                        style={{ opacity: index === queue.length - 1 ? 0.3 : 1 }}
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        className="queue-icon-btn queue-icon-btn--danger"
                        onClick={() => removeFromQueue(index)}
                        title="Remove from queue"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div className="now-playing-splitter" onPointerDown={beginResize} aria-label="Resize queue panel" />


        <section className="now-playing-panel now-playing-lyrics-panel">
          <div className="now-playing-lyrics-top" style={{ justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div className="now-playing-queue-header" style={{ margin: 0, padding: 0 }}>Lyrics</div>
              {lyricsSource && <span className="now-playing-lyrics-source">{lyricsSource}</span>}
            </div>
            {currentTrack && (
              <button
                type="button"
                className="queue-action-btn"
                onClick={reloadLyrics}
                title="Search for lyrics again"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <RotateCcw size={12} />
                Check Again
              </button>
            )}
          </div>

          <div
            ref={lyricsListRef}
            className={`now-playing-lyrics ${lyrics.synchronized ? 'is-synced' : ''}`}
            onWheel={() => { userScrolledLyricsUntil.current = Date.now() + 3500 }}
            onTouchMove={() => { userScrolledLyricsUntil.current = Date.now() + 3500 }}
            onPointerDown={() => { isLyricsPointerDown.current = true }}
            onPointerUp={() => {
              isLyricsPointerDown.current = false
              userScrolledLyricsUntil.current = Date.now() + 3500
            }}
            onPointerCancel={() => { isLyricsPointerDown.current = false }}
          >
            <div className="now-playing-lyrics-list">
              {lyricsLoading ? (
                <div className="now-playing-empty-state">Loading lyrics…</div>
              ) : lyrics.lines.length ? (
                lyrics.lines.map((line, index) => {
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
                        variant="normal"
                      />
                    )
                  }

                  const words = line.words && line.words.length > 0 ? line.words : null
                  const nextLineTimestamp = lyrics.lines[index + 1]?.timestamp
                  const wordStates =
                    words && isActive
                      ? getLineWordSyncStates(line, syncPosition, nextLineTimestamp)
                      : null
                  const hasEmbeddedSpaces = words ? words.some((w) => /\s/.test(w.text)) : false
                  const hasLineSpaces = words ? /\s/.test(line.text) : false

                  return (
                    <button
                      key={`${line.timestamp ?? 'text'}-${index}`}
                      type="button"
                      data-lyric-index={index}
                      className={`lyric-line ${isActive ? 'is-active' : ''} ${words ? 'is-word-synced' : ''}`}
                      disabled={line.timestamp == null || !line.text}
                      onClick={() => line.timestamp != null && seek(line.timestamp)}
                      title={line.timestamp != null ? `Seek to ${fmt(line.timestamp)}` : undefined}
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
                              (!hasEmbeddedSpaces && hasLineSpaces && wIdx < words.length - 1)
                            const needsLeadingSpace =
                              /^\s/.test(word.text) &&
                              wIdx > 0 &&
                              !/\s$/.test(words[wIdx - 1].text)

                            return (
                              <span key={`${word.timestamp}-${wIdx}`} className="lyric-word-group">
                                {needsLeadingSpace ? ' ' : null}
                                <span
                                  className={`lyric-word is-${status}`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    seek(word.timestamp)
                                  }}
                                  title={`Seek to "${visibleText}" (${fmt(word.timestamp)})`}
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
                })
              ) : (
                <div className="now-playing-lyrics-empty">
                  <div>
                    {currentTrack
                      ? 'No lyrics found. Add a matching .lrc, .lyricsfile.yaml, or .txt file, or use embedded lyrics.'
                      : 'Choose a track to see its lyrics.'}
                  </div>
                  {currentTrack && (
                    <button
                      type="button"
                      className="queue-action-btn"
                      onClick={reloadLyrics}
                      title="Search for lyrics file again"
                      style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <RotateCcw size={12} />
                      Check Again
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {contextMenu && (
        <div className="context-menu-backdrop" onClick={() => setContextMenu(null)}>
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="context-menu-header">Add to playlist</div>
            {usePlaybackStore.getState().playlists.length === 0 ? (
              <div className="context-menu-empty">No playlists yet</div>
            ) : (
              usePlaybackStore.getState().playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    usePlaybackStore.getState().addTrackToPlaylist(playlist.id, contextMenu.track)
                    setContextMenu(null)
                  }}
                >
                  {playlist.name}
                </button>
              ))
            )}
            <button
              type="button"
              className="context-menu-item context-menu-item--primary"
              onClick={() => {
                const name = window.prompt('New playlist name', contextMenu.track.title)?.trim()
                if (!name) return
                usePlaybackStore.getState().createPlaylist(name, [contextMenu.track])
                setContextMenu(null)
              }}
            >
              New playlist…
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
