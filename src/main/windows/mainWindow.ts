import { BrowserWindow } from "electron";
import path from "path";

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
  });

  // Load the app
  // In development, Electron Forge's Vite plugin makes the dev server URL available
  // through various environment variables
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 
                       process.env.RENDERER_VITE_DEV_SERVER_URL ||
                       'http://localhost:5173';
  
  if (process.env.NODE_ENV !== 'production') {
    // Development mode - load from Vite dev server
    console.log('Loading from dev server:', devServerUrl);
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode - load from built files
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
