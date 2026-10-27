import { useEffect } from 'react'
import { PlayerBar } from './components/PlayerBar'
import { Sidebar } from './components/Sidebar'
import { useAppStore } from './store'
import { AlbumDetailView } from './views/AlbumDetailView'
import { AlbumsView } from './views/AlbumsView'
import { ArtistDetailView } from './views/ArtistDetailView'
import { ArtistsView } from './views/ArtistsView'
import { FavoritesView } from './views/FavoritesView'
import { NowPlayingView } from './views/NowPlayingView'
import { PlaylistDetailView } from './views/PlaylistDetailView'
import { PlaylistsView } from './views/PlaylistsView'
import { RecentlyPlayedView } from './views/RecentlyPlayedView'
import { SearchView } from './views/SearchView'
import { SettingsView } from './views/SettingsView'
import { TracksView } from './views/TracksView'
import './styles/layout.css'
import { BrowserSpectrum } from './components/BrowserSpectrum'

function MainContent() {
  const section = useAppStore((s) => s.nav.section)

  switch (section) {
    case 'artists':        return <ArtistsView />
    case 'albums':         return <AlbumsView />
    case 'tracks':         return <TracksView />
    case 'playlists':      return <PlaylistsView />
    case 'playlist-detail': return <PlaylistDetailView />
    case 'now-playing':    return <NowPlayingView />
    case 'artist-detail':  return <ArtistDetailView />
    case 'album-detail':   return <AlbumDetailView />
    case 'search':         return <SearchView />
    case 'settings':       return <SettingsView />
    case 'favorites':      return <FavoritesView />
    case 'recently-played': return <RecentlyPlayedView />
    default:               return <AlbumsView />
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
          IotaPlayer
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="main-content">
        <MainContent />
        <BrowserSpectrum className="browser-spectrum" />
      </main>

      {/* Player bar */}
      <PlayerBar />
    </div>
  )
}
