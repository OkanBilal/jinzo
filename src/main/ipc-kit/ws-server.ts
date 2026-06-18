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

  const result = await invokeHandler(message.channel, message.args, {
    clientId: conn.id,
  });
  conn.send(
    encodeWsMessage({ kind: "response", id: message.id, result }),
  );
}
