// Renderer-side cache + helper for signed `mains-localdoc://` URLs. Mirrors
// `local-image-url.ts`: the main process holds an HMAC secret and signs paths
// via the `documents:sign` IPC; the signed URL is what the protocol handler
// accepts. The render host `fetch()`es the returned URL to get the document's
// raw bytes (the protocol handler re-stats the file and enforces symlink/size/
// mime guards).

const PASS_THROUGH = /^(mains-localdoc:|https?:|data:|blob:)/;

const urlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

export function isPassThroughDocSrc(src: string): boolean {
  return PASS_THROUGH.test(src);
}

export function getCachedSignedDocUrl(absPath: string): string | undefined {
  return urlCache.get(absPath);
}

export async function signLocalDocument(absPath: string): Promise<string | null> {
  if (!absPath) return null;
  const cached = urlCache.get(absPath);
  if (cached) return cached;

  const existing = inflight.get(absPath);
  if (existing) return existing;

  const promise = window.api.documents
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
