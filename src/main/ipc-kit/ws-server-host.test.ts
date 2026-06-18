import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { startWsHost, type WsHost } from "./ws-server-host";
import { clearHandlers, registerHandler } from "./handler-registry";
import { emit } from "./event-bus";

function opened(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
}

function nextMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve) =>
    ws.once("message", (data) => resolve(data.toString())),
  );
}

describe("startWsHost (integration)", () => {
  let host: WsHost | null = null;
  let client: WebSocket | null = null;

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) client.close();
    client = null;
    if (host) await host.close();
    host = null;
    clearHandlers();
  });

  it("serves invokes and pushes bus events end-to-end", async () => {
    host = await startWsHost({ port: 0, host: "127.0.0.1" });
    registerHandler("ping:ping", async (_ctx, name) => ({
      success: true,
      data: `pong:${name}`,
    }));

    client = new WebSocket(`ws://127.0.0.1:${host.port}`);
    await opened(client);

    // request/response over the wire
    const responsePromise = nextMessage(client);
    client.send(
      JSON.stringify({ kind: "invoke", id: 1, channel: "ping:ping", args: ["x"] }),
    );
    expect(JSON.parse(await responsePromise)).toEqual({
      kind: "response",
      id: 1,
      result: { success: true, data: "pong:x" },
    });

    // event-bus push reaches the connected client
    const eventPromise = nextMessage(client);
    emit("runs:statusChanged", { runId: "r1" });
    expect(JSON.parse(await eventPromise)).toEqual({
      kind: "event",
      channel: "runs:statusChanged",
      payload: { runId: "r1" },
    });
  });

  it("replies with a failure for an unknown channel", async () => {
    host = await startWsHost({ port: 0, host: "127.0.0.1" });
    client = new WebSocket(`ws://127.0.0.1:${host.port}`);
    await opened(client);

    const responsePromise = nextMessage(client);
    client.send(
      JSON.stringify({ kind: "invoke", id: 9, channel: "nope:missing", args: [] }),
    );
    const decoded = JSON.parse(await responsePromise);
    expect(decoded.id).toBe(9);
    expect(decoded.result.success).toBe(false);
  });
});
