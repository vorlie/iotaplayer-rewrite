import {
  Disc3,
  Heart,
  History,
  Library,
  Mic2,
  Music2,
  PlayCircle,
  ListMusic,
  Search,
  Settings,
} from 'lucide-react'
import { type NavSection, useAppStore } from '../store'
import '../styles/layout.css'

interface NavItem {
  id: NavSection
  label: string
  icon: React.ReactNode
}

const LIBRARY_ITEMS: NavItem[] = [
  { id: 'artists', label: 'Artists', icon: <Mic2 size={15} /> },
  { id: 'albums',  label: 'Albums',  icon: <Disc3 size={15} /> },
  { id: 'tracks',  label: 'Tracks',  icon: <Music2 size={15} /> },
  { id: 'playlists', label: 'Playlists', icon: <ListMusic size={15} /> },
  { id: 'now-playing', label: 'Now Playing', icon: <PlayCircle size={15} /> },
]

const YOUR_MUSIC_ITEMS: NavItem[] = [
  { id: 'favorites',      label: 'Favorites',       icon: <Heart size={15} /> },
  { id: 'recently-played', label: 'Recently Played', icon: <History size={15} /> },
]

export function Sidebar() {
  const { nav, navigate, setSearch } = useAppStore()
  const activeSection = nav.section

  function isActive(id: NavSection): boolean {
    return activeSection === id
  }

  function handleSearchClick() {
    setSearch('')
  }

  return (
    <aside className="sidebar">
      {/* Library section */}
      <div className="sidebar__section">
        <div className="sidebar__section-label">
          <Library size={10} style={{ display: 'inline', marginRight: 5 }} />
          Library
        </div>
        <nav className="sidebar__nav">
          {LIBRARY_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`sidebar__item ${isActive(item.id) ? 'active' : ''}`}
              onClick={() => navigate(item.id)}
            >
              <span className="sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar__divider" />

      {/* Your Music section */}
      <div className="sidebar__section">
        <div className="sidebar__section-label">Your Music</div>
        <nav className="sidebar__nav">
          {YOUR_MUSIC_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`sidebar__item ${isActive(item.id) ? 'active' : ''}`}
              onClick={() => navigate(item.id)}
            >
              <span className="sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar__divider" />

      {/* Search */}
      <div className="sidebar__section">
        <nav className="sidebar__nav">
          <button
            className={`sidebar__item ${isActive('search') ? 'active' : ''}`}
            onClick={handleSearchClick}
          >
            <span className="sidebar__item-icon"><Search size={15} /></span>
            Search
          </button>
        </nav>
      </div>

      {/* Spacer pushes settings to the bottom */}
      <div style={{ flex: 1 }} />

      <div className="sidebar__divider" />

      <div style={{ padding: '8px 12px 12px' }}>
        <button
          className={`sidebar__item ${isActive('settings') ? 'active' : ''}`}
          onClick={() => navigate('settings')}
        >
          <span className="sidebar__item-icon"><Settings size={15} /></span>
          Settings
        </button>
      </div>
    </aside>
  )
}
