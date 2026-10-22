import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { AlbumCard } from '../components/AlbumCard'
import { useAlbums } from '../hooks/useLibrary'
import { useAppStore } from '../store'
import '../styles/library.css'

type AlbumSort = 'artist-asc' | 'title-asc' | 'title-desc' | 'year-desc' | 'year-asc' | 'tracks-desc'

export function AlbumsView() {
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
        <div className="loading-state">Loading albums…</div>
      </div>
    )
  }

  if (albums.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-title">No albums yet</div>
          <div className="empty-state-body">
            Go to Settings and scan your music library to get started.
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
            <h1 className="page-title">Albums</h1>
            <p className="page-subtitle">
              {filterQuery
                ? `Showing ${filteredAndSortedAlbums.length} of ${albums.length} albums`
                : `${albums.length} albums`}
            </p>
          </div>

          <div className="view-toolbar" style={{ margin: 0 }}>
            <div className="search-filter-wrapper">
              <Search size={14} className="search-filter-icon" />
              <input
                type="text"
                placeholder="Filter albums..."
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
              <option value="artist-asc">Sort: Artist</option>
              <option value="title-asc">Sort: Title (A-Z)</option>
              <option value="title-desc">Sort: Title (Z-A)</option>
              <option value="year-desc">Sort: Year (Newest)</option>
              <option value="year-asc">Sort: Year (Oldest)</option>
              <option value="tracks-desc">Sort: Most Tracks</option>
            </select>
          </div>
        </div>
      </div>

      <div className="page-body">
        {filteredAndSortedAlbums.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No matching albums</div>
            <div className="empty-state-body">No albums match your filter "{filterQuery}".</div>
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
