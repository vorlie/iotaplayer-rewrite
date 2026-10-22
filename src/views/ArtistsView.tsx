import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useArtists } from '../hooks/useLibrary'
import { useAppStore } from '../store'
import '../styles/library.css'

type ArtistSort = 'name-asc' | 'name-desc' | 'albums-desc' | 'tracks-desc'

export function ArtistsView() {
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
        <div className="loading-state">Loading artists…</div>
      </div>
    )
  }

  if (artists.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-title">No artists yet</div>
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
            <h1 className="page-title">Artists</h1>
            <p className="page-subtitle">
              {filterQuery
                ? `Showing ${filteredAndSortedArtists.length} of ${artists.length} artists`
                : `${artists.length} artists`}
            </p>
          </div>

          <div className="view-toolbar" style={{ margin: 0 }}>
            <div className="search-filter-wrapper">
              <Search size={14} className="search-filter-icon" />
              <input
                type="text"
                placeholder="Filter artists..."
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
              <option value="name-asc">Sort: Name (A-Z)</option>
              <option value="name-desc">Sort: Name (Z-A)</option>
              <option value="albums-desc">Sort: Most Albums</option>
              <option value="tracks-desc">Sort: Most Tracks</option>
            </select>
          </div>
        </div>
      </div>

      <div className="page-body">
        {filteredAndSortedArtists.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No matching artists</div>
            <div className="empty-state-body">No artists match your filter "{filterQuery}".</div>
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
                    {artist.album_count} {artist.album_count === 1 ? 'album' : 'albums'} ·{' '}
                    {artist.track_count} {artist.track_count === 1 ? 'track' : 'tracks'}
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
