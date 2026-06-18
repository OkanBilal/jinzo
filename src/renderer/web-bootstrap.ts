import { setTransport, WsTransport } from "@/lib/transport";
import { installWebApi } from "@/lib/transport/web-api-shim";

/**
 * Web-mode bootstrap. Imported FIRST in main.tsx so it runs before any app
 * module touches `window.api`.
 *
 * Under Electron, the preload exposes `window.mainTransport`, so this is a no-op.
 * In a plain browser (the renderer served by `mains serve` over HTTP), there is
 * no preload: install the `window.api` shim and connect to the backend that
 * served this page (same origin) over WebSocket. The pairing token comes from a
 * `?token=` query param (persisted to localStorage for subsequent loads).
 *
 * See docs/design/remote-backend.md (web client).
 */
const hasElectronBridge =
  typeof window !== "undefined" &&
  Boolean((window as { mainTransport?: unknown }).mainTransport);

if (typeof window !== "undefined" && !hasElectronBridge) {
  installWebApi();

  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token");
  if (urlToken) {
    try {
      localStorage.setItem("mains.token", urlToken);
    } catch {
      /* ignore */
    }
  }
  let token: string | undefined = urlToken ?? undefined;
  if (!token) {
    try {
      token = localStorage.getItem("mains.token") ?? undefined;
    } catch {
      /* ignore */
    }
  }

  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${scheme}//${window.location.host}`;
  const transport = new WsTransport(wsUrl, { token });
  transport.connect();
  setTransport(transport);
}
