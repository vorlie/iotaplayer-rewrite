import { useEffect, useState } from 'react'
import { AlbumCard } from '../components/AlbumCard'
import { useAppStore } from '../store'
import type { SearchResults } from '../types/electron'
import '../styles/library.css'

export function SearchView() {
  const { nav, navigate, setSearch } = useAppStore()
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)

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
    }, 200) // debounce

    return () => clearTimeout(timeout)
  }, [trimmed])

  const activeResults = trimmed ? results : null

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Search</h1>
        <div style={{ marginTop: 'var(--space-3)' }}>
          <input
            type="text"
            placeholder="Search artists, albums, tracks…"
            value={query}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            style={{ width: '100%', maxWidth: 480 }}
          />
        </div>
      </div>

      <div className="page-body">
        {loading && <div className="loading-state">Searching…</div>}

        {!loading && activeResults && query.trim() && (
          <>
            {activeResults.artists.length > 0 && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <div className="section-header">
                  <h2 className="section-title">Artists</h2>
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
                          {artist.album_count} albums · {artist.track_count} tracks
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeResults.albums.length > 0 && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <div className="section-header">
                  <h2 className="section-title">Albums</h2>
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

            {activeResults.tracks.length > 0 && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <div className="section-header">
                  <h2 className="section-title">Tracks</h2>
                </div>
                <div className="tracks-table">
                  {activeResults.tracks.map((track, i) => (
                    <div
                      key={track.id}
                      className="track-row"
                      onDoubleClick={() => navigate('album-detail', { albumId: track.album_id ?? undefined })}
                    >
                      <div className="track-num">{i + 1}</div>
                      <div className="track-info">
                        <div className="track-name-block">
                          <div className="track-title">{track.title}</div>
                          <div className="track-artist-small">
                            {track.artist ?? track.album_artist ?? '—'}
                          </div>
                        </div>
                      </div>
                      <div className="track-album">{track.album ?? '—'}</div>
                      <div className="track-year">{track.year ?? '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeResults.artists.length === 0 &&
              activeResults.albums.length === 0 &&
              activeResults.tracks.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-title">No results</div>
                  <div className="empty-state-body">
                    Nothing matched "{query}"
                  </div>
                </div>
              )}
          </>
        )}

        {!query.trim() && !loading && (
          <div className="empty-state">
            <div className="empty-state-title">Search your library</div>
            <div className="empty-state-body">
              Type to search artists, albums, and tracks.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
