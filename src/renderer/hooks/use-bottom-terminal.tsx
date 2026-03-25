import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

const STORAGE_KEY = "bottom-terminal-open";

function getStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

interface BottomTerminalState {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const BottomTerminalContext = createContext<BottomTerminalState | null>(null);

export function BottomTerminalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(getStored);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, "false");
  }, []);

  return (
    <BottomTerminalContext value={{ isOpen, toggle, open, close }}>
      {children}
    </BottomTerminalContext>
  );
}

export function useBottomTerminal(): BottomTerminalState {
  const ctx = useContext(BottomTerminalContext);
  if (!ctx) {
    throw new Error("useBottomTerminal must be used within BottomTerminalProvider");
  }
  return ctx;
}
