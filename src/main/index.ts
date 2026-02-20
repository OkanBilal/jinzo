if (process.platform === "win32") {
  if (require("electron-squirrel-startup")) process.exit(0);
}

import { app, ipcMain, shell } from "electron";
import { initializeDatabase, closeDatabase, getDb } from "./db/client";
import { registerAccountIpc, unregisterAccountIpc } from "./modules/account";
import { registerAppsIpc, unregisterAppsIpc } from "./modules/apps";
import { registerChatHandlers, unregisterChatHandlers } from "./modules/chat";
import { registerSyncIpc, unregisterSyncIpc } from "./modules/sync";
import { registerFeedIpc, unregisterFeedIpc } from "./modules/feed";
import {
  registerEntitiesHandlers,
  unregisterEntitiesHandlers,
} from "./modules/entities";
import { registerMcpHandlers, unregisterMcpHandlers } from "./modules/mcp";
import { registerOllamaIpc, unregisterOllamaIpc } from "./modules/ollama";
import {
  registerConnectionCredentialsIpc,
  unregisterConnectionCredentialsIpc,
} from "./modules/connectionCredentials";
import {
  registerConnectionsHandlers,
  unregisterConnectionsHandlers,
} from "./modules/connections";
import { registerSeedIpc, unregisterSeedIpc } from "./modules/seed";
import { registerMoodIpc, unregisterMoodIpc } from "./modules/mood";
import { registerAppSettingsIpc, unregisterAppSettingsIpc } from "./modules/appSettings";
import {
  registerJournalIpc,
  unregisterJournalIpc,
} from "./modules/journal";

import { registerProvidersIpc, unregisterProvidersIpc, shutdownAllWorkAdapters } from "./modules/providers";
import { augmentPathForPackagedApp } from "./modules/providers/providers.utils";
import { registerToolsIpc, unregisterToolsIpc } from "./modules/tools";
import { registerWorkspacesIpc, unregisterWorkspacesIpc } from "./modules/workspaces";
import { registerRunsIpc, unregisterRunsIpc } from "./modules/runs";
import { registerReviewsIpc, unregisterReviewsIpc } from "./modules/reviews";
import { registerWorkspaceDiffsIpc, unregisterWorkspaceDiffsIpc } from "./modules/workspaceDiffs";
import { registerProjectsIpc, unregisterProjectsIpc } from "./modules/projects";
import { registerFileExplorerIpc, unregisterFileExplorerIpc } from "./modules/fileExplorer";
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
import { createMainWindow, createSplashWindow, closeSplashWindow } from "./windows";
import { registerImageProxyScheme, registerImageProxyHandler } from "./modules/imageProxy";
import { registerUpdatesIpc, unregisterUpdatesIpc, updatesService } from "./modules/updates";

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
    registerAppsIpc();
    registerChatHandlers();
    registerSyncIpc();
    registerFeedIpc();
    registerEntitiesHandlers();
    registerMcpHandlers();
    registerOllamaIpc();
    registerConnectionCredentialsIpc();
    registerConnectionsHandlers();
    registerSeedIpc();
    registerMoodIpc();
    registerAppSettingsIpc();
    registerJournalIpc();
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
    registerWorkspaceDiffsIpc();
    registerImageProxyHandler();
    registerUpdatesIpc();
    updatesService.initialize();

    // Shell utilities
    ipcMain.handle("shell:openExternal", async (_, url: string) => {
      await shell.openExternal(url);
    });
    ipcMain.handle("shell:openPath", async (_, path: string) => {
      await shell.openPath(path);
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

    // Destroy all terminal PTY instances
    destroyAllTerminals();

    // Shutdown work adapters (Copilot, Claude Code, etc.)
    await shutdownAllWorkAdapters();

    // Unregister IPC handlers
    unregisterAccountIpc();
    unregisterAppsIpc();
    unregisterAppSettingsIpc();
    unregisterSyncIpc();
    unregisterSeedIpc();
    unregisterOllamaIpc();
    unregisterMcpHandlers();
    unregisterMoodIpc();
    unregisterFeedIpc();
    unregisterConnectionCredentialsIpc();
    unregisterConnectionsHandlers();
    unregisterEntitiesHandlers();
    unregisterJournalIpc();
    unregisterChatHandlers();
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
    unregisterWorkspaceDiffsIpc();
    unregisterUpdatesIpc();
    ipcMain.removeHandler("shell:openExternal");
    ipcMain.removeHandler("shell:openPath");

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
    const { BrowserWindow } = require("electron");
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length > 0) {
      const win = allWindows[0];
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// Register custom protocol scheme (must be before app.ready)
registerImageProxyScheme();

// App lifecycle events
app.whenReady().then(initializeApp);


app.on("activate", () => {
  // On macOS it's common to re-create a window when dock icon is clicked
  const { BrowserWindow } = require("electron");
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
    return; // Already cleaning up, let it proceed
  }
  event.preventDefault();
  isShuttingDown = true;
  await cleanupApp();
  app.exit(0);
});

// Track if we're currently shutting down to prevent duplicate cleanup
let isShuttingDown = false;

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
    if (!(error instanceof Error && error.message.includes("ERR_STREAM_DESTROYED"))) {
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
  if (isShuttingDown && reason instanceof Error && reason.message?.includes("ERR_STREAM_DESTROYED")) {
    return;
  }
  console.error("Unhandled rejection at:", promise, "reason:", reason);
});
