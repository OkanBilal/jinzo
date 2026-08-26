import { setTransport, WsTransport } from "@/lib/transport";
import { isWeb } from "./platform";
import { installWebApi } from "./web-api-shim";

/**
 * Web-mode bootstrap. Imported FIRST in main.tsx so it runs before any app
 * module touches `window.api`.
 *
 * Under Electron this is a no-op. In a plain browser (the renderer served by
 * `mains serve` over HTTP) there is no preload: install the `window.api` shim and
 * connect to the backend that served this page (same origin) over WebSocket. The
 * pairing token comes from a `?token=` query param (persisted to localStorage).
 *
 * See docs/design/remote-backend.md (web client).
 */
if (isWeb && typeof window !== "undefined") {
  // Mark the document so CSS can paint a solid background (the page isn't a
  // transparent Electron window; without this the window translucency renders as
  // a washed-out white in a browser). See index.css `.mains-web`.
  document.documentElement.classList.add("mains-web");

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
