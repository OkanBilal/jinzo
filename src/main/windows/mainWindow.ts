import { app, BrowserWindow, nativeImage, screen } from "electron";
import path from "path";
import { existsSync } from "fs";

let mainWindow: BrowserWindow | null = null;

export interface MainWindowOptions {
  show?: boolean;
  onReadyToShow?: (window: BrowserWindow) => void;
}

// Get icon path based on app path
function getIconPath(): string {
  if (!app.isPackaged) {
    // Development: icon is in src/renderer/public
    return path.join(app.getAppPath(), "src/renderer/public/icon.png");
  }
  // Production: try extraResource first, then inside .vite/renderer
  const resourcePath = path.join(process.resourcesPath, "icon.png");
  if (existsSync(resourcePath)) {
    return resourcePath;
  }
  return path.join(app.getAppPath(), ".vite/renderer/icon.png");
}

export function createMainWindow(options: MainWindowOptions = {}): BrowserWindow {
  const { show = true, onReadyToShow } = options;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const iconPath = getIconPath();

  // Set dock icon on macOS
  if (process.platform === "darwin" && app.dock) {
    try {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        app.dock.setIcon(icon);
      }
    } catch (e) {
      console.warn("Failed to set dock icon:", e);
    }
  }

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 800,
    title: "Jinzo",
    minHeight: 600,
    icon: iconPath,
    show: false, // Always create hidden, control visibility via ready-to-show
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

  // Handle ready-to-show event
  mainWindow.once("ready-to-show", () => {
    if (onReadyToShow && mainWindow) {
      onReadyToShow(mainWindow);
    } else if (show && mainWindow) {
      mainWindow.show();
    }
  });

  // Load the app
  // In development, Electron Forge's Vite plugin makes the dev server URL available
  // through various environment variables
  const devServerUrl =
    process.env.VITE_DEV_SERVER_URL ||
    process.env.RENDERER_VITE_DEV_SERVER_URL ||
    "http://localhost:5173";

  if (!app.isPackaged) {
    // Development mode - load from Vite dev server
    mainWindow.loadURL(devServerUrl);
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
