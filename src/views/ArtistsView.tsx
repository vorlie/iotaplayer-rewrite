import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { useArtists } from '../hooks/useLibrary'
import { useAppStore } from '../store'
import '../styles/library.css'

type ArtistSort = 'name-asc' | 'name-desc' | 'albums-desc' | 'tracks-desc'

export function ArtistsView() {
  const { t } = useTranslation('library')
  const { artists, loading } = useArtists()
  const { navigate } = useAppStore()
  const [filterQuery, setFilterQuery] = useState('')
  const [sortBy, setSortBy] = useState<ArtistSort>('name-asc')

  const filteredAndSortedArtists = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    const list = q
      ? artists.filter((artist) => artist.name.toLowerCase().includes(q))
      : [...artists]

    return list.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name)
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'albums-desc':
          return b.album_count - a.album_count
        case 'tracks-desc':
          return b.track_count - a.track_count
        default:
          return 0
      }
    })
  }, [artists, filterQuery, sortBy])

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">{t('artists.loading')}</div>
      </div>
    )
  }

  if (artists.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-title">{t('artists.emptyTitle')}</div>
          <div className="empty-state-body">
            {t('artists.emptyBody')}
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
            <h1 className="page-title">{t('artists.title')}</h1>
            <p className="page-subtitle">
              {filterQuery
                ? t('counts.showingOfArtists', { shown: filteredAndSortedArtists.length, total: artists.length })
                : t('counts.artist', { count: artists.length })}
            </p>
          </div>

          <div className="view-toolbar" style={{ margin: 0 }}>
            <div className="search-filter-wrapper">
              <Search size={14} className="search-filter-icon" />
              <input
                type="text"
                placeholder={t('artists.filterPlaceholder')}
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="search-filter-input"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ArtistSort)}
              className="sort-select"
            >
              <option value="name-asc">{t('artists.sort.nameAsc')}</option>
              <option value="name-desc">{t('artists.sort.nameDesc')}</option>
              <option value="albums-desc">{t('artists.sort.mostAlbums')}</option>
              <option value="tracks-desc">{t('artists.sort.mostTracks')}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="page-body">
        {filteredAndSortedArtists.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">{t('artists.noMatchingTitle')}</div>
            <div className="empty-state-body">{t('artists.noMatchingBody', { query: filterQuery })}</div>
          </div>
        ) : (
          <div className="artists-list">
            {filteredAndSortedArtists.map((artist) => (
              <div
                key={artist.id}
                className="artist-row"
                onClick={() => navigate('artist-detail', { artistId: artist.id })}
              >
                <div className="artist-avatar">
                  {artist.name.charAt(0).toUpperCase()}
                </div>
                <div className="artist-info">
                  <div className="artist-name">{artist.name}</div>
                  <div className="artist-meta">
                    {t('counts.album', { count: artist.album_count })} ·{' '}
                    {t('counts.track', { count: artist.track_count })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
