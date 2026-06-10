import { useEffect, useReducer, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Button } from "@/components/ui";
import { Close, Document } from "@/components/ui/icons";
import { DOC_TYPE_ICONS } from "./document-viewer/doc-type-icons";
import { useDocumentViewer } from "@/hooks/use-document-viewer";
import { useAppSelector } from "@/lib/redux/hooks";
import { setDocumentViewerPanelWidth } from "@/lib/redux/slices/appSettingsSlice";
import { setLayoutWidthVar } from "@/hooks/use-layout-width-vars";
import { ResizeHandle } from "@/components/layout/resize-handle";
import {
  DOC_VIEWER_PANEL_WIDTH_VAR,
  DOC_VIEWER_PANEL_WIDTH_MIN,
  DOC_VIEWER_PANEL_WIDTH_MAX,
  DOC_VIEWER_PANEL_WIDTH_DEFAULT,
  clamp,
} from "@/lib/layout";
import { DOC_VIEWER_LABELS } from "@/lib/document-viewer";
import { DocumentRenderHost } from "./document-viewer/document-render-host";

type AnimationState = "closed" | "opening" | "open" | "closing";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

export function DocumentViewerPanel() {
  const { isOpen, currentDoc, close } = useDocumentViewer();
  const dispatch = useDispatch();
  const documentViewerWidth = useAppSelector((s) => s.appSettings.documentViewerWidth);
  const [zoom, setZoom] = useState(1);

  // Reset zoom to 100% when a different document loads. Adjusting state during
  // render (React's supported pattern) instead of in an effect avoids a wasted
  // commit + re-render.
  const prevPathRef = useRef(currentDoc?.path);
  if (currentDoc?.path !== prevPathRef.current) {
    prevPathRef.current = currentDoc?.path;
    if (zoom !== 1) setZoom(1);
  }

  const [animState, dispatchAnim] = useReducer(
    (_: AnimationState, next: AnimationState) => next,
    isOpen ? "open" : "closed",
  );

  useEffect(() => {
    dispatchAnim(isOpen ? "opening" : "closing");
  }, [isOpen]);

  useEffect(() => {
    if (animState === "opening") {
      const t = setTimeout(() => dispatchAnim("open"), 50);
      return () => clearTimeout(t);
    }
    if (animState === "closing") {
      const t = setTimeout(() => dispatchAnim("closed"), 300);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [animState]);

  const isVisible = animState !== "closed";
  const isAnimatedIn = animState === "open";

  if (!isVisible) return null;

  const zoomOut = () => setZoom((z) => clamp(+(z - ZOOM_STEP).toFixed(2), ZOOM_MIN, ZOOM_MAX));
  const zoomIn = () => setZoom((z) => clamp(+(z + ZOOM_STEP).toFixed(2), ZOOM_MIN, ZOOM_MAX));

  const DocIcon = currentDoc ? DOC_TYPE_ICONS[currentDoc.docType] : Document;

  return (
    <div
      className="fixed top-1.25 bottom-1.25 right-1.25 dark:bg-primary-950 bg-primary rounded-tr-xl z-9999 flex flex-col border-l border-primary-200/70 dark:border-primary-800/50 transition-[transform,opacity] duration-300 ease-out overflow-hidden"
      style={{
        width: "var(--doc-viewer-panel-width)",
        transform: isAnimatedIn ? "translateX(0)" : "translateX(100%)",
        opacity: isAnimatedIn ? 1 : 0,
      }}
      role="complementary"
      aria-label="Document viewer"
    >
      <ResizeHandle
        edge="left"
        value={documentViewerWidth}
        min={DOC_VIEWER_PANEL_WIDTH_MIN}
        max={DOC_VIEWER_PANEL_WIDTH_MAX}
        computeWidth={(clientX) => window.innerWidth - clientX}
        onPreview={(w) => setLayoutWidthVar(DOC_VIEWER_PANEL_WIDTH_VAR, w)}
        onCommit={(w) => dispatch(setDocumentViewerPanelWidth(w))}
        onReset={() => dispatch(setDocumentViewerPanelWidth(DOC_VIEWER_PANEL_WIDTH_DEFAULT))}
        ariaLabel="Resize document panel"
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-primary-200/60 dark:border-primary-800/50">
        <DocIcon className="size-4 shrink-0 " />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-primary-900 dark:text-primary-100 truncate">
            {currentDoc?.fileName ?? "Document"}
          </div>
          {currentDoc && (
            <div className="text-[10px] text-primary-500 dark:text-primary-400 -mt-0.25">
              {DOC_VIEWER_LABELS[currentDoc.docType]}
            </div>
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 text-primary-700 dark:text-primary-300">
          <Button
            tooltip="Zoom out"
            tooltipPosition="bottom"
            onClick={zoomOut}
            disabled={zoom <= ZOOM_MIN}
            className="size-6 flex items-center justify-center rounded-md cursor-pointer disabled:opacity-40 hover:bg-primary-200/60 dark:hover:bg-primary-800/60"
            aria-label="Zoom out"
          >
            <span className="text-sm leading-none">−</span>
          </Button>
          <Button
            tooltip="Reset zoom"
            tooltipPosition="bottom"
            onClick={() => setZoom(1)}
            className="min-w-10 px-1 text-[11px] tabular-nums rounded-md cursor-pointer hover:bg-primary-200/60 dark:hover:bg-primary-800/60"
            aria-label="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </Button>
          <Button
            tooltip="Zoom in"
            tooltipPosition="bottom"
            onClick={zoomIn}
            disabled={zoom >= ZOOM_MAX}
            className="size-6 flex items-center justify-center rounded-md cursor-pointer disabled:opacity-40 hover:bg-primary-200/60 dark:hover:bg-primary-800/60"
            aria-label="Zoom in"
          >
            <span className="text-sm leading-none">+</span>
          </Button>
        </div>

        <Button
          tooltip="Close"
          tooltipPosition="bottom-left"
          onClick={close}
          className="p-1 rounded-md cursor-pointer text-primary-700 dark:text-primary-300 hover:bg-primary-200/60 dark:hover:bg-primary-800/60"
          aria-label="Close document viewer"
        >
          <Close className="size-4" />
        </Button>
      </div>

      {/* Body */}
      {currentDoc ? (
        <DocumentRenderHost doc={currentDoc} zoom={zoom} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-primary-500 dark:text-primary-400 text-xs">
          No document selected
        </div>
      )}
    </div>
  );
}
