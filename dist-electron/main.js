"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const database_1 = require("./database");
const ipc_1 = require("./ipc");
// ---------------------------------------------------------------------------
// Dev / prod detection
// ---------------------------------------------------------------------------
const isDev = !electron_1.app.isPackaged;
// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------
function createWindow() {
    const preloadPath = path_1.default.join(__dirname, 'preload.js');
    const win = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#0f0f11',
        titleBarStyle: 'hidden',
        // On Windows, use a custom overlay so we can still have traffic lights
        titleBarOverlay: {
            color: '#0f0f11',
            symbolColor: '#a0a0b0',
            height: 36,
        },
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false, // needed for better-sqlite3 in preload (but preload uses ipcRenderer only)
            webSecurity: true,
        },
        show: false, // show only after ready-to-show
    });
    // Load the renderer
    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        win.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    // Graceful show — avoid white flash
    win.once('ready-to-show', () => win.show());
    // Open external links in the system browser
    win.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
    return win;
}
// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
electron_1.app.whenReady().then(() => {
    // Initialize database first
    (0, database_1.initDatabase)();
    // Register all IPC handlers
    (0, ipc_1.registerIpcHandlers)();
    // Create the window
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        (0, database_1.closeDatabase)();
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', () => {
    (0, database_1.closeDatabase)();
});
