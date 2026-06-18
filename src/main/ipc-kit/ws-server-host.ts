import { randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
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
  /**
   * Directory of the built renderer to serve over HTTP on the same port (so a
   * browser can load the web UI from the backend). When unset, only WS is served.
   */
  webRoot?: string | null;
  /**
   * Remote-image proxy for web mode — `GET /__img?url=<encoded>` pipes the result.
   * Lets a browser load remote images (avatars etc.) the way the Electron
   * `mains-img://` protocol does. Injected to keep this module domain-agnostic.
   */
  fetchProxiedImage?: (url: string) => Promise<Response>;
}

const MAX_PROXY_IMAGE_BYTES = 10 * 1024 * 1024;

async function handleImageProxy(
  req: IncomingMessage,
  res: ServerResponse,
  fetchProxiedImage: (url: string) => Promise<Response>,
): Promise<void> {
  try {
    const target = new URL(req.url ?? "/", "http://localhost").searchParams.get(
      "url",
    );
    if (!target) {
      res.writeHead(400);
      res.end("Missing url");
      return;
    }
    const response = await fetchProxiedImage(target);
    const length = response.headers.get("content-length");
    if (length && Number(length) > MAX_PROXY_IMAGE_BYTES) {
      res.writeHead(413);
      res.end("Too large");
      return;
    }
    const body = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, {
      "Content-Type":
        response.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    });
    res.end(body);
  } catch {
    res.writeHead(502);
    res.end("Image proxy error");
  }
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

/**
 * Minimal static file server for the built renderer. The app uses HashRouter, so
 * routes live in the URL hash — any non-asset request falls back to index.html.
 * Path traversal is prevented by resolving within `webRoot`.
 */
function createStaticHandler(webRoot: string) {
  const indexPath = path.join(webRoot, "index.html");
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
      const candidate = path.join(webRoot, urlPath);
      const resolved = path.normalize(candidate);
      const isAsset =
        resolved.startsWith(webRoot) &&
        existsSync(resolved) &&
        statSync(resolved).isFile();
      const filePath = isAsset ? resolved : indexPath;
      const body = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream",
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  };
}

/**
 * Start the headless host for `mains serve`:
 *  - register a {@link WebSocketSink} so event-bus events fan out to clients,
 *  - accept WS connections and route each one's `invoke` frames through the
 *    handler-registry (via {@link serveConnection}),
 *  - optionally serve the built renderer over HTTP on the same port, so a browser
 *    can load the web UI from the backend.
 *
 * The thin {@link adaptSocket} layer is the only place that touches the `ws`
 * library; all logic lives in the transport-agnostic {@link serveConnection}.
 * See docs/design/remote-backend.md.
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

  const webRoot =
    options.webRoot && existsSync(path.join(options.webRoot, "index.html"))
      ? options.webRoot
      : null;
  const staticHandler = webRoot ? createStaticHandler(webRoot) : null;

  const httpServer: Server = createServer((req, res) => {
    if (options.fetchProxiedImage && (req.url ?? "").startsWith("/__img")) {
      void handleImageProxy(req, res, options.fetchProxiedImage);
    } else if (staticHandler) {
      void staticHandler(req, res);
    } else {
      res.writeHead(426);
      res.end("Upgrade Required");
    }
  });

  const sink = new WebSocketSink();
  const unregisterSink = registerEventSink(sink);
  const wss = new WebSocketServer({
    server: httpServer,
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
    httpServer.once("error", reject);
    httpServer.listen(options.port, options.host, () => {
      const address = httpServer.address();
      const port =
        typeof address === "object" && address ? address.port : options.port;
      resolve({
        sink,
        port,
        close: () =>
          new Promise<void>((res) => {
            unregisterSink();
            wss.close(() => httpServer.close(() => res()));
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
