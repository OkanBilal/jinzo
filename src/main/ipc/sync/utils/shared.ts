import { IMAGE_SRC_REGEX } from "../../chat/config";

export function extractImageFromHtml(html?: string | null): string | null {
  if (!html) return null;
  
  const match = html.match(IMAGE_SRC_REGEX);
  return match ? match[1] : null;
}


export function pickUrl(node: any): string | null {
  if (!node) return null;
  
  if (typeof node === 'string') {
    return node || null;
  }
  
  if (Array.isArray(node)) {
    return pickUrl(node[0]);
  }
  
  if (typeof node === 'object') {
    if (typeof node.url === 'string') {
      return node.url;
    }
    
    if (node.$ && typeof node.$.url === 'string') {
      return node.$.url;
    }
    
    if (typeof node._ === 'string') {
      return node._;
    }
    
    if (typeof node.__cdata === 'string') {
      return node.__cdata;
    }
    
    if (typeof node.href === 'string') {
      return node.href;
    }
  }
  
  return null;
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function sanitizeUrl(url: string | null | undefined, fallback = "#"): string {
  if (!url) return fallback;
  if (isValidUrl(url)) return url;
  return fallback;
}
