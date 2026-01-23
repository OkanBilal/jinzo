import { app } from "electron";
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
import {
  registerCopilotHandlers,
  unregisterCopilotHandlers,
} from "./modules/copilot";
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
    registerCopilotHandlers();

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
    unregisterCopilotHandlers();
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
