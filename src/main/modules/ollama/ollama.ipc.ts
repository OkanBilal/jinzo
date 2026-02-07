import { ipcMain } from "electron";
import { ollamaController } from "./ollama.controller";

export function registerOllamaIpc() {
  ipcMain.handle("ollama:getModels", () => ollamaController.getModels());
  ipcMain.handle("ollama:showModel", (_, modelName) => ollamaController.showModel(modelName));

  console.log("Ollama IPC handlers registered");
}

export function unregisterOllamaIpc() {
  ipcMain.removeHandler("ollama:getModels");
  ipcMain.removeHandler("ollama:showModel");
}
