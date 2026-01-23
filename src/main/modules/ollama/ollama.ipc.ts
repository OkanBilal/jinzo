import { ipcMain } from "electron";
import { ollamaController } from "./ollama.controller";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerOllamaIpc() {
  ipcMain.handle("ollama:getModels", () => ollamaController.getModels());
  ipcMain.handle("ollama:showModel", (_, modelName) => ollamaController.showModel(modelName));
  ipcMain.handle("ollama:getWeatherInsight", (_, payload) => ollamaController.getWeatherInsight(payload));

  console.log("Ollama IPC handlers registered");
}

export function unregisterOllamaIpc() {
  ipcMain.removeHandler("ollama:getModels");
  ipcMain.removeHandler("ollama:showModel");
  ipcMain.removeHandler("ollama:getWeatherInsight");
}
