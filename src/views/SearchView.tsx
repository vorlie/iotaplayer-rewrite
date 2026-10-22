import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { AlbumCard } from '../components/AlbumCard'
import { useAppStore } from '../store'
import type { SearchResults } from '../types/electron'
import { TracksTable } from './TracksView'
import '../styles/library.css'

type SearchFilterCategory = 'all' | 'tracks' | 'albums' | 'artists'

export function SearchView() {
  const { nav, navigate, setSearch } = useAppStore()
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState<SearchFilterCategory>('all')

  const query = nav.searchQuery
  const trimmed = query.trim()

  useEffect(() => {
    if (!trimmed) {
      return
    }

    const timeout = setTimeout(() => {
      setLoading(true)
      window.library.search(trimmed).then((r) => {
        setResults(r)
        setLoading(false)
      })
    }, 180) // debounce

    return () => clearTimeout(timeout)
  }, [trimmed])

  const activeResults = trimmed ? results : null
  const totalMatches =
    (activeResults?.artists.length ?? 0) +
    (activeResults?.albums.length ?? 0) +
    (activeResults?.tracks.length ?? 0)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Search</h1>
        <div style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="search-filter-wrapper" style={{ width: '100%', maxWidth: 440 }}>
            <Search size={16} className="search-filter-icon" />
            <input
              type="text"
              placeholder="Search artists, albums, tracks, genre..."
              value={query}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="search-filter-input"
              style={{ width: '100%', paddingLeft: 34, fontSize: 'var(--text-base)', height: 38 }}
            />
          </div>

          {activeResults && totalMatches > 0 && (
            <div className="filter-tab-bar">
              <button
                className={`filter-tab ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >
                All ({totalMatches})
              </button>
              {activeResults.tracks.length > 0 && (
                <button
                  className={`filter-tab ${activeCategory === 'tracks' ? 'active' : ''}`}
                  onClick={() => setActiveCategory('tracks')}
                >
                  Tracks ({activeResults.tracks.length})
                </button>
              )}
              {activeResults.albums.length > 0 && (
                <button
                  className={`filter-tab ${activeCategory === 'albums' ? 'active' : ''}`}
                  onClick={() => setActiveCategory('albums')}
                >
                  Albums ({activeResults.albums.length})
                </button>
              )}
              {activeResults.artists.length > 0 && (
                <button
                  className={`filter-tab ${activeCategory === 'artists' ? 'active' : ''}`}
                  onClick={() => setActiveCategory('artists')}
                >
                  Artists ({activeResults.artists.length})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="page-body">
        {loading && <div className="loading-state">Searching library…</div>}

        {!loading && activeResults && query.trim() && (
          <>
            {/* Artists */}
            {(activeCategory === 'all' || activeCategory === 'artists') &&
              activeResults.artists.length > 0 && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <div className="section-header">
                    <h2 className="section-title">Artists</h2>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-3)' }}>
                      {activeResults.artists.length} found
                    </span>
                  </div>
                  <div className="artists-list">
                    {activeResults.artists.map((artist) => (
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
                </div>
              )}

            {/* Albums */}
            {(activeCategory === 'all' || activeCategory === 'albums') &&
              activeResults.albums.length > 0 && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <div className="section-header">
                    <h2 className="section-title">Albums</h2>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-3)' }}>
                      {activeResults.albums.length} found
                    </span>
                  </div>
                  <div className="albums-grid">
                    {activeResults.albums.map((album) => (
                      <AlbumCard
                        key={album.id}
                        album={album}
                        onClick={() => navigate('album-detail', { albumId: album.id })}
                      />
                    ))}
                  </div>
                </div>
              )}

            {/* Tracks */}
            {(activeCategory === 'all' || activeCategory === 'tracks') &&
              activeResults.tracks.length > 0 && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <div className="section-header">
                    <h2 className="section-title">Tracks</h2>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-3)' }}>
                      {activeResults.tracks.length} found
                    </span>
                  </div>
                  <TracksTable tracks={activeResults.tracks} showAlbum />
                </div>
              )}

            {totalMatches === 0 && (
              <div className="empty-state">
                <div className="empty-state-title">No results</div>
                <div className="empty-state-body">Nothing in your library matched "{query}"</div>
              </div>
            )}
          </>
        )}

        {!query.trim() && !loading && (
          <div className="empty-state">
            <div className="empty-state-title">Search your library</div>
            <div className="empty-state-body">
              Type to search by artist, album, track title, or genre.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
