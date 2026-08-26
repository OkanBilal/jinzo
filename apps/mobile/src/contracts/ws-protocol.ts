/**
 * Wire protocol of the Mains backend WebSocket — a verbatim mirror of
 * `mains/src/shared/ipc-kit/ws-protocol.ts` (plus the ServiceResponse
 * envelope from `service-response.ts`). Keep the two in lockstep until this
 * folder becomes the shared contracts package; nothing here may import React
 * Native so it lifts out cleanly.
 *
 *  - `invoke` / `response` — request/response, like `ipcRenderer.invoke` ↔
 *    `ipcMain.handle`. The `ServiceResponse` envelope crosses the wire unchanged.
 *  - `event` — a one-way push from the backend, dispatched by channel.
 */

export type ServiceResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Client → server: invoke a `"domain:action"` channel with positional args. */
export interface WsInvokeMessage {
  kind: "invoke";
  /** Correlation id, unique per connection, echoed back in the response. */
  id: number;
  channel: string;
  args: unknown[];
  /**
   * Idempotency key for a mutation: the backend replays the stored response
   * for a repeated `commandId` instead of running the handler again, so a
   * command re-sent after a dropped connection can't apply twice. Required on
   * command channels for paired devices.
   */
  commandId?: string;
}

/** Server → client: the result of a prior {@link WsInvokeMessage}. */
export interface WsResponseMessage {
  kind: "response";
  id: number;
  result: ServiceResponse<unknown>;
}

/** Server → client: a pushed event on a channel. */
export interface WsEventMessage {
  kind: "event";
  channel: string;
  payload: unknown;
}

export type WsClientMessage = WsInvokeMessage;
export type WsServerMessage = WsResponseMessage | WsEventMessage;
export type WsMessage = WsClientMessage | WsServerMessage;

// ── Token transport ──
// The credential (shared pairing token or this phone's device token) travels as
// a WebSocket subprotocol: the client offers [WS_SUBPROTOCOL, token
// subprotocol], the backend validates it at the handshake and echoes only the
// base one back.

/** Base subprotocol both sides advertise (also the one the server echoes back). */
export const WS_SUBPROTOCOL = "mains.v1";
/**
 * Version of the framing plus channel payload shapes this client understands.
 * Compare against `BackendDescriptor.protocolVersion` before trusting a backend.
 */
export const WS_PROTOCOL_VERSION = 1;
const TOKEN_SUBPROTOCOL_PREFIX = "mains.token.";

/** Build the subprotocol list a client sends (token optional). */
export function buildSubprotocols(token?: string | null): string[] {
  return token
    ? [WS_SUBPROTOCOL, TOKEN_SUBPROTOCOL_PREFIX + token]
    : [WS_SUBPROTOCOL];
}

// Electron IPC preserves `Date` and `undefined`; plain JSON does not. The
// backend tags both on the way out and expects the same tags on the way in.
const DATE_TAG = "$date";
const UNDEFINED_TAG = "$undefined";

function dateReplacer(
  this: Record<string, unknown>,
  key: string,
  value: unknown,
): unknown {
  // `this[key]` is the original value before Date.prototype.toJSON ran on `value`.
  const raw = this[key];
  if (raw === undefined) return { [UNDEFINED_TAG]: true };
  if (raw instanceof Date) return { [DATE_TAG]: raw.toISOString() };
  return value;
}

function dateReviver(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (
      keys.length === 1 &&
      keys[0] === DATE_TAG &&
      typeof obj[DATE_TAG] === "string"
    ) {
      return new Date(obj[DATE_TAG] as string);
    }
    if (
      keys.length === 1 &&
      keys[0] === UNDEFINED_TAG &&
      obj[UNDEFINED_TAG] === true
    ) {
      return undefined;
    }
  }
  return value;
}

export function encodeWsMessage(message: WsMessage): string {
  return JSON.stringify(message, dateReplacer);
}

/**
 * Parse and minimally validate an incoming frame. Throws on malformed input so
 * callers can ignore/log it rather than acting on garbage.
 */
export function decodeWsMessage(data: string): WsMessage {
  const parsed = JSON.parse(data, dateReviver) as unknown;
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { kind?: unknown }).kind !== "string"
  ) {
    throw new Error("Invalid WS message: missing kind");
  }
  const kind = (parsed as { kind: string }).kind;
  if (kind !== "invoke" && kind !== "response" && kind !== "event") {
    throw new Error(`Invalid WS message: unknown kind "${kind}"`);
  }
  return parsed as WsMessage;
}
