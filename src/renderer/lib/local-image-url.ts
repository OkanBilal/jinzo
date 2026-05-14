// Renderer-side cache + helpers for signed `mains-localimg://` URLs.
//
// The main process holds an HMAC secret and signs paths via the
// `imageProxy:sign` IPC. The signed URL is what the protocol handler accepts —
// there's no path allowlist in the handler anymore. The trade-off is that the
// IPC call is async, so renderer code that previously built URLs synchronously
// now has to await (or use `useLocalImageUrl` which renders without a src
// until the signing call resolves).

const PASS_THROUGH = /^(data:|blob:|https?:|mains-localimg:|mains-capture:|mains-img:|mains-appicon:)/;

const urlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

export function isPassThroughSrc(src: string): boolean {
  return PASS_THROUGH.test(src);
}

export function getCachedSignedUrl(absPath: string): string | undefined {
  return urlCache.get(absPath);
}

export async function signLocalImage(absPath: string): Promise<string | null> {
  if (!absPath) return null;
  const cached = urlCache.get(absPath);
  if (cached) return cached;

  const existing = inflight.get(absPath);
  if (existing) return existing;

  const promise = window.api.imageProxy
    .sign(absPath)
    .then((res: { success: true; data: string } | { success: false; error: string }) => {
      if (!res.success) return null;
      urlCache.set(absPath, res.data);
      return res.data;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(absPath);
    });
  inflight.set(absPath, promise);
  return promise;
}

/**
 * Set `img.src` once the path has been signed. Returns a cancel function for
 * callers that may unmount before signing resolves. Used by the imperative DOM
 * code in `rich-input-form` that can't host React hooks.
 */
export function applySignedSrc(img: HTMLImageElement, src: string): () => void {
  if (isPassThroughSrc(src)) {
    img.src = src;
    return () => {};
  }
  const cached = urlCache.get(src);
  if (cached) {
    img.src = cached;
    return () => {};
  }
  let cancelled = false;
  signLocalImage(src).then((url) => {
    if (cancelled || !url) return;
    img.src = url;
  });
  return () => {
    cancelled = true;
  };
}
