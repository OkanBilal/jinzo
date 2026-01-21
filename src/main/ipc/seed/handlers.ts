import { ipcMain } from "electron";
import { seedApps } from "../../db/queries/seed-apps";
import { seedConnections } from "../../db/queries/seed-connections";

export function registerSeedHandlers() {
  ipcMain.handle("seed:apps", async () => {
    try {
      await seedApps();
      return { success: true, message: "Apps seeded successfully" };
    } catch (error) {
      console.error("Error seeding apps:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  ipcMain.handle("seed:connections", async () => {
    try {
      await seedConnections();
      return { success: true, message: "Connections seeded successfully" };
    } catch (error) {
      console.error("Error seeding connections:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  ipcMain.handle("seed:all", async () => {
    try {
      await seedApps();
      await seedConnections();
      return { success: true, message: "All data seeded successfully" };
    } catch (error) {
      console.error("Error seeding data:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  console.log("Seed handlers registered");
}

export function unregisterSeedHandlers() {
  ipcMain.removeHandler("seed:apps");
  ipcMain.removeHandler("seed:connections");
  ipcMain.removeHandler("seed:all");
}
