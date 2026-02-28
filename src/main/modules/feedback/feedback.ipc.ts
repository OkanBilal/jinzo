import { ipcMain } from "electron";
import { feedbackService } from "./feedback.service";

export function registerFeedbackIpc() {
  ipcMain.handle("feedback:send", (_, payload: { message: string }) =>
    feedbackService.send(payload),
  );

}

export function unregisterFeedbackIpc() {
  ipcMain.removeHandler("feedback:send");
}
