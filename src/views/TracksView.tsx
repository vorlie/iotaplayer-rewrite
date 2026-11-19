import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  GripVertical,
  Heart,
  Search,
  Trash2,
} from 'lucide-react'
import { useFormatDuration, useTracks } from '../hooks/useLibrary'
import { useAppStore, usePlaybackStore } from '../store'
import type { Track } from '../types/electron'
import '../styles/library.css'

export type TrackSortField = 'default' | 'title' | 'artist' | 'album' | 'year' | 'duration'
export type SortOrder = 'asc' | 'desc'

interface TrackRowProps {
  track: Track
  index: number
  totalTracks: number
  showAlbum?: boolean
  showArtwork?: boolean
  isPlaying?: boolean
  hasActions?: boolean
  draggable?: boolean
  isDragging?: boolean
  dragOverIndicator?: 'top' | 'bottom' | null
  onClick: () => void
  onRemove?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: () => void
  onDrop?: (e: React.DragEvent) => void
}

function TrackRow({
  track,
  index,
  totalTracks,
  showAlbum = true,
  isPlaying = false,
  hasActions = false,
  draggable = false,
  isDragging = false,
  dragOverIndicator = null,
  onClick,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: TrackRowProps) {
  const { t } = useTranslation(['library', 'common', 'playlists'])
  const fmt = useFormatDuration()
  const navigate = useAppStore((s) => s.navigate)
  const { playlists, addTrackToPlaylist, favoriteIds, toggleFavorite } = usePlaybackStore()
  const isFav = favoriteIds.includes(track.id)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')

  function handleContextMenu(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsCreatingPlaylist(false)
    setNewPlaylistName(track.title)
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  function handleCreatePlaylistSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = newPlaylistName.trim()
    if (!name) return
    usePlaybackStore.getState().createPlaylist(name, [track])
    setIsCreatingPlaylist(false)
    setContextMenu(null)
  }

  const rowClasses = [
    'track-row',
    isPlaying ? 'playing' : '',
    !showAlbum ? 'no-album' : '',
    hasActions ? 'has-actions' : '',
    isDragging ? 'is-dragging' : '',
    dragOverIndicator === 'top' ? 'drag-over-top' : '',
    dragOverIndicator === 'bottom' ? 'drag-over-bottom' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div
        className={rowClasses}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDoubleClick={onClick}
        onContextMenu={handleContextMenu}
      >
        <div className={`track-num ${isPlaying ? 'track-num--playing' : ''}`}>
          {draggable ? (
            <span className="drag-handle" title={t('common:actions.dragToReorder')}>
              <GripVertical size={13} />
            </span>
          ) : isPlaying ? (
            '▶'
          ) : (
            track.track_number ?? index + 1
          )}
        </div>

        <button
          className={`track-fav-btn ${isFav ? 'is-fav' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            void toggleFavorite(track)
          }}
          title={isFav ? t('common:actions.removeFromFavorites') : t('common:actions.addToFavorites')}
        >
          <Heart size={14} fill={isFav ? 'currentColor' : 'none'} />
        </button>

        <div className="track-info">
          <div className="track-name-block">
            <div className="track-title">{track.title}</div>
            <div
              className="track-artist-small"
              onClick={(e) => {
                e.stopPropagation()
                if (track.artist_id) navigate('artist-detail', { artistId: track.artist_id })
              }}
              style={{ cursor: track.artist_id ? 'pointer' : 'default' }}
            >
              {track.artist ?? track.album_artist ?? '—'}
            </div>
          </div>
        </div>

        {showAlbum && (
          <div className="track-album">{track.album ?? '—'}</div>
        )}

        <div className="track-year">{track.year ?? '—'}</div>
        <div className="track-duration">{fmt(track.duration)}</div>

        {hasActions && (
          <div className="playlist-track-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="queue-icon-btn"
              disabled={index === 0}
              onClick={onMoveUp}
              title={t('common:actions.moveUp')}
              style={{ opacity: index === 0 ? 0.3 : 1 }}
            >
              <ArrowUp size={13} />
            </button>
            <button
              className="queue-icon-btn"
              disabled={index === totalTracks - 1}
              onClick={onMoveDown}
              title={t('common:actions.moveDown')}
              style={{ opacity: index === totalTracks - 1 ? 0.3 : 1 }}
            >
              <ArrowDown size={13} />
            </button>
            <button
              className="queue-icon-btn queue-icon-btn--danger"
              onClick={onRemove}
              title={t('common:actions.removeFromPlaylist')}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {contextMenu && (
        <div className="context-menu-backdrop" onClick={() => setContextMenu(null)}>
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                void toggleFavorite(track)
                setContextMenu(null)
              }}
            >
              {isFav ? t('common:actions.removeFromFavorites') : t('common:actions.addToFavorites')}
            </button>

            {onRemove && (
              <button
                type="button"
                className="context-menu-item"
                style={{ color: '#ef4444' }}
                onClick={() => {
                  onRemove()
                  setContextMenu(null)
                }}
              >
                {t('common:actions.removeFromPlaylist')}
              </button>
            )}

            <div className="context-menu-header">{t('playlists:actions.addToPlaylist')}</div>
            {playlists.length === 0 ? (
              <div className="context-menu-empty">{t('playlists:empty.noPlaylists')}</div>
            ) : (
              playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    addTrackToPlaylist(playlist.id, track)
                    setContextMenu(null)
                  }}
                >
                  {playlist.name}
                </button>
              ))
            )}
            {isCreatingPlaylist ? (
              <form className="context-menu-inline-form" onSubmit={handleCreatePlaylistSubmit}>
                <input
                  type="text"
                  className="context-menu-inline-input"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder={t('playlists:actions.newPlaylistPrompt')}
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
                />
                <div className="context-menu-inline-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                    onClick={() => setIsCreatingPlaylist(false)}
                  >
                    {t('common:actions.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="detail-play-btn"
                    style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                    disabled={!newPlaylistName.trim()}
                  >
                    {t('common:actions.save')}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="context-menu-item context-menu-item--primary"
                onClick={() => {
                  setNewPlaylistName(track.title)
                  setIsCreatingPlaylist(true)
                }}
              >
                {t('playlists:actions.newPlaylistEllipsis')}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export interface TracksTableProps {
  tracks: Track[]
  showAlbum?: boolean
  enableSorting?: boolean
  onRemoveTrack?: (index: number) => void
  onMoveTrack?: (fromIndex: number, toIndex: number) => void
}

export function TracksTable({
  tracks,
  showAlbum = true,
  enableSorting = false,
  onRemoveTrack,
  onMoveTrack,
}: TracksTableProps) {
  const { t } = useTranslation('library')
  const { play, currentTrack, isPlaying } = usePlaybackStore()
  const hasActions = Boolean(onRemoveTrack || onMoveTrack)
  const isDraggable = Boolean(onMoveTrack)

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverInfo, setDragOverInfo] = useState<{ index: number; position: 'top' | 'bottom' } | null>(null)

  // Optional sorting state
  const [sortField, setSortField] = useState<TrackSortField>('default')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const handleHeaderSort = (field: TrackSortField) => {
    if (!enableSorting) return
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc')
      } else {
        setSortField('default')
        setSortOrder('asc')
      }
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const sortedTracks = useMemo(() => {
    if (!enableSorting || sortField === 'default') {
      return tracks
    }

    return [...tracks].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'artist':
          comparison = (a.artist ?? a.album_artist ?? '').localeCompare(b.artist ?? b.album_artist ?? '')
          break
        case 'album':
          comparison = (a.album ?? '').localeCompare(b.album ?? '')
          break
        case 'year':
          comparison = (a.year ?? 0) - (b.year ?? 0)
          break
        case 'duration':
          comparison = a.duration - b.duration
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [tracks, sortField, sortOrder, enableSorting])

  const headerClasses = [
    'tracks-header',
    !showAlbum ? 'no-album' : '',
    hasActions ? 'has-actions' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const renderSortIndicator = (field: TrackSortField) => {
    if (!enableSorting) return null
    if (sortField !== field) {
      return <ArrowUpDown size={11} style={{ opacity: 0.3 }} />
    }
    return sortOrder === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
  }

  return (
    <div className="tracks-table">
      <div className={headerClasses}>
        <span>{t('tracks.columns.number')}</span>
        <span title={t('favorites.title')}>
          <Heart size={12} />
        </span>
        <span
          className={enableSorting ? 'sortable-header' : ''}
          onClick={() => handleHeaderSort('title')}
        >
          {t('tracks.columns.title')} {renderSortIndicator('title')}
        </span>
        {showAlbum && (
          <span
            className={enableSorting ? 'sortable-header' : ''}
            onClick={() => handleHeaderSort('album')}
          >
            {t('tracks.columns.album')} {renderSortIndicator('album')}
          </span>
        )}
        <span
          className={enableSorting ? 'sortable-header' : ''}
          onClick={() => handleHeaderSort('year')}
        >
          {t('tracks.columns.year')} {renderSortIndicator('year')}
        </span>
        <span
          style={{ textAlign: 'right', justifyContent: 'flex-end' }}
          className={enableSorting ? 'sortable-header' : ''}
          onClick={() => handleHeaderSort('duration')}
        >
          {t('tracks.columns.time')} {renderSortIndicator('duration')}
        </span>
        {hasActions && <span style={{ textAlign: 'center' }}>{t('tracks.columns.actions')}</span>}
      </div>

      {sortedTracks.map((track, i) => (
        <TrackRow
          key={`${track.id}-${i}`}
          track={track}
          index={i}
          totalTracks={sortedTracks.length}
          showAlbum={showAlbum}
          isPlaying={currentTrack?.id === track.id && isPlaying}
          hasActions={hasActions}
          draggable={isDraggable && sortField === 'default'}
          isDragging={draggedIndex === i}
          dragOverIndicator={dragOverInfo?.index === i ? dragOverInfo.position : null}
          onClick={() => play(track, sortedTracks)}
          onRemove={onRemoveTrack ? () => onRemoveTrack(i) : undefined}
          onMoveUp={onMoveTrack && i > 0 ? () => onMoveTrack(i, i - 1) : undefined}
          onMoveDown={onMoveTrack && i < sortedTracks.length - 1 ? () => onMoveTrack(i, i + 1) : undefined}
          onDragStart={(e) => {
            setDraggedIndex(i)
            e.dataTransfer.setData('text/plain', String(i))
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={(e) => {
            if (!isDraggable || draggedIndex === null) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            const rect = e.currentTarget.getBoundingClientRect()
            const mid = rect.top + rect.height / 2
            const pos = e.clientY < mid ? 'top' : 'bottom'
            setDragOverInfo({ index: i, position: pos })
          }}
          onDragLeave={() => {
            setDragOverInfo((prev) => (prev?.index === i ? null : prev))
          }}
          onDrop={(e) => {
            if (!isDraggable || onMoveTrack == null) return
            e.preventDefault()
            const sourceIndex = Number(e.dataTransfer.getData('text/plain'))
            const targetIndex = i
            setDraggedIndex(null)
            setDragOverInfo(null)
            if (!isNaN(sourceIndex) && sourceIndex !== targetIndex) {
              onMoveTrack(sourceIndex, targetIndex)
            }
          }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Full tracks view page
// ---------------------------------------------------------------------------

export function TracksView() {
  const { t } = useTranslation('library')
  const { tracks, loading } = useTracks({ limit: 1000 })
  const [filterQuery, setFilterQuery] = useState('')
  const fmt = useFormatDuration()

  const filteredTracks = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    if (!q) return tracks

    return tracks.filter((track) => {
      const title = track.title.toLowerCase()
      const artist = (track.artist ?? track.album_artist ?? '').toLowerCase()
      const album = (track.album ?? '').toLowerCase()
      const genre = (track.genre ?? '').toLowerCase()
      const year = track.year ? String(track.year) : ''

      return (
        title.includes(q) ||
        artist.includes(q) ||
        album.includes(q) ||
        genre.includes(q) ||
        year.includes(q)
      )
    })
  }, [tracks, filterQuery])

  const totalDuration = filteredTracks.reduce((sum, t) => sum + t.duration, 0)

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">{t('tracks.loading')}</div>
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-title">{t('tracks.emptyTitle')}</div>
          <div className="empty-state-body">
            {t('tracks.emptyBody')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">{t('tracks.title')}</h1>
            <p className="page-subtitle">
              {filterQuery
                ? t('counts.showingOfTracks', { shown: filteredTracks.length, total: tracks.length, duration: fmt(totalDuration) })
                : t('counts.tracksDuration', { count: tracks.length, duration: fmt(totalDuration) })}
            </p>
          </div>

          <div className="search-filter-wrapper">
            <Search size={14} className="search-filter-icon" />
            <input
              type="text"
              placeholder={t('tracks.filterPlaceholder')}
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="search-filter-input"
            />
          </div>
        </div>
      </div>

      <div className="page-body">
        {filteredTracks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">{t('tracks.noMatchingTitle')}</div>
            <div className="empty-state-body">{t('tracks.noMatchingBody', { query: filterQuery })}</div>
          </div>
        ) : (
          <TracksTable tracks={filteredTracks} showAlbum enableSorting />
        )}
      </div>
    </div>
  )
}
