import {
  app,
  BrowserWindow,
  shell,
  WebContentsView,
  type Rectangle,
} from "electron";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  buildInspectorScript,
  INSPECTOR_SENTINEL,
} from "./inspector.script";
import type {
  BrowserBounds,
  BrowserNavState,
  BrowserSelectionPayload,
  BrowserSelectionResult,
  ServiceResponse,
} from "./browser.dto";

// ─────────────────────────────────────────────────────────────
// Allowed protocols (anything else is opened in the system browser)
// ─────────────────────────────────────────────────────────────
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "about:"]);
const BLANK_URL = "about:blank";
const SURROUND_PADDING = 80;
/** Match panel `rounded-*-xl` (~12px) so WebContentsView fills bounds without square overflow. */
const VIEW_BORDER_RADIUS_PX = 0;

function normalizeUrl(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return BLANK_URL;
  if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(trimmed)) return trimmed;
  if (/^about:/i.test(trimmed)) return trimmed;
  // localhost (with optional port/path)
  if (/^localhost(:\d+)?(\/.*)?$/i.test(trimmed)) return "http://" + trimmed;
  // bare IPv4 address
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/.test(trimmed)) return "http://" + trimmed;
  // domain with a dot (e.g. example.com)
  if (/^[^\s.]+\.[^\s]+/.test(trimmed)) return "https://" + trimmed;
  return trimmed;
}

function ensureAllowed(url: string): string {
  try {
    const u = new URL(url);
    if (!ALLOWED_PROTOCOLS.has(u.protocol)) return BLANK_URL;
    return url;
  } catch {
    return BLANK_URL;
  }
}

function cacheDir(): string {
  const dir = path.join(app.getPath("userData"), "browser-captures");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
  return dir;
}

// ─────────────────────────────────────────────────────────────
// Browser Service — singleton WebContentsView owned by main
// ─────────────────────────────────────────────────────────────
export const browserService = {
  view: null as WebContentsView | null,
  host: null as BrowserWindow | null,
  bounds: null as BrowserBounds | null,
  visible: false,
  selectMode: false,

  _findHost(): BrowserWindow | null {
    return (
      BrowserWindow.getFocusedWindow() ||
      BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ||
      null
    );
  },

  _ensureView(): WebContentsView {
    if (this.view && !this.view.webContents.isDestroyed()) return this.view;

    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        devTools: !app.isPackaged,
        webSecurity: true,
        javascript: true,
      },
    });

    const wc = view.webContents;

    wc.setWindowOpenHandler(({ url }) => {
      const safe = ensureAllowed(normalizeUrl(url));
      if (safe !== BLANK_URL) shell.openExternal(safe).catch(() => {});
      return { action: "deny" };
    });

    wc.on("will-navigate", (event, url) => {
      try {
        const parsed = new URL(url);
        if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) event.preventDefault();
      } catch {
        event.preventDefault();
      }
    });

    const emitNav = () => this._emitNav();
    wc.on("did-finish-load", emitNav);
    wc.on("did-navigate", emitNav);
    wc.on("did-navigate-in-page", emitNav);
    wc.on("page-title-updated", emitNav);
    wc.on("did-start-loading", emitNav);
    wc.on("did-stop-loading", emitNav);

    wc.on("console-message", (details: any, _level?: number, legacyMessage?: string) => {
      const message: string =
        typeof details === "object" && details && typeof details.message === "string"
          ? details.message
          : typeof legacyMessage === "string"
            ? legacyMessage
            : "";
      if (!message.startsWith(INSPECTOR_SENTINEL)) return;
      const raw = message.slice(INSPECTOR_SENTINEL.length);
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.cancel) {
          this.selectMode = false;
          this._sendToRenderer("browser:selectModeChanged", { enabled: false });
          return;
        }
        this._handleSelection(parsed as Omit<BrowserSelectionPayload, "id">);
      } catch (err) {
        console.warn("[browser] failed to parse selection payload:", err);
      }
    });

    try {
      view.setBorderRadius(VIEW_BORDER_RADIUS_PX);
    } catch {
      // setBorderRadius may be unavailable on some platforms / older runtimes
    }

    this.view = view;
    return view;
  },

  _sendToRenderer(channel: string, payload: unknown) {
    const host = this.host;
    if (host && !host.isDestroyed()) {
      host.webContents.send(channel, payload);
    }
  },

  async _emitNav() {
    const view = this.view;
    if (!view || view.webContents.isDestroyed()) return;
    const wc = view.webContents;
    const state: BrowserNavState = {
      url: wc.getURL(),
      title: wc.getTitle(),
      canGoBack: wc.navigationHistory?.canGoBack?.() ?? (wc as any).canGoBack?.() ?? false,
      canGoForward:
        wc.navigationHistory?.canGoForward?.() ?? (wc as any).canGoForward?.() ?? false,
      isLoading: wc.isLoading(),
    };
    this._sendToRenderer("browser:navState", state);
  },

  async _handleSelection(payload: Omit<BrowserSelectionPayload, "id">) {
    const id = randomUUID();
    const view = this.view;
    if (!view || view.webContents.isDestroyed()) return;

    const elementRect = this._clampRect(payload.rect, payload.viewport);
    const surroundingRect = this._clampRect(
      {
        x: payload.rect.x - SURROUND_PADDING,
        y: payload.rect.y - SURROUND_PADDING,
        width: payload.rect.width + SURROUND_PADDING * 2,
        height: payload.rect.height + SURROUND_PADDING * 2,
      },
      payload.viewport,
    );

    const element = await this._capture(elementRect, `element-${id}`);
    const surrounding = await this._capture(surroundingRect, `surround-${id}`);

    const result: BrowserSelectionResult = {
      id,
      type: "browser_selection",
      url: payload.url,
      title: payload.title,
      selector: payload.selector,
      tagName: payload.tagName,
      text: payload.text,
      outerHTML: payload.outerHTML,
      styles: payload.styles,
      rect: payload.rect,
      pageRect: payload.pageRect,
      scroll: payload.scroll,
      viewport: payload.viewport,
      devicePixelRatio: payload.devicePixelRatio,
      componentName: payload.componentName,
      sourceFile: payload.sourceFile,
      timestamp: payload.timestamp,
      screenshotPath: element?.filePath,
      screenshotDataUrl: element?.dataUrl,
      screenshotBase64: element?.base64,
      surroundingScreenshotPath: surrounding?.filePath,
      surroundingScreenshotDataUrl: surrounding?.dataUrl,
      surroundingScreenshotBase64: surrounding?.base64,
      screenshotMimeType: "image/png",
    };

    this.selectMode = false;
    this._sendToRenderer("browser:selectModeChanged", { enabled: false });
    this._sendToRenderer("browser:selection", result);
  },

  _clampRect(
    rect: { x: number; y: number; width: number; height: number },
    viewport: { width: number; height: number },
  ): Rectangle {
    const vx = Math.max(0, Math.min(viewport.width, Math.floor(rect.x)));
    const vy = Math.max(0, Math.min(viewport.height, Math.floor(rect.y)));
    const vmaxX = Math.max(
      vx + 1,
      Math.min(viewport.width, Math.floor(rect.x + rect.width)),
    );
    const vmaxY = Math.max(
      vy + 1,
      Math.min(viewport.height, Math.floor(rect.y + rect.height)),
    );
    const w = Math.max(1, vmaxX - vx);
    const h = Math.max(1, vmaxY - vy);
    return { x: vx, y: vy, width: w, height: h };
  },

  async _capture(
    rect: Rectangle,
    prefix: string,
  ): Promise<{ filePath: string; dataUrl: string; base64: string } | undefined> {
    const view = this.view;
    if (!view || view.webContents.isDestroyed()) return undefined;
    try {
      const img = await view.webContents.capturePage(rect);
      if (img.isEmpty()) return undefined;
      const buffer = img.toPNG();
      const filePath = path.join(cacheDir(), `${prefix}-${Date.now()}.png`);
      fs.writeFileSync(filePath, buffer);
      const base64 = buffer.toString("base64");
      return { filePath, dataUrl: `data:image/png;base64,${base64}`, base64 };
    } catch (err) {
      console.warn("[browser] capturePage failed:", err);
      return undefined;
    }
  },

  // ─────────────── Public API ───────────────

  async attach(bounds: BrowserBounds): Promise<ServiceResponse<BrowserNavState>> {
    const host = this._findHost();
    if (!host) return { success: false, error: "No active window" };

    const view = this._ensureView();
    this.host = host;

    if (!host.contentView.children.includes(view)) {
      host.contentView.addChildView(view);
    }
    this.setBounds(bounds);
    this.visible = true;

    const wc = view.webContents;
    const current = wc.getURL();
    if (!current || current === "" || current === "about:blank") {
      // leave blank — renderer controls navigation
    }

    const state: BrowserNavState = {
      url: wc.getURL(),
      title: wc.getTitle(),
      canGoBack: wc.navigationHistory?.canGoBack?.() ?? false,
      canGoForward: wc.navigationHistory?.canGoForward?.() ?? false,
      isLoading: wc.isLoading(),
    };
    return { success: true, data: state };
  },

  detach(): ServiceResponse<null> {
    const view = this.view;
    const host = this.host;
    if (view && host && !host.isDestroyed()) {
      try {
        host.contentView.removeChildView(view);
      } catch {
        // ignore
      }
    }
    this.visible = false;
    if (this.selectMode) this.setSelectMode(false);
    return { success: true, data: null };
  },

  destroy(): ServiceResponse<null> {
    this.detach();
    if (this.view && !this.view.webContents.isDestroyed()) {
      try {
        this.view.webContents.close();
      } catch {
        // ignore
      }
    }
    this.view = null;
    this.host = null;
    this.bounds = null;
    this.selectMode = false;
    return { success: true, data: null };
  },

  setBounds(bounds: BrowserBounds): ServiceResponse<null> {
    const view = this.view;
    if (!view || view.webContents.isDestroyed()) return { success: false, error: "No browser view" };
    const rect: Rectangle = {
      x: Math.max(0, Math.floor(bounds.x)),
      y: Math.max(0, Math.floor(bounds.y)),
      width: Math.max(1, Math.floor(bounds.width)),
      height: Math.max(1, Math.floor(bounds.height)),
    };
    try {
      view.setBounds(rect);
      this.bounds = rect;
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
    return { success: true, data: null };
  },

  setVisible(visible: boolean): ServiceResponse<null> {
    const view = this.view;
    if (!view || view.webContents.isDestroyed()) return { success: true, data: null };
    try {
      view.setVisible?.(visible);
    } catch {
      // setVisible may not exist on older Electron; fall back to bounds collapse
      if (!visible) this.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
    this.visible = visible;
    return { success: true, data: null };
  },

  async navigate(rawUrl: string): Promise<ServiceResponse<null>> {
    const view = this._ensureView();
    const url = ensureAllowed(normalizeUrl(rawUrl));
    try {
      await view.webContents.loadURL(url);
    } catch (err) {
      // loadURL rejects on abort/redirect; surface benign errors quietly
      const msg = (err as Error)?.message || "";
      if (!/ERR_ABORTED/.test(msg)) {
        return { success: false, error: msg };
      }
    }
    this._emitNav();
    return { success: true, data: null };
  },

  async goBack(): Promise<ServiceResponse<null>> {
    const wc = this.view?.webContents;
    if (!wc || wc.isDestroyed()) return { success: false, error: "No browser view" };
    try {
      if (wc.navigationHistory?.canGoBack?.()) wc.navigationHistory.goBack();
      else if ((wc as any).canGoBack?.()) (wc as any).goBack();
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
    this._emitNav();
    return { success: true, data: null };
  },

  async goForward(): Promise<ServiceResponse<null>> {
    const wc = this.view?.webContents;
    if (!wc || wc.isDestroyed()) return { success: false, error: "No browser view" };
    try {
      if (wc.navigationHistory?.canGoForward?.()) wc.navigationHistory.goForward();
      else if ((wc as any).canGoForward?.()) (wc as any).goForward();
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
    this._emitNav();
    return { success: true, data: null };
  },

  async reload(): Promise<ServiceResponse<null>> {
    const wc = this.view?.webContents;
    if (!wc || wc.isDestroyed()) return { success: false, error: "No browser view" };
    try {
      wc.reload();
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
    return { success: true, data: null };
  },

  async stop(): Promise<ServiceResponse<null>> {
    const wc = this.view?.webContents;
    if (!wc || wc.isDestroyed()) return { success: true, data: null };
    try {
      wc.stop();
    } catch {
      // ignore
    }
    return { success: true, data: null };
  },

  async setSelectMode(enabled: boolean): Promise<ServiceResponse<{ enabled: boolean }>> {
    const wc = this.view?.webContents;
    if (!wc || wc.isDestroyed()) {
      this.selectMode = false;
      return { success: false, error: "No browser view" };
    }
    try {
      await wc.executeJavaScript(buildInspectorScript(enabled), true);
      this.selectMode = enabled;
      this._sendToRenderer("browser:selectModeChanged", { enabled });
      return { success: true, data: { enabled } };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },

  async getNavState(): Promise<ServiceResponse<BrowserNavState>> {
    const wc = this.view?.webContents;
    if (!wc || wc.isDestroyed()) {
      return {
        success: true,
        data: {
          url: "",
          title: "",
          canGoBack: false,
          canGoForward: false,
          isLoading: false,
        },
      };
    }
    return {
      success: true,
      data: {
        url: wc.getURL(),
        title: wc.getTitle(),
        canGoBack: wc.navigationHistory?.canGoBack?.() ?? false,
        canGoForward: wc.navigationHistory?.canGoForward?.() ?? false,
        isLoading: wc.isLoading(),
      },
    };
  },
};
