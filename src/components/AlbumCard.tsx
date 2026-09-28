import { Disc3 } from 'lucide-react'
import { useArtwork } from '../hooks/useLibrary'
import type { Album } from '../types/electron'

interface AlbumCardProps {
  album: Album
  onClick: () => void
}

function AlbumCard({ album, onClick }: AlbumCardProps) {
  const artworkSrc = useArtwork(album.artwork_id)

  return (
    <div className="album-card" onClick={onClick}>
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
  )
}

export { AlbumCard }
