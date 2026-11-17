import { app, BrowserWindow, session, shell } from 'electron'
import path from 'path'
import { closeDatabase, initDatabase } from './database'
import { discordPresence } from './discord'
import { registerIpcHandlers } from './ipc'
import { getMpv } from './mpv'

// ---------------------------------------------------------------------------
// Identity & Dev/Prod detection
// ---------------------------------------------------------------------------

export const APP_ID = 'pl.vorlie.iotaplayer'
const isDev = !app.isPackaged

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID)
}

let mainWindow: BrowserWindow | null = null
let isShuttingDown = false

function getWindowIconPath(): string | undefined {
  if (process.platform === 'win32') {
    return path.join(__dirname, '../assets/icons/win/icon.ico')
  }
  if (process.platform === 'linux') {
    return path.join(__dirname, '../assets/icons/linux/256x256.png')
  }
  return undefined
}

function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function cleanupResources(): void {
  if (isShuttingDown) return
  isShuttingDown = true
  try {
    void discordPresence.stop()
  } catch {
    // ignore shutdown errors
  }
  try {
    getMpv().stop()
    getMpv().destroy()
  } catch {
    // ignore mpv cleanup errors
  }
  try {
    closeDatabase()
  } catch {
    // ignore database close errors
  }
}

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
    icon: getWindowIconPath(),
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
      sandbox: false,
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

  // Open external links in the system browser and block untrusted navigation
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, targetUrl) => {
    const currentUrl = win.webContents.getURL()
    const isSameOrigin = isDev
      ? targetUrl.startsWith('http://localhost:5173')
      : targetUrl.startsWith('file://') && targetUrl === currentUrl
    if (!isSameOrigin) {
      event.preventDefault()
      if (isAllowedExternalUrl(targetUrl)) {
        void shell.openExternal(targetUrl)
      }
    }
  })

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null
    }
  })

  mainWindow = win
  return win
}

// ---------------------------------------------------------------------------
// Single-instance lock & App lifecycle
// ---------------------------------------------------------------------------

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
    } else if (app.isReady()) {
      createWindow()
    }
  })

  app.whenReady().then(() => {
    if (!isDev) {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' file: data: blob:; font-src 'self' data:; connect-src 'self'",
            ],
          },
        })
      })
    }

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
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanupResources()
    app.quit()
  }
})

app.on('before-quit', () => {
  cleanupResources()
})

app.on('will-quit', () => {
  cleanupResources()
})
