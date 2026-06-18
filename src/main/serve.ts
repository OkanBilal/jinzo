import { app } from "electron";
import path from "node:path";
import { existsSync } from "node:fs";
import { initializeDatabase } from "./db/client";
import { startWsHost, type WsHost } from "./ipc-kit/ws-server-host";
import { generateToken, isLoopbackHost } from "./ipc-kit/ws-auth";

// Backend IPC registrations — the same handlers the Electron app registers (see
// src/main/index.ts), now reachable over WebSocket. Keep this list in sync with
// index.ts. Renderer-/shell-only modules are intentionally omitted from the
// headless backend: browser (drives a local BrowserView), imageProxy (custom
// protocol serving a local renderer), and updates (app self-update).
import { registerAccountIpc } from "./modules/account";
import { registerSyncIpc } from "./modules/sync";
import { registerEntitiesHandlers } from "./modules/entities";
import { registerConnectionsHandlers } from "./modules/connections";
import { registerSpaceIpc } from "./modules/space";
import { registerAppSettingsIpc } from "./modules/appSettings";
import { registerProvidersIpc } from "./modules/providers";
import { registerToolsIpc } from "./modules/tools";
import { registerWorkspaceIpc } from "./modules/workspace";
import { registerProjectsIpc } from "./modules/projects";
import { registerRunsIpc } from "./modules/runs";
import { registerFileExplorerIpc } from "./modules/fileExplorer";
import { registerGitIpc } from "./modules/git";
import { registerGitFlowIpc } from "./modules/gitFlow";
import { registerTerminalIpc } from "./modules/terminal";
import { registerStatsIpc } from "./modules/stats";
import {
  registerAutomationsIpc,
  automationsService,
} from "./modules/automations";
import { registerPulseIpc, pulseService } from "./modules/pulse";
import { registerGuardsIpc } from "./modules/guards";
import { imageProxyService } from "./modules/imageProxy/imageProxy.service";

export interface ServeOptions {
  /** Port to listen on. Default 8787. */
  port?: number;
  /** Interface to bind. Default loopback (127.0.0.1) — pair via SSH tunnel. */
  host?: string;
  /**
   * Pairing token clients must present. Falls back to MAINS_SERVE_TOKEN. On a
   * non-loopback bind without one, a token is generated and printed (fail-safe —
   * the port is never left open). On loopback, no token means no auth.
   */
  token?: string | null;
  /**
   * Directory of the built renderer to serve over HTTP (web UI). Defaults to
   * `.vite/renderer`; web serving is skipped if it doesn't exist.
   */
  webRoot?: string | null;
}

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = "127.0.0.1";

/**
 * Boot the mains backend headlessly and serve it over WebSocket.
 *
 * Runs the same DB init + module registration as the Electron app but creates no
 * BrowserWindow: handlers are reached through the WebSocket host (which registers
 * a {@link WebSocketSink} for outbound events) instead of Electron IPC and
 * BrowserWindows. The `*.ipc.ts` modules register through the `ipcMain` shim, so
 * every migrated handler lands in the handler-registry the WS router invokes.
 *
 * MUST run inside an Electron main process — the backend uses Electron APIs
 * (`app.getPath` for the DB path, `safeStorage` for credentials). Launch it as a
 * headless Electron entry (e.g. `electron . --serve`) after `app.whenReady()`.
 *
 * See docs/design/remote-backend.md.
 */
export async function startBackendServer(
  options: ServeOptions = {},
): Promise<WsHost> {
  await initializeDatabase({
    verbose: false,
    enableWAL: true,
    busyTimeout: 5000,
  });

  registerAccountIpc();
  registerSyncIpc();
  registerEntitiesHandlers();
  registerConnectionsHandlers();
  registerSpaceIpc();
  registerAppSettingsIpc();
  registerProvidersIpc();
  registerToolsIpc();
  registerWorkspaceIpc();
  registerProjectsIpc();
  registerRunsIpc();
  registerFileExplorerIpc();
  registerGitIpc();
  registerGitFlowIpc();
  registerTerminalIpc();
  registerStatsIpc();
  registerAutomationsIpc();
  registerPulseIpc();
  registerGuardsIpc();

  automationsService.start();
  pulseService.start();

  const host = options.host ?? DEFAULT_HOST;
  let token = options.token ?? process.env.MAINS_SERVE_TOKEN ?? null;
  if (!token && !isLoopbackHost(host)) {
    token = generateToken();
  }

  const webRoot = resolveWebRoot(options.webRoot);

  const wsHost = await startWsHost({
    port: options.port ?? DEFAULT_PORT,
    host,
    token,
    webRoot,
    fetchProxiedImage: (url) => imageProxyService.proxyImage(url),
  });
  console.log(`[serve] mains backend listening on ws://${host}:${wsHost.port}`);
  if (token) {
    console.log(`[serve] pairing token: ${token}`);
  } else {
    console.log("[serve] no pairing token (loopback only — pair via SSH tunnel)");
  }
  if (webRoot) {
    console.log(
      `[serve] web UI: open http://${host}:${wsHost.port}/${token ? `?token=${token}` : ""} (serving ${webRoot})`,
    );
  } else {
    console.log(
      "[serve] web UI disabled — no renderer build found. Run `npm run build:web` first.",
    );
  }
  return wsHost;
}

/**
 * Locate the built renderer. In dev, `app.getAppPath()` points at `.vite/build`
 * (the bundled main), not the project root, so try `process.cwd()` first.
 */
function resolveWebRoot(explicit?: string | null): string | null {
  const candidates = explicit
    ? [explicit]
    : [
        // `npm run build:web` output — a dedicated dir forge's `.vite` cleaning
        // never touches, so it survives `npm run serve`.
        path.join(process.cwd(), "dist-web"),
        path.join(app.getAppPath(), "dist-web"),
        path.join(process.cwd(), ".vite", "renderer"),
        path.join(app.getAppPath(), ".vite", "renderer"),
      ];
  return (
    candidates.find((dir) => existsSync(path.join(dir, "index.html"))) ?? null
  );
}
