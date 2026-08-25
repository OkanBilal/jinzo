import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { startWsHost, type WsHost } from "./ws-server-host";
import { clearHandlers, registerHandler } from "./handler-registry";
import { buildSubprotocols } from "../../shared/ipc-kit/ws-protocol";

function opened(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
}

/** Resolves with the error `ws` raises when the server rejects the handshake. */
function rejected(ws: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    ws.once("error", (error) => resolve(error.message));
  });
}

function nextMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve) =>
    ws.once("message", (data) => resolve(data.toString())),
  );
}

const SHARED_TOKEN = "shared-pairing-token";
const DEVICE_TOKEN = "device-token-for-d1";

async function verifyDeviceToken(token: string) {
  return token === DEVICE_TOKEN ? { deviceId: "d1" } : null;
}

describe("startWsHost — paired devices and POST /pair", () => {
  let host: WsHost | null = null;
  let client: WebSocket | null = null;

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) client.close();
    client = null;
    if (host) await host.close();
    host = null;
    clearHandlers();
  });

  async function whoAmI(ws: WebSocket): Promise<unknown> {
    const responsePromise = nextMessage(ws);
    ws.send(
      JSON.stringify({ kind: "invoke", id: 1, channel: "who:ami", args: [] }),
    );
    return JSON.parse(await responsePromise).result.data;
  }

  it("accepts a device token and hands its deviceId to handlers", async () => {
    host = await startWsHost({
      port: 0,
      host: "127.0.0.1",
      token: SHARED_TOKEN,
      verifyDeviceToken,
    });
    registerHandler("who:ami", async (ctx) => ({ success: true, data: ctx }));

    client = new WebSocket(
      `ws://127.0.0.1:${host.port}`,
      buildSubprotocols(DEVICE_TOKEN),
    );
    await opened(client);

    expect(await whoAmI(client)).toEqual({
      clientId: expect.any(String),
      deviceId: "d1",
    });
  });

  it("still accepts the shared token, without a deviceId", async () => {
    host = await startWsHost({
      port: 0,
      host: "127.0.0.1",
      token: SHARED_TOKEN,
      verifyDeviceToken,
    });
    registerHandler("who:ami", async (ctx) => ({ success: true, data: ctx }));

    client = new WebSocket(
      `ws://127.0.0.1:${host.port}`,
      buildSubprotocols(SHARED_TOKEN),
    );
    await opened(client);

    expect(await whoAmI(client)).toEqual({ clientId: expect.any(String) });
  });

  it("rejects a token that is neither shared nor a known device", async () => {
    host = await startWsHost({
      port: 0,
      host: "127.0.0.1",
      token: SHARED_TOKEN,
      verifyDeviceToken,
    });

    client = new WebSocket(
      `ws://127.0.0.1:${host.port}`,
      buildSubprotocols("revoked-or-bogus"),
    );
    expect(await rejected(client)).toBe("Unexpected server response: 401");
  });

  it("refuses channels outside a device's allowlist before any handler runs", async () => {
    host = await startWsHost({
      port: 0,
      host: "127.0.0.1",
      token: SHARED_TOKEN,
      verifyDeviceToken: async (token) =>
        token === DEVICE_TOKEN
          ? { deviceId: "d1", channels: new Set(["who:ami"]) }
          : null,
    });
    let secretCalls = 0;
    registerHandler("who:ami", async (ctx) => ({ success: true, data: ctx }));
    registerHandler("secret:op", async () => {
      secretCalls += 1;
      return { success: true, data: "leaked" };
    });

    client = new WebSocket(
      `ws://127.0.0.1:${host.port}`,
      buildSubprotocols(DEVICE_TOKEN),
    );
    await opened(client);

    const refused = nextMessage(client);
    client.send(
      JSON.stringify({ kind: "invoke", id: 7, channel: "secret:op", args: [] }),
    );
    expect(JSON.parse(await refused)).toEqual({
      kind: "response",
      id: 7,
      result: {
        success: false,
        error: 'Channel "secret:op" is not available to paired devices',
      },
    });
    expect(secretCalls).toBe(0);

    expect(await whoAmI(client)).toEqual({
      clientId: expect.any(String),
      deviceId: "d1",
    });
  });

  it("does not consult device tokens when no shared token is required", async () => {
    // Loopback without a token is open by design; a device hook must not
    // silently turn that into an authenticated host.
    host = await startWsHost({ port: 0, host: "127.0.0.1", verifyDeviceToken });
    registerHandler("who:ami", async (ctx) => ({ success: true, data: ctx }));

    client = new WebSocket(
      `ws://127.0.0.1:${host.port}`,
      buildSubprotocols(DEVICE_TOKEN),
    );
    await opened(client);

    expect(await whoAmI(client)).toEqual({ clientId: expect.any(String) });
  });

  describe("POST /pair", () => {
    it("routes the JSON body through the pairDevice hook", async () => {
      host = await startWsHost({
        port: 0,
        host: "127.0.0.1",
        pairDevice: async (body) => ({ echoed: body }),
      });

      const res = await fetch(`http://127.0.0.1:${host.port}/pair`, {
        method: "POST",
        body: JSON.stringify({ code: "abc", deviceName: "Phone" }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/application\/json/);
      expect(await res.json()).toEqual({
        echoed: { code: "abc", deviceName: "Phone" },
      });
    });

    it("turns a hook failure into a 400 with the message", async () => {
      host = await startWsHost({
        port: 0,
        host: "127.0.0.1",
        pairDevice: async () => {
          throw new Error("Pairing code is invalid or has expired");
        },
      });

      const res = await fetch(`http://127.0.0.1:${host.port}/pair`, {
        method: "POST",
        body: JSON.stringify({ code: "abc" }),
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Pairing code is invalid or has expired",
      });
    });

    it("rejects a body that is not JSON", async () => {
      host = await startWsHost({
        port: 0,
        host: "127.0.0.1",
        pairDevice: async (body) => body,
      });

      const res = await fetch(`http://127.0.0.1:${host.port}/pair`, {
        method: "POST",
        body: "{not json",
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Request body is not valid JSON",
      });
    });

    it("is absent when no pairDevice hook is configured", async () => {
      host = await startWsHost({ port: 0, host: "127.0.0.1" });

      const res = await fetch(`http://127.0.0.1:${host.port}/pair`, {
        method: "POST",
        body: "{}",
      });

      expect(res.status).toBe(426);
    });
  });
});
