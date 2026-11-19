import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { AlbumCard } from '../components/AlbumCard'
import { useAlbums } from '../hooks/useLibrary'
import { useAppStore } from '../store'
import '../styles/library.css'

type AlbumSort = 'artist-asc' | 'title-asc' | 'title-desc' | 'year-desc' | 'year-asc' | 'tracks-desc'

export function AlbumsView() {
  const { t } = useTranslation('library')
  const { albums, loading } = useAlbums()
  const { navigate } = useAppStore()
  const [filterQuery, setFilterQuery] = useState('')
  const [sortBy, setSortBy] = useState<AlbumSort>('artist-asc')

  const filteredAndSortedAlbums = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    const list = q
      ? albums.filter((album) => {
          const title = album.title.toLowerCase()
          const artist = (album.artist_name ?? '').toLowerCase()
          const year = album.year ? String(album.year) : ''
          return title.includes(q) || artist.includes(q) || year.includes(q)
        })
      : [...albums]

    return list.sort((a, b) => {
      switch (sortBy) {
        case 'title-asc':
          return a.title.localeCompare(b.title)
        case 'title-desc':
          return b.title.localeCompare(a.title)
        case 'artist-asc': {
          const artComp = (a.artist_name ?? '').localeCompare(b.artist_name ?? '')
          if (artComp !== 0) return artComp
          return (a.year ?? 0) - (b.year ?? 0)
        }
        case 'year-desc':
          return (b.year ?? 0) - (a.year ?? 0)
        case 'year-asc':
          return (a.year ?? 0) - (b.year ?? 0)
        case 'tracks-desc':
          return b.track_count - a.track_count
        default:
          return 0
      }
    })
  }, [albums, filterQuery, sortBy])

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">{t('albums.loading')}</div>
      </div>
    )
  }

  if (albums.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-title">{t('albums.emptyTitle')}</div>
          <div className="empty-state-body">
            {t('albums.emptyBody')}
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
            <h1 className="page-title">{t('albums.title')}</h1>
            <p className="page-subtitle">
              {filterQuery
                ? t('counts.showingOfAlbums', { shown: filteredAndSortedAlbums.length, total: albums.length })
                : t('counts.album', { count: albums.length })}
            </p>
          </div>

          <div className="view-toolbar" style={{ margin: 0 }}>
            <div className="search-filter-wrapper">
              <Search size={14} className="search-filter-icon" />
              <input
                type="text"
                placeholder={t('albums.filterPlaceholder')}
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="search-filter-input"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as AlbumSort)}
              className="sort-select"
            >
              <option value="artist-asc">{t('albums.sort.artist')}</option>
              <option value="title-asc">{t('albums.sort.titleAsc')}</option>
              <option value="title-desc">{t('albums.sort.titleDesc')}</option>
              <option value="year-desc">{t('albums.sort.yearDesc')}</option>
              <option value="year-asc">{t('albums.sort.yearAsc')}</option>
              <option value="tracks-desc">{t('albums.sort.mostTracks')}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="page-body">
        {filteredAndSortedAlbums.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">{t('albums.noMatchingTitle')}</div>
            <div className="empty-state-body">{t('albums.noMatchingBody', { query: filterQuery })}</div>
          </div>
        ) : (
          <div className="albums-grid">
            {filteredAndSortedAlbums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                onClick={() => navigate('album-detail', { albumId: album.id })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
