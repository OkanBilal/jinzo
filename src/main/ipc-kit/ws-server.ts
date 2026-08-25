import { fail } from "../../shared/ipc-kit/service-response";
import {
  decodeWsMessage,
  encodeWsMessage,
} from "../../shared/ipc-kit/ws-protocol";
import { invokeHandler } from "./handler-registry";
import type { WebSocketSink, WsClientConnection } from "./websocket-sink";

/**
 * A single accepted WebSocket connection, abstracted away from any particular
 * server library. A thin adapter maps the chosen `ws`-style socket onto this.
 */
export interface WsConnection extends WsClientConnection {
  /** Paired device this connection authenticated as, if it used a device token. */
  readonly deviceId?: string;
  /**
   * Channels a paired device may invoke; undefined means unrestricted (the
   * shared pairing token, which grants full control by design).
   */
  readonly allowedChannels?: ReadonlySet<string>;
  onMessage(listener: (data: string) => void): void;
  onClose(listener: () => void): void;
}

/**
 * Wire one accepted connection to the backend:
 *  - register it with the sink so bus events reach it (and unregister on close),
 *  - route incoming `invoke` frames to the handler-registry, replying with
 *    `response` frames carrying the unchanged {@link ServiceResponse} envelope.
 *
 * The connection id is passed to handlers as `ctx.clientId`, so client-scoped
 * features (e.g. terminal streaming) can target the right client.
 *
 * See docs/design/remote-backend.md (Pillar B — WS router).
 */
export function serveConnection(conn: WsConnection, sink: WebSocketSink): void {
  sink.addClient(conn);
  conn.onClose(() => sink.removeClient(conn.id));
  conn.onMessage((data) => {
    void routeMessage(conn, data);
  });
}

async function routeMessage(conn: WsConnection, data: string): Promise<void> {
  let message;
  try {
    message = decodeWsMessage(data);
  } catch {
    return; // ignore malformed frames
  }
  // The server only accepts client→server invokes; response/event are outbound.
  if (message.kind !== "invoke") return;

  // A paired device's allowlist is checked here, before any handler runs, so
  // no module has to know about devices to be safe from one.
  if (conn.allowedChannels && !conn.allowedChannels.has(message.channel)) {
    conn.send(
      encodeWsMessage({
        kind: "response",
        id: message.id,
        result: fail(
          `Channel "${message.channel}" is not available to paired devices`,
        ),
      }),
    );
    return;
  }

  // Only set `deviceId` when there is one: a bare `undefined` would be tagged
  // by the wire codec and show up as a key in every handler's ctx.
  const ctx = conn.deviceId
    ? { clientId: conn.id, deviceId: conn.deviceId }
    : { clientId: conn.id };
  const result = await invokeHandler(message.channel, message.args, ctx);
  conn.send(
    encodeWsMessage({ kind: "response", id: message.id, result }),
  );
}
