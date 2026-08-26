import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { setBottomTerminalOpen } from "@/lib/redux/slices/appSettingsSlice";
import { setPendingTerminalCommand } from "@/lib/redux/slices/workspaceSlice";

interface BottomTerminalState {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  /**
   * Open the drawer and run a one-shot shell command in it (e.g. a provider
   * login). The command is queued in redux and written by XtermTerminal once
   * the PTY exists — writing directly here would race PTY creation when the
   * drawer was closed.
   */
  runCommand: (command: string) => void;
}

/**
 * Open/closed state of the bottom terminal drawer, held in `appSettings` so it
 * persists with every other UI preference. Previously a context + its own
 * localStorage key; redux already gives both the sharing and the persistence,
 * so there is no provider to mount.
 */
export function useBottomTerminal(): BottomTerminalState {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.appSettings.bottomTerminalOpen);

  const toggle = useCallback(() => {
    dispatch(setBottomTerminalOpen(!isOpen));
  }, [dispatch, isOpen]);

  const open = useCallback(() => {
    dispatch(setBottomTerminalOpen(true));
  }, [dispatch]);

  const close = useCallback(() => {
    dispatch(setBottomTerminalOpen(false));
  }, [dispatch]);

  const runCommand = useCallback(
    (command: string) => {
      dispatch(setPendingTerminalCommand(command));
      dispatch(setBottomTerminalOpen(true));
    },
    [dispatch],
  );

  return { isOpen, toggle, open, close, runCommand };
}
