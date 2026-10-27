import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { closeDatabase, initDatabase } from './database'
import { discordPresence } from './discord'
import { registerIpcHandlers } from './ipc'
import { getMpv } from './mpv'

// ---------------------------------------------------------------------------
// Dev / prod detection
// ---------------------------------------------------------------------------

const isDev = !app.isPackaged

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------

function createWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, 'preload.js')

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#110d0d',
    titleBarStyle: 'hidden',
    // On Windows, use a custom overlay so we can still have traffic lights
    titleBarOverlay: {
      color: '#110d0d',
      symbolColor: '#ede4e4',
      height: 34,
    },
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed for better-sqlite3 in preload (but preload uses ipcRenderer only)
      webSecurity: true,
    },
    show: false, // show only after ready-to-show
  })

  // Load the renderer
  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Graceful show — avoid white flash
  win.once('ready-to-show', () => win.show())

  // Open external links in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  // Initialize database first
  initDatabase()

  // Start Discord presence if configured
  void discordPresence.start()

  // Register all IPC handlers
  registerIpcHandlers()

  // Create the window
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    void discordPresence.stop()
    getMpv().stop()
    getMpv().destroy()
    closeDatabase()
    app.quit()
  }
})

app.on('before-quit', () => {
  void discordPresence.stop()
  getMpv().stop()
  getMpv().destroy()
  closeDatabase()
})
