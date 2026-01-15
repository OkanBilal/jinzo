import { app } from "electron";
import { initializeDatabase, closeDatabase } from "./db/client";
import { registerDatabaseHandlers, unregisterDatabaseHandlers } from "./ipc/databaseHandlers";
import { registerAccountHandlers } from "./ipc/accountHandlers";
import { registerAppsHandlers } from "./ipc/appsHandlers";
import { registerChatHandlers } from "./ipc/chatHandlers";
import { registerCronHandlers } from "./ipc/cronHandlers";
import { registerFeedHandlers } from "./ipc/feedHandlers";
import { registerMcpHandlers } from "./ipc/mcpHandlers";
import { registerOllamaHandlers } from "./ipc/ollamaHandlers";
import { registerConnectionCredentialsHandlers } from "./ipc/connectionCredentialsHandlers";
import { registerConnectionsHandlers } from "./ipc/connectionsHandlers";
import { registerSeedHandlers } from "./ipc/seedHandlers";
import { registerMoodHandlers } from "./ipc/moodHandlers";
import { registerAppSettingsHandlers } from "./ipc/appSettingsHandlers";
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
    registerCronHandlers();
    registerFeedHandlers();
    registerMcpHandlers();
    registerOllamaHandlers();
    registerConnectionCredentialsHandlers();
    registerConnectionsHandlers();
    registerSeedHandlers();
    registerMoodHandlers();
    registerAppSettingsHandlers();

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
