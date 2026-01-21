import { BrowserWindow } from "electron";
import { ChatResponse } from "../types";

export function sendStreamChunk(
  senderId: number,
  sessionId: number,
  content: string
): void {
  const window = BrowserWindow.fromId(senderId);
  window?.webContents.send("chat:stream-chunk", { sessionId, content });
}

export function sendStreamFinal(
  senderId: number,
  payload: {
    answer: string;
    sources: ChatResponse["sources"];
    sessionId: number;
    metadata: ChatResponse["metadata"];
  }
): void {
  const window = BrowserWindow.fromId(senderId);
  window?.webContents.send("chat:stream-final", payload);
}

export function sendStreamError(
  senderId: number,
  sessionId: number,
  error: string
): void {
  const window = BrowserWindow.fromId(senderId);
  window?.webContents.send("chat:stream-error", { sessionId, error });
}
