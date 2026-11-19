import { useEffect } from 'react'
import { FullscreenNowPlaying } from './components/FullscreenNowPlaying'
import { PlayerBar } from './components/PlayerBar'
import { Sidebar } from './components/Sidebar'
import { applyAppLanguage } from './i18n'
import { useAppStore, usePlaybackStore } from './store'
import { AlbumDetailView } from './views/AlbumDetailView'
import { AlbumsView } from './views/AlbumsView'
import { ArtistDetailView } from './views/ArtistDetailView'
import { ArtistsView } from './views/ArtistsView'
import { FavoritesView } from './views/FavoritesView'
import { LibraryStatsView } from './views/LibraryStatsView'
import { NowPlayingView } from './views/NowPlayingView'
import { PlaylistDetailView } from './views/PlaylistDetailView'
import { PlaylistsView } from './views/PlaylistsView'
import { SmartPlaylistDetailView } from './views/SmartPlaylistDetailView'
import { RecentlyPlayedView } from './views/RecentlyPlayedView'
import { SearchView } from './views/SearchView'
import { SettingsView } from './views/SettingsView'
import { EqualizerView } from './views/EqualizerView'
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
    case 'smart-playlist-detail': return <SmartPlaylistDetailView />
    case 'now-playing':    return <NowPlayingView />
    case 'artist-detail':  return <ArtistDetailView />
    case 'album-detail':   return <AlbumDetailView />
    case 'search':         return <SearchView />
    case 'equalizer':      return <EqualizerView />
    case 'settings':       return <SettingsView />
    case 'favorites':      return <FavoritesView />
    case 'recently-played': return <RecentlyPlayedView />
    case 'library-stats':  return <LibraryStatsView />
    default:               return <AlbumsView />
  }
}

export default function App() {
  const { loadStats, loadAlbums } = useAppStore()

  // Load library data and persisted language preference on startup
  useEffect(() => {
    loadStats()
    loadAlbums()

    Promise.all([
      window.settings.get(),
      window.appInfo?.getInfo() ?? Promise.resolve(null),
    ])
      .then(([settings, info]) => {
        void applyAppLanguage(settings.language ?? 'system', info?.systemLocale)
      })
      .catch(() => {
        // Fallback to browser/system locale already initialized
      })
  }, [loadStats, loadAlbums])

  // Global keyboard shortcuts: F (toggle fullscreen), Escape (exit fullscreen), Space (play/pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if (isInput) return

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        useAppStore.getState().toggleFullscreenNowPlaying()
      } else if (e.key === 'Escape') {
        if (useAppStore.getState().isFullscreenNowPlaying) {
          e.preventDefault()
          useAppStore.getState().setFullscreenNowPlaying(false)
        }
      } else if (e.code === 'Space') {
        e.preventDefault()
        usePlaybackStore.getState().toggle()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

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

      {/* Immersive Fullscreen Now Playing Overlay */}
      <FullscreenNowPlaying />
    </div>
  )
}
