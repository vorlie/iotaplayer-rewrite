import { useState } from 'react'
import { Disc3 } from 'lucide-react'
import { useArtwork } from '../hooks/useLibrary'
import { usePlaybackStore } from '../store'
import type { Album } from '../types/electron'

interface AlbumCardProps {
  album: Album
  onClick: () => void
}

function AlbumCard({ album, onClick }: AlbumCardProps) {
  const artworkSrc = useArtwork(album.artwork_id)
  const playlists = usePlaybackStore((s) => s.playlists)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  function handleContextMenu(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  async function addAlbumToPlaylist(playlistId: string) {
    const tracks = await window.library.tracks({ albumId: album.id })
    for (const track of tracks) {
      usePlaybackStore.getState().addTrackToPlaylist(playlistId, track)
    }
    setContextMenu(null)
  }

  async function createPlaylistFromAlbum() {
    const name = window.prompt('New playlist name', album.title)?.trim()
    if (!name) return

    const tracks = await window.library.tracks({ albumId: album.id })
    usePlaybackStore.getState().createPlaylist(name, tracks)
    setContextMenu(null)
  }

  return (
    <>
      <div className="album-card" onClick={onClick} onContextMenu={handleContextMenu}>
        <div className="album-artwork">
          {artworkSrc ? (
            <img src={artworkSrc} alt={album.title} />
          ) : (
            <Disc3
              className="album-artwork-placeholder"
              size={48}
              color="var(--color-text-3)"
            />
          )}
        </div>
        <div className="album-info">
          <div className="album-title">{album.title}</div>
          <div className="album-artist">{album.artist_name ?? 'Unknown Artist'}</div>
          {album.year && <div className="album-year">{album.year}</div>}
        </div>
      </div>

      {contextMenu && (
        <div className="context-menu-backdrop" onClick={() => setContextMenu(null)}>
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="context-menu-header">Add album to playlist</div>
            {playlists.length === 0 ? (
              <div className="context-menu-empty">No playlists yet</div>
            ) : (
              playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    void addAlbumToPlaylist(playlist.id)
                  }}
                >
                  {playlist.name}
                </button>
              ))
            )}
            <button type="button" className="context-menu-item context-menu-item--primary" onClick={() => { void createPlaylistFromAlbum() }}>
              New playlist…
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export { AlbumCard }
