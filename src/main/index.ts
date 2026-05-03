if (process.platform === "win32") {
  if (require("electron-squirrel-startup")) process.exit(0);
}

import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray } from "electron";

// Disable background Chromium features we never use. `CalculateNativeWinOcclusion`
// in particular can cause steady CPU churn on Windows when the window is hidden.
app.commandLine.appendSwitch(
  "disable-features",
  "HardwareMediaKeyHandling,MediaSessionService,CalculateNativeWinOcclusion",
);

// NOTE: Previously we capped V8 old-space at 512 MB here via `js-flags`. That
// switch propagates to *every* V8 isolate in the Electron process tree —
// including the main process that hosts the Vite dev-server (via
// @electron-forge/plugin-vite). Under that cap V8 thrashed on GC during Vite
// pre-transform, which in turn dragged out concurrent fs.open calls and
// tripped macOS's system-wide file-table limit ("ENFILE: file table
// overflow") during dev starts. The observed memory win was marginal vs. the
// startup fragility, so we leave V8 at its defaults.

// Enable GPU rasterization and compositing for smoother animations on first launch
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
import { spawn, execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { initializeDatabase, closeDatabase } from "./db/client";
import { registerAccountIpc, unregisterAccountIpc } from "./modules/account";
import { registerConnectionStatesIpc, unregisterConnectionStatesIpc } from "./modules/connectionStates";
import { registerSyncIpc, unregisterSyncIpc } from "./modules/sync";
import {
  registerEntitiesHandlers,
  unregisterEntitiesHandlers,
} from "./modules/entities";
import {
  registerConnectionCredentialsIpc,
  unregisterConnectionCredentialsIpc,
} from "./modules/connectionCredentials";
import {
  registerConnectionsHandlers,
  unregisterConnectionsHandlers,
} from "./modules/connections";
import { registerSeedIpc, unregisterSeedIpc } from "./modules/seed";
import { registerSpaceIpc, unregisterSpaceIpc } from "./modules/space";
import {
  registerAppSettingsIpc,
  unregisterAppSettingsIpc,
  appSettingsService,
} from "./modules/appSettings";
import {
  registerProvidersIpc,
  unregisterProvidersIpc,
  shutdownAllWorkAdapters,
} from "./modules/providers";
import { augmentPathForPackagedApp } from "./modules/providers/providers.utils";
import { registerToolsIpc, unregisterToolsIpc } from "./modules/tools";
import {
  registerWorkspacesIpc,
  unregisterWorkspacesIpc,
} from "./modules/workspaces";
import {
  registerRunsIpc,
  unregisterRunsIpc,
  releaseAllSleepBlockers,
} from "./modules/runs";
import { registerReviewsIpc, unregisterReviewsIpc } from "./modules/reviews";
import {
  registerReviewFindingsIpc,
  unregisterReviewFindingsIpc,
} from "./modules/reviewFindings";
import {
  registerWorkspaceDiffsIpc,
  unregisterWorkspaceDiffsIpc,
} from "./modules/workspaceDiffs";
import {
  registerWorkspaceActivityIpc,
  unregisterWorkspaceActivityIpc,
} from "./modules/workspaceActivity";
import { registerProjectsIpc, unregisterProjectsIpc } from "./modules/projects";
import {
  registerFileExplorerIpc,
  unregisterFileExplorerIpc,
} from "./modules/fileExplorer";
import { registerGitIpc, unregisterGitIpc } from "./modules/git";
import {
  registerWorkspaceResourcesHandlers,
  unregisterWorkspaceResourcesHandlers,
} from "./modules/workspaceResources";
import {
  registerTerminalIpc,
  unregisterTerminalIpc,
  destroyAllTerminals,
} from "./modules/terminal";
import { registerStatsIpc, unregisterStatsIpc } from "./modules/stats";
import {
  createMainWindow,
  createSplashWindow,
  closeSplashWindow,
} from "./windows";
import {
  registerImageProxyScheme,
  registerImageProxyHandler,
} from "./modules/imageProxy";
import {
  registerUpdatesIpc,
  unregisterUpdatesIpc,
  updatesService,
} from "./modules/updates";
import {
  registerAutomationsIpc,
  unregisterAutomationsIpc,
  automationsService,
} from "./modules/automations";
import {
  registerPulseIpc,
  unregisterPulseIpc,
  pulseService,
} from "./modules/pulse";
import {
  registerGuardsIpc,
  unregisterGuardsIpc,
  shutdownAllGuardAdapters,
} from "./modules/guards";
import {
  registerBrowserIpc,
  unregisterBrowserIpc,
  browserService,
} from "./modules/browser";
import {
  registerSkillsMarketplaceIpc,
  unregisterSkillsMarketplaceIpc,
} from "./modules/skillsMarketplace";

// ─────────────────────────────────────────────────────────────
// Installed app detection (macOS)
// ─────────────────────────────────────────────────────────────
const execFileAsync = promisify(execFile);

const KNOWN_APPS = [
  { id: "finder", name: "Finder", bundleId: "com.apple.finder" },
  {
    id: "vscode",
    name: "Visual Studio Code",
    bundleId: "com.microsoft.VSCode",
  },
  { id: "cursor", name: "Cursor", bundleId: "com.todesktop.230313mzl4w4u92" },
  { id: "windsurf", name: "Windsurf", bundleId: "com.exafunction.windsurf" },
  { id: "terminal", name: "Terminal", bundleId: "com.apple.Terminal" },
  { id: "iterm", name: "iTerm2", bundleId: "com.googlecode.iterm2" },
  { id: "warp", name: "Warp", bundleId: "dev.warp.Warp-Stable" },
  { id: "ghostty", name: "Ghostty", bundleId: "com.mitchellh.ghostty" },
  { id: "alacritty", name: "Alacritty", bundleId: "org.alacritty" },
  { id: "kitty", name: "kitty", bundleId: "net.kovidgoyal.kitty" },
  { id: "hyper", name: "Hyper", bundleId: "co.zeit.hyper" },
  { id: "wezterm", name: "WezTerm", bundleId: "com.github.wez.wezterm" },
  { id: "rio", name: "Rio", bundleId: "io.raphamorim.rio" },
  { id: "tabby", name: "Tabby", bundleId: "org.tabby" },
  { id: "xcode", name: "Xcode", bundleId: "com.apple.dt.Xcode" },
  {
    id: "android-studio",
    name: "Android Studio",
    bundleId: "com.google.android.studio",
  },
  { id: "sublime-text", name: "Sublime Text", bundleId: "com.sublimetext.4" },
  { id: "zed", name: "Zed", bundleId: "dev.zed.Zed" },
  { id: "nova", name: "Nova", bundleId: "com.panic.Nova" },
  { id: "fleet", name: "Fleet", bundleId: "com.jetbrains.fleet" },
  { id: "webstorm", name: "WebStorm", bundleId: "com.jetbrains.WebStorm" },
  { id: "intellij", name: "IntelliJ IDEA", bundleId: "com.jetbrains.intellij" },
  { id: "pycharm", name: "PyCharm", bundleId: "com.jetbrains.pycharm" },
  { id: "goland", name: "GoLand", bundleId: "com.jetbrains.goland" },
  { id: "rustrover", name: "RustRover", bundleId: "com.jetbrains.rustrover" },
  { id: "clion", name: "CLion", bundleId: "com.jetbrains.clion" },
  { id: "phpstorm", name: "PhpStorm", bundleId: "com.jetbrains.PhpStorm" },
  { id: "rider", name: "Rider", bundleId: "com.jetbrains.rider" },
  { id: "datagrip", name: "DataGrip", bundleId: "com.jetbrains.datagrip" },
  { id: "bbedit", name: "BBEdit", bundleId: "com.barebones.bbedit" },
  { id: "textmate", name: "TextMate", bundleId: "com.macromates.TextMate" },
  { id: "fork", name: "Fork", bundleId: "com.DanPristupov.Fork" },
  { id: "tower", name: "Tower", bundleId: "com.fournova.Tower3" },
  { id: "sourcetree", name: "Sourcetree", bundleId: "com.torusknot.SourceTreeNotMAS" },
  { id: "gitkraken", name: "GitKraken", bundleId: "com.axosoft.gitkraken" },
  { id: "tableplus", name: "TablePlus", bundleId: "com.tinyapp.TablePlus" },
  { id: "dbeaver", name: "DBeaver", bundleId: "org.jkiss.dbeaver.core.product" },
  { id: "postman", name: "Postman", bundleId: "com.postman.app" },
  { id: "insomnia", name: "Insomnia", bundleId: "com.insomnia.app" },
  { id: "mongodb-compass", name: "MongoDB Compass", bundleId: "com.mongodb.compass" },
  { id: "charles", name: "Charles Proxy", bundleId: "com.xk72.Charles" },
  { id: "proxyman", name: "Proxyman", bundleId: "com.proxyman.NSProxy" },
];

interface DetectedApp {
  id: string;
  name: string;
  bundleId: string;
  path: string;
  icon: string | null;
}

let isShuttingDown = false;
let hasUnsavedChanges = false;
let quitConfirmed = false;
let tray: Tray | null = null;
let installedAppsCache: DetectedApp[] | null = null;
let installedAppsCacheTime = 0;
let detectInFlight: Promise<DetectedApp[]> | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

function appIconsDir(): string {
  const dir = path.join(app.getPath("userData"), "app-icons");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* already exists or permission issue — handled downstream */
  }
  return dir;
}

/**
 * Extract the `.icns` for `appPath` and persist a 64×64 PNG to
 * `userData/app-icons/<id>.png`. Returns a `mains-appicon://icon/<id>.png` URL
 * the renderer can drop into `<img src>` without any base64 buffering.
 *
 * If the PNG already exists and is non-empty we skip the `sips` call —
 * `detectInstalledApps` runs on a 1h cache but the disk copy survives
 * restarts, so this is nearly free on subsequent launches.
 */
async function getAppIcon(
  appPath: string,
  id: string,
): Promise<string | null> {
  try {
    const outPath = path.join(appIconsDir(), `${id}.png`);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
      return `mains-appicon://icon/${id}.png`;
    }

    // Read CFBundleIconFile from Info.plist
    const { stdout: iconName } = await execFileAsync("defaults", [
      "read",
      `${appPath}/Contents/Info`,
      "CFBundleIconFile",
    ]);
    let iconFile = iconName.trim();
    if (!iconFile) return null;
    if (!iconFile.endsWith(".icns")) iconFile += ".icns";

    const icnsPath = path.join(appPath, "Contents", "Resources", iconFile);
    if (!fs.existsSync(icnsPath)) return null;

    await execFileAsync("sips", [
      "-s",
      "format",
      "png",
      "-z",
      "64",
      "64",
      icnsPath,
      "--out",
      outPath,
    ]);

    if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
      return null;
    }
    return `mains-appicon://icon/${id}.png`;
  } catch {
    return null;
  }
}

// Directories to search for .app bundles (no Spotlight / mdfind needed)
const APP_SEARCH_DIRS = [
  "/Applications",
  "/Applications/Utilities",
  "/System/Applications",
  "/System/Applications/Utilities",
  path.join(app.getPath("home"), "Applications"),
];

/**
 * Find an app by its bundle identifier without using mdfind.
 * Walks the known application directories looking for a .app whose
 * CFBundleIdentifier matches. This avoids the macOS
 * "would like to access data from other apps" privacy prompt.
 */
async function findAppByBundleId(bundleId: string): Promise<string | null> {
  for (const dir of APP_SEARCH_DIRS) {
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".app")) continue;
      const appPath = path.join(dir, entry);
      const plistPath = path.join(appPath, "Contents", "Info.plist");
      if (!fs.existsSync(plistPath)) continue;

      try {
        const { stdout } = await execFileAsync("defaults", [
          "read",
          path.join(appPath, "Contents", "Info"),
          "CFBundleIdentifier",
        ]);
        if (stdout.trim() === bundleId) return appPath;
      } catch {
        // plist unreadable — skip
      }
    }
  }
  return null;
}

async function detectInstalledApps(): Promise<DetectedApp[]> {
  if (installedAppsCache && Date.now() - installedAppsCacheTime < CACHE_TTL) {
    return installedAppsCache;
  }
  if (detectInFlight) return detectInFlight;

  detectInFlight = (async () => {
    try {
      const results = await Promise.allSettled(
        KNOWN_APPS.map(async (knownApp) => {
          try {
            const appPath = await findAppByBundleId(knownApp.bundleId);
            if (!appPath) return null;

            const icon = await getAppIcon(appPath, knownApp.id);

            return {
              id: knownApp.id,
              name: knownApp.name,
              bundleId: knownApp.bundleId,
              path: appPath,
              icon,
            } satisfies DetectedApp;
          } catch {
            return null;
          }
        }),
      );

      const detected = results
        .filter(
          (r): r is PromiseFulfilledResult<DetectedApp | null> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value)
        .filter((v): v is DetectedApp => v !== null);

      installedAppsCache = detected;
      installedAppsCacheTime = Date.now();
      return detected;
    } finally {
      detectInFlight = null;
    }
  })();

  return detectInFlight;
}

function resolveTrayIconPath(): string {
  if (!app.isPackaged) {
    return path.join(app.getAppPath(), "src/renderer/public/menu-iconTemplate.png");
  }
  const packed = path.join(process.resourcesPath, "menu-iconTemplate.png");
  if (fs.existsSync(packed)) return packed;
  return path.join(app.getAppPath(), ".vite/renderer/menu-iconTemplate.png");
}

function focusMainWindow() {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) {
    createMainWindow({ show: true });
    return;
  }
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

function createTray() {
  if (tray) return;

  const sourceImage = nativeImage.createFromPath(resolveTrayIconPath());
  // macOS menu bar expects ~22px; Windows/Linux accept larger
  const trayImage =
    process.platform === "darwin"
      ? sourceImage.resize({ width: 16, height: 16 })
      : sourceImage.resize({ width: 16, height: 16 });

  // NOTE: For a proper monochrome macOS menu bar icon, replace icon.png
  // with a black+transparent template PNG and call trayImage.setTemplateImage(true).
  // Using the colored app icon for now.

  tray = new Tray(trayImage);
  tray.setToolTip("Mains");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Show Mains", click: () => focusMainWindow() },
    {
      label: "Check for Updates…",
      click: () => updatesService.checkForUpdates(),
    },
    { type: "separator" },
    { label: "Quit Mains", role: "quit" },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => focusMainWindow());
}

/**
 * Initialize the application
 */
async function initializeApp() {
  try {
    console.log("Initializing application...");

    // Augment PATH early so provider binaries are discoverable in packaged app
    augmentPathForPackagedApp();

    // Show splash screen immediately
    createSplashWindow();

    // Initialize database
    await initializeDatabase({
      verbose: !app.isPackaged,
      enableWAL: true,
      busyTimeout: 5000,
    });

    // Register IPC handlers
    registerAccountIpc();
    registerConnectionStatesIpc();
    registerSyncIpc();
    registerEntitiesHandlers();
    registerConnectionCredentialsIpc();
    registerConnectionsHandlers();
    registerSeedIpc();
    registerSpaceIpc();
    registerAppSettingsIpc();
    registerProvidersIpc();
    registerToolsIpc();
    registerWorkspacesIpc();
    registerProjectsIpc();
    registerRunsIpc();
    registerFileExplorerIpc();
    registerGitIpc();
    registerWorkspaceResourcesHandlers();
    registerTerminalIpc();
    registerReviewsIpc();
    registerReviewFindingsIpc();
    registerWorkspaceDiffsIpc();
    registerWorkspaceActivityIpc();
    registerImageProxyHandler();
    registerStatsIpc();
    registerUpdatesIpc();
    updatesService.initialize();
    registerAutomationsIpc();
    registerPulseIpc();
    registerGuardsIpc();
    registerBrowserIpc();
    registerSkillsMarketplaceIpc();
    automationsService.start();
    pulseService.start();

    // Shell utilities
    ipcMain.handle("shell:openExternal", async (_, url: string) => {
      if (typeof url !== "string") return;
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return;
      }
      if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
        console.warn(
          "shell:openExternal blocked non-allowed protocol:",
          parsed.protocol,
        );
        return;
      }
      await shell.openExternal(url);
    });
    ipcMain.handle("shell:openPath", async (_, filePath: string) => {
      if (typeof filePath !== "string" || !path.isAbsolute(filePath)) return;
      const normalized = path.normalize(filePath);
      if (normalized !== filePath) return;
      await shell.openPath(filePath);
    });
    ipcMain.handle(
      "shell:openInApp",
      async (_, appId: string, filePath: string) => {
        if (process.platform !== "darwin") return;
        const known = KNOWN_APPS.find((a) => a.id === appId);
        if (!known) return;
        const child = spawn("open", ["-b", known.bundleId, filePath], {
          detached: true,
          stdio: "ignore",
        });
        child.unref();
        child.on("error", (err) =>
          console.warn("shell:openInApp spawn error:", err),
        );
      },
    );
    ipcMain.handle("shell:getInstalledApps", async () => {
      if (process.platform !== "darwin") {
        return { success: true, data: [] };
      }
      try {
        const apps = await detectInstalledApps();
        return { success: true, data: apps };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to detect apps",
        };
      }
    });

    ipcMain.handle("app:setUnsavedChanges", (_, value: boolean) => {
      hasUnsavedChanges = value;
    });

    // Build custom application menu
    const template: Electron.MenuItemConstructorOptions[] = [
      ...(process.platform === "darwin"
        ? [{
            label: app.name,
            submenu: [
              {
                label: "About Mains",
                click: () => {
                  const iconPath = !app.isPackaged
                    ? path.join(app.getAppPath(), "src/renderer/public/icon.png")
                    : fs.existsSync(path.join(process.resourcesPath, "icon.png"))
                      ? path.join(process.resourcesPath, "icon.png")
                      : path.join(app.getAppPath(), ".vite/renderer/icon.png");
                  dialog.showMessageBox({
                    type: "info",
                    title: "About Mains",
                    message: "Mains",
                    detail: `Version ${app.getVersion()}\n`,
                    icon: nativeImage.createFromPath(iconPath),
                  });
                },
              },
              {
                label: "Check for Updates…",
                click: () => updatesService.checkForUpdates(),
              },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          }]
        : []),
      { role: "fileMenu" as const },
      { role: "editMenu" as const },
      {
        label: "View",
        submenu: app.isPackaged
          ? [
              { role: "toggleDevTools" as const },
              { type: "separator" as const },
              { role: "resetZoom" as const },
              { role: "zoomIn" as const },
              { role: "zoomOut" as const },
              { type: "separator" as const },
              { role: "togglefullscreen" as const },
            ]
          : [
              { role: "reload" as const },
              { role: "forceReload" as const },
              { role: "toggleDevTools" as const },
              { type: "separator" as const },
              { role: "resetZoom" as const },
              { role: "zoomIn" as const },
              { role: "zoomOut" as const },
              { type: "separator" as const },
              { role: "togglefullscreen" as const },
            ],
      },
      { role: "windowMenu" as const },
      {
        role: "help",
        submenu: [
          {
            label: "Documentation",
            click: () => shell.openExternal("https://docs.mains.dev"),
          },
          {
            label: "Report an Issue",
            click: () => shell.openExternal("https://github.com/OkanBilal/mains/issues"),
          },
        ],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));

    // Create menu bar (tray) icon — respects user preference
    try {
      const settings = await appSettingsService.ensureSettings();
      if (settings.showMenuBarIcon) createTray();
    } catch (err) {
      console.warn("Failed to read menu bar icon preference, defaulting to shown:", err);
      createTray();
    }

    // IPC: toggle menu bar icon visibility at runtime
    ipcMain.handle("app:setMenuBarIconVisible", (_, visible: boolean) => {
      if (visible) {
        createTray();
      } else {
        destroyTray();
      }
    });

    // Create main window (hidden until ready)
    createMainWindow({
      show: false,
      onReadyToShow: (window) => {
        // Close splash and show main window
        closeSplashWindow();
        window.show();

        // Check for updates after a short delay
        setTimeout(() => {
          updatesService.checkForUpdates();
        }, 3000);
      },
    });

    console.log("Application initialized successfully");
  } catch (error) {
    console.error("Failed to initialize application:", error);
    closeSplashWindow();
    app.quit();
  }
}

/**
 * Cleanup before app quits
 */
async function cleanupApp() {
  try {
    console.log("Cleaning up application...");

    // Destroy tray
    destroyTray();

    // Destroy all terminal PTY instances
    destroyAllTerminals();

    // Shutdown work adapters (Copilot, Claude Code, etc.)
    await shutdownAllWorkAdapters();

    // Release any active sleep blockers
    releaseAllSleepBlockers();

    // Unregister IPC handlers
    unregisterAccountIpc();
    unregisterConnectionStatesIpc();
    unregisterAppSettingsIpc();
    unregisterSyncIpc();
    unregisterSeedIpc();
    unregisterSpaceIpc();
    unregisterConnectionCredentialsIpc();
    unregisterConnectionsHandlers();
    unregisterEntitiesHandlers();
    unregisterProvidersIpc();
    unregisterToolsIpc();
    unregisterWorkspacesIpc();
    unregisterProjectsIpc();
    unregisterRunsIpc();
    unregisterFileExplorerIpc();
    unregisterGitIpc();
    unregisterWorkspaceResourcesHandlers();
    unregisterTerminalIpc();
    unregisterReviewsIpc();
    unregisterReviewFindingsIpc();
    unregisterWorkspaceDiffsIpc();
    unregisterWorkspaceActivityIpc();
    unregisterStatsIpc();
    unregisterUpdatesIpc();
    automationsService.stop();
    unregisterAutomationsIpc();
    pulseService.stop();
    unregisterPulseIpc();
    unregisterGuardsIpc();
    await shutdownAllGuardAdapters();
    try { browserService.destroy(); } catch { /* ignore */ }
    unregisterBrowserIpc();
    unregisterSkillsMarketplaceIpc();
    ipcMain.removeHandler("shell:openExternal");
    ipcMain.removeHandler("shell:openPath");
    ipcMain.removeHandler("shell:openInApp");
    ipcMain.removeHandler("shell:getInstalledApps");
    ipcMain.removeHandler("app:setUnsavedChanges");
    ipcMain.removeHandler("app:setMenuBarIconVisible");

    // Close database
    await closeDatabase();

    console.log("Application cleanup completed");
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}

// Single instance lock — prevent multiple app instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one
  app.quit();
} else {
  app.on("second-instance", () => {
    // Someone tried to open a second instance — focus the existing window
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length > 0) {
      const win = allWindows[0];
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// Ensure app name is "mains" even in dev (Electron Forge defaults to "Electron")
if (!app.isPackaged) {
  app.setName("mains");
}

// Custom About panel
app.setAboutPanelOptions({
  applicationName: "Mains",
  applicationVersion: app.getVersion(),
  copyright: "© 2026 Mains",
  website: "https://mains.dev",
});

// Register custom protocol scheme (must be before app.ready)
registerImageProxyScheme();

// App lifecycle events
app.whenReady().then(initializeApp);

app.on("activate", () => {
  // On macOS it's common to re-create a window when dock icon is clicked
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length === 0) {
    createMainWindow({ show: true });
  } else {
    // Focus existing window instead of creating a new one
    const win = allWindows[0];
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("window-all-closed", () => {
  // On macOS, applications stay active until user quits explicitly
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async (event) => {
  if (isShuttingDown) {
    return;
  }

  // Show confirmation if there are unsaved changes
  if (hasUnsavedChanges && !quitConfirmed) {
    event.preventDefault();
    const { response } = await dialog.showMessageBox({
      type: "question",
      buttons: ["Save & Quit", "Quit without saving", "Cancel"],
      defaultId: 0,
      cancelId: 2,
      title: "Unsaved Changes",
      message: "You have unsaved changes.",
      detail: "Do you want to save before quitting?",
    });

    if (response === 2) {
      return; // Cancel — don't quit
    }

    if (response === 0) {
      // Save & Quit — notify renderer to flush, then quit
      const win = BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) {
        win.webContents.send("app:flushAndQuit");
        // Give renderer time to save
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    quitConfirmed = true;
  }

  event.preventDefault();
  isShuttingDown = true;
  await cleanupApp();
  app.exit(0);
});

// Handle graceful shutdown signals
async function handleShutdownSignal(signal: string) {
  if (isShuttingDown) {
    console.log(`Already shutting down, ignoring ${signal}`);
    return;
  }
  isShuttingDown = true;

  console.log(`Received ${signal}, shutting down gracefully...`);

  try {
    await cleanupApp();
  } catch (error) {
    // Ignore stream-destroyed errors during shutdown
    if (
      !(
        error instanceof Error && error.message.includes("ERR_STREAM_DESTROYED")
      )
    ) {
      console.error("Error during graceful shutdown:", error);
    }
  }

  process.exit(0);
}

process.on("SIGINT", () => handleShutdownSignal("SIGINT"));
process.on("SIGTERM", () => handleShutdownSignal("SIGTERM"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  // Suppress stream-destroyed errors during shutdown
  if (isShuttingDown && error.message?.includes("ERR_STREAM_DESTROYED")) {
    return;
  }
  console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  // Suppress stream-destroyed errors during shutdown
  if (
    isShuttingDown &&
    reason instanceof Error &&
    reason.message?.includes("ERR_STREAM_DESTROYED")
  ) {
    return;
  }
  console.error("Unhandled rejection at:", promise, "reason:", reason);
});
