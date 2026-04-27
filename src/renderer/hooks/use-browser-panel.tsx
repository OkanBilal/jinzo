import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { setBrowserPanelOpen } from "@/lib/redux/slices/appSettingsSlice";

interface BrowserPanelContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const BrowserPanelContext = createContext<BrowserPanelContextValue | null>(null);

export function BrowserPanelProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.appSettings.browserPanelOpen);

  const open = useCallback(() => dispatch(setBrowserPanelOpen(true)), [dispatch]);
  const close = useCallback(() => dispatch(setBrowserPanelOpen(false)), [dispatch]);
  const toggle = useCallback(() => dispatch(setBrowserPanelOpen(!isOpen)), [dispatch, isOpen]);

  const value = useMemo(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  );

  return (
    <BrowserPanelContext.Provider value={value}>
      {children}
    </BrowserPanelContext.Provider>
  );
}

export function useBrowserPanel(): BrowserPanelContextValue {
  const ctx = useContext(BrowserPanelContext);
  if (!ctx) {
    return {
      isOpen: false,
      open: () => {},
      close: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}
