import { app, BrowserWindow, screen } from "electron";
import path from "path";

let mainWindow: BrowserWindow | null = null;

// Get icon path based on app path
function getIconPath(): string {
  if (process.env.NODE_ENV !== "production") {
    // Development: icon is in src/renderer/public
    return path.join(app.getAppPath(), "src/renderer/public/icon.png");
  } else {
    // Production: icon is bundled in resources
    return path.join(app.getAppPath(), "renderer/public/icon.png");
  }
}

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const iconPath = getIconPath();

  // Set dock icon on macOS
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(iconPath);
  }

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 800,
    title: "Jinzo",
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    transparent: true,
    vibrancy: "fullscreen-ui",
    visualEffectState: "active",
  });

  // Load the app
  // In development, Electron Forge's Vite plugin makes the dev server URL available
  // through various environment variables
  const devServerUrl =
    process.env.VITE_DEV_SERVER_URL ||
    process.env.RENDERER_VITE_DEV_SERVER_URL ||
    "http://localhost:5173";

  if (process.env.NODE_ENV !== "production") {
    // Development mode - load from Vite dev server
    console.log("Loading from dev server:", devServerUrl);
    mainWindow.loadURL(devServerUrl);
    //mainWindow.webContents.openDevTools();
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
