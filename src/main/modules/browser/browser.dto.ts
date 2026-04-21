// ─────────────────────────────────────────────────────────────
// Browser DTOs
// ─────────────────────────────────────────────────────────────

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BrowserNavState {
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
}

export interface BrowserSelectionPayload {
  id: string;
  type: "browser_selection";
  url: string;
  title: string;
  selector: string;
  tagName: string;
  text: string;
  outerHTML: string;
  styles: Record<string, string>;
  rect: { x: number; y: number; width: number; height: number };
  pageRect: { x: number; y: number; width: number; height: number };
  scroll: { x: number; y: number };
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  componentName?: string;
  sourceFile?: string;
  timestamp: string;
}

export interface BrowserSelectionResult extends BrowserSelectionPayload {
  screenshotPath?: string;
  screenshotDataUrl?: string;
  screenshotBase64?: string;
  surroundingScreenshotPath?: string;
  surroundingScreenshotDataUrl?: string;
  surroundingScreenshotBase64?: string;
  screenshotMimeType: string;
}
