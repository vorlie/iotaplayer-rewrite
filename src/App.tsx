import { useEffect } from 'react'
import { PlayerBar } from './components/PlayerBar'
import { Sidebar } from './components/Sidebar'
import { useAppStore } from './store'
import { AlbumDetailView } from './views/AlbumDetailView'
import { AlbumsView } from './views/AlbumsView'
import { ArtistDetailView } from './views/ArtistDetailView'
import { ArtistsView } from './views/ArtistsView'
import { PlaceholderView } from './views/PlaceholderView'
import { SearchView } from './views/SearchView'
import { SettingsView } from './views/SettingsView'
import { TracksView } from './views/TracksView'
import './styles/layout.css'

function MainContent() {
  const section = useAppStore((s) => s.nav.section)

  switch (section) {
    case 'artists':        return <ArtistsView />
    case 'albums':         return <AlbumsView />
    case 'tracks':         return <TracksView />
    case 'artist-detail':  return <ArtistDetailView />
    case 'album-detail':   return <AlbumDetailView />
    case 'search':         return <SearchView />
    case 'settings':       return <SettingsView />
    case 'favorites':
      return (
        <PlaceholderView
          title="Favorites"
          description="Your favorite tracks will appear here. Coming in Phase 11."
        />
      )
    case 'recently-played':
      return (
        <PlaceholderView
          title="Recently Played"
          description="Your playback history will appear here. Coming in Phase 11."
        />
      )
    default:
      return <AlbumsView />
  }
}

export default function App() {
  const { loadStats, loadAlbums } = useAppStore()

  // Load library data on startup
  useEffect(() => {
    loadStats()
    loadAlbums()
  }, [loadStats, loadAlbums])

  return (
    <div className="app-layout">
      {/* Titlebar */}
      <div className="titlebar">
        <div className="titlebar__logo">
          <div className="titlebar__logo-dot" />
          IotaPlayer
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="main-content">
        <MainContent />
      </main>

      {/* Player bar */}
      <PlayerBar />
    </div>
  )
}
