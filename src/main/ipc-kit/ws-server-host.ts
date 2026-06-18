import { randomUUID } from "node:crypto";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import {
  WS_SUBPROTOCOL,
  extractToken,
  parseProtocolHeader,
} from "../../shared/ipc-kit/ws-protocol";
import { registerEventSink } from "./event-bus";
import { isLoopbackHost, tokensMatch } from "./ws-auth";
import { WebSocketSink } from "./websocket-sink";
import { serveConnection, type WsConnection } from "./ws-server";

export interface WsHost {
  readonly sink: WebSocketSink;
  /** The actual listening port (resolved even when started with port 0). */
  readonly port: number;
  close(): Promise<void>;
}

export interface WsHostOptions {
  port: number;
  host?: string;
  /**
   * Pairing token clients must present (via WS subprotocol). When set, the
   * handshake is rejected (401) unless it matches. Optional on loopback; required
   * on a non-loopback bind (startWsHost rejects otherwise — fail-safe).
   */
  token?: string | null;
}

/**
 * Start the headless WebSocket host for `mains serve`:
 *  - register a {@link WebSocketSink} so event-bus events fan out to clients,
 *  - accept connections and route each one's `invoke` frames through the
 *    handler-registry (via {@link serveConnection}).
 *
 * Resolves once the server is listening. The thin {@link adaptSocket} layer is
 * the only place that touches the `ws` library; all logic lives in the
 * transport-agnostic {@link serveConnection}. See docs/design/remote-backend.md.
 */
export function startWsHost(options: WsHostOptions): Promise<WsHost> {
  const token = options.token ?? null;
  if (!token && !isLoopbackHost(options.host)) {
    return Promise.reject(
      new Error(
        "Refusing to bind a non-loopback interface without a pairing token. Pass a token or bind to 127.0.0.1.",
      ),
    );
  }

  const sink = new WebSocketSink();
  const unregisterSink = registerEventSink(sink);
  const wss = new WebSocketServer({
    port: options.port,
    host: options.host,
    // Echo the base subprotocol; the token subprotocol is validated, not echoed.
    handleProtocols: (protocols) =>
      protocols.has(WS_SUBPROTOCOL) ? WS_SUBPROTOCOL : false,
    // Reject the handshake (401) when a token is required but missing/wrong, so
    // an unauthenticated socket never opens.
    verifyClient: token
      ? (info, cb) => {
          const raw = info.req.headers["sec-websocket-protocol"];
          const header = Array.isArray(raw) ? raw.join(",") : raw;
          const presented = extractToken(parseProtocolHeader(header));
          if (tokensMatch(token, presented)) cb(true);
          else cb(false, 401, "Unauthorized");
        }
      : undefined,
  });

  wss.on("connection", (socket: WebSocket) => {
    serveConnection(adaptSocket(socket), sink);
  });

  return new Promise<WsHost>((resolve, reject) => {
    wss.once("error", reject);
    wss.once("listening", () => {
      const address = wss.address();
      const port =
        typeof address === "object" && address ? address.port : options.port;
      resolve({
        sink,
        port,
        close: () =>
          new Promise<void>((res) => {
            unregisterSink();
            wss.close(() => res());
          }),
      });
    });
  });
}

function adaptSocket(socket: WebSocket): WsConnection {
  return {
    id: randomUUID(),
    send: (data) => socket.send(data),
    onMessage: (listener) =>
      socket.on("message", (raw: RawData, isBinary: boolean) => {
        if (!isBinary) listener(raw.toString());
      }),
    onClose: (listener) => socket.on("close", () => listener()),
  };
}
