import { app } from "electron";
import { initializeDatabase, closeDatabase } from "./db/client";
import {
  registerDatabaseHandlers,
  unregisterDatabaseHandlers,
} from "./ipc/database";
import { registerAccountHandlers } from "./ipc/account";
import { registerAppsHandlers } from "./ipc/apps";
import { registerChatHandlers, unregisterChatHandlers } from "./ipc/chat";
import { registerSyncHandlers } from "./ipc/sync";
import { registerFeedHandlers, unregisterFeedHandlers } from "./ipc/feed";
import {
  registerEntitiesHandlers,
  unregisterEntitiesHandlers,
} from "./ipc/entities";
import { registerMcpHandlers } from "./ipc/mcp";
import { registerOllamaHandlers } from "./ipc/ollama";
import { registerConnectionCredentialsHandlers } from "./ipc/connectionCredentials";
import { registerConnectionsHandlers } from "./ipc/connections";
import { registerSeedHandlers } from "./ipc/seed";
import { registerMoodHandlers } from "./ipc/mood";
import { registerAppSettingsHandlers } from "./ipc/appSettings";
import {
  registerJournalHandlers,
  unregisterJournalHandlers,
} from "./ipc/journal";
import { createMainWindow } from "./windows/mainWindow";

/**
 * Initialize the application
 */
async function initializeApp() {
  try {
    console.log("Initializing application...");

    // Initialize database
    await initializeDatabase({
      verbose: !app.isPackaged,
      enableWAL: true,
      busyTimeout: 5000,
    });

    // Register IPC handlers
    registerDatabaseHandlers();
    registerAccountHandlers();
    registerAppsHandlers();
    registerChatHandlers();
    registerSyncHandlers();
    registerFeedHandlers();
    registerEntitiesHandlers();
    registerMcpHandlers();
    registerOllamaHandlers();
    registerConnectionCredentialsHandlers();
    registerConnectionsHandlers();
    registerSeedHandlers();
    registerMoodHandlers();
    registerAppSettingsHandlers();
    registerJournalHandlers();

    // Create main window
    createMainWindow();

    console.log("Application initialized successfully");
  } catch (error) {
    console.error("Failed to initialize application:", error);
    app.quit();
  }
}

/**
 * Cleanup before app quits
 */
async function cleanupApp() {
  try {
    console.log("Cleaning up application...");

    // Unregister IPC handlers
    unregisterDatabaseHandlers();
    unregisterFeedHandlers();
    unregisterEntitiesHandlers();
    unregisterJournalHandlers();
    unregisterChatHandlers();

    // Close database
    await closeDatabase();

    console.log("Application cleanup completed");
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}

// App lifecycle events
app.whenReady().then(initializeApp);

app.on("activate", () => {
  // On macOS it's common to re-create a window when dock icon is clicked
  const { BrowserWindow } = require("electron");
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on("window-all-closed", () => {
  // On macOS, applications stay active until user quits explicitly
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async (event) => {
  event.preventDefault();
  await cleanupApp();
  app.exit(0);
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
});
