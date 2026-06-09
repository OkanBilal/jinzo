import { useEffect, useRef, useState } from "react";
import { useLocalDocumentUrl } from "@/hooks/use-local-document-url";
import { pickRenderer } from "@/lib/document-viewer";
import type { DocumentViewerDoc } from "@/lib/redux/slices/appSettingsSlice";
import { DocumentFallback } from "./document-fallback";
import { SheetTabs } from "./sheet-tabs";

type Status = "loading" | "ready" | "error";

// Base styles injected into the shadow root. The shadow boundary blocks the
// app's Tailwind CSS, but inherited properties (color/font) still flow in from
// the dark-themed host — so we pin readable defaults and style xlsx tables here
// (docx-preview and pptx-preview emit their own styles).
const BASE_SHADOW_CSS = `
.doc-zoom-wrapper {
  color: #111;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  transform-origin: top left;
}
table { border-collapse: collapse; font-size: 13px; background: #fff; }
td, th { border: 1px solid #d4d4d4; padding: 3px 8px; white-space: nowrap; }
th { background: #f3f4f6; font-weight: 600; }
`;

export function DocumentRenderHost({
  doc,
  zoom,
}: {
  doc: DocumentViewerDoc;
  zoom: number;
}) {
  const url = useLocalDocumentUrl(doc.path);
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(zoom);

  const [status, setStatus] = useState<Status>("loading");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const sheetCtlRef = useRef<{ showSheet: (name: string) => void } | null>(null);

  // Attach the shadow root exactly once for the lifetime of the host node.
  useEffect(() => {
    const host = hostRef.current;
    if (host && !shadowRootRef.current) {
      shadowRootRef.current = host.attachShadow({ mode: "open" });
    }
  }, []);

  // Render whenever the signed URL or target document changes.
  useEffect(() => {
    const root = shadowRootRef.current;
    if (!url || !root) {
      setStatus("loading");
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setStatus("loading");
    setSheetNames([]);
    setActiveSheet(null);
    sheetCtlRef.current = null;

    void (async () => {
      // Reset shadow content and rebuild the zoom wrapper.
      root.replaceChildren();
      const style = document.createElement("style");
      style.textContent = BASE_SHADOW_CSS;
      root.appendChild(style);
      const wrapper = document.createElement("div");
      wrapper.className = "doc-zoom-wrapper";
      wrapper.style.transform = `scale(${zoomRef.current})`;
      root.appendChild(wrapper);
      wrapperRef.current = wrapper;

      let buf: ArrayBuffer;
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
        buf = await res.arrayBuffer();
      } catch (err) {
        if (controller.signal.aborted) return;
        if (!cancelled) {
          console.error(`[document-viewer] failed to fetch ${doc.path}`, err);
          setStatus("error");
        }
        return;
      }
      if (cancelled) return;

      try {
        const key = pickRenderer(doc.docType);
        if (key === "docx") {
          const { renderDocx } = await import("./renderers/render-docx");
          await renderDocx(buf, wrapper);
        } else if (key === "xlsx") {
          const { renderXlsx } = await import("./renderers/render-xlsx");
          const ctl = await renderXlsx(buf, wrapper);
          if (cancelled) return;
          sheetCtlRef.current = ctl;
          setSheetNames(ctl.sheetNames);
          setActiveSheet(ctl.sheetNames[0] ?? null);
        } else {
          const { renderPptx } = await import("./renderers/render-pptx");
          const width = hostRef.current?.clientWidth || 960;
          await renderPptx(buf, wrapper, { width, height: width * 0.5625 });
        }
        if (cancelled) return;
        // Treat an empty render as a failure (pure-JS PPTX can silently produce
        // nothing) so the fallback "Open with…" path kicks in.
        if (wrapper.childNodes.length === 0) throw new Error("empty render");
        setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          console.error(`[document-viewer] failed to render ${doc.docType} ${doc.path}`, err);
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, doc.path, doc.docType]);

  // Apply zoom imperatively so changing it doesn't re-render the document.
  useEffect(() => {
    zoomRef.current = zoom;
    if (wrapperRef.current) {
      wrapperRef.current.style.transform = `scale(${zoom})`;
    }
  }, [zoom]);

  const onSelectSheet = (name: string) => {
    setActiveSheet(name);
    sheetCtlRef.current?.showSheet(name);
  };

  return (
    <div className="relative flex-1 min-h-0 flex flex-col bg-[#f3f4f6]">
      <div className="relative flex-1 min-h-0 overflow-auto p-3">
        <div ref={hostRef} className="min-h-full" />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center text-primary-500 text-xs pointer-events-none">
            Loading document…
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0">
            <DocumentFallback doc={doc} />
          </div>
        )}
      </div>
      {status === "ready" && doc.docType === "xlsx" && (
        <SheetTabs
          sheetNames={sheetNames}
          active={activeSheet}
          onSelect={onSelectSheet}
        />
      )}
    </div>
  );
}
