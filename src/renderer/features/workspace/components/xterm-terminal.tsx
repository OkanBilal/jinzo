import { useEffect, useRef, useMemo } from "react";
import { Terminal, ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useDarkMode } from "@/hooks/use-dark-mode";

const baseThemeColors = {
  dark: {
    foreground: "#cecdc3",
    cursor: "#cecdc3",
    selectionBackground: "#403e3c",
    black: "#0c0c0c",
    red: "#e06c75",
    green: "#98c379",
    yellow: "#e5c07b",
    blue: "#61afef",
    magenta: "#c678dd",
    cyan: "#56b6c2",
    white: "#cecdc3",
    brightBlack: "#575653",
    brightRed: "#e06c75",
    brightGreen: "#98c379",
    brightYellow: "#e5c07b",
    brightBlue: "#61afef",
    brightMagenta: "#c678dd",
    brightCyan: "#56b6c2",
    brightWhite: "#ffffff",
  },
  light: {
    foreground: "#1c1917",
    cursor: "#1c1917",
    selectionBackground: "#d6d3d1",
    black: "#1c1917",
    red: "#dc2626",
    green: "#16a34a",
    yellow: "#ca8a04",
    blue: "#2563eb",
    magenta: "#9333ea",
    cyan: "#0891b2",
    white: "#f5f5f4",
    brightBlack: "#78716c",
    brightRed: "#ef4444",
    brightGreen: "#22c55e",
    brightYellow: "#eab308",
    brightBlue: "#3b82f6",
    brightMagenta: "#a855f7",
    brightCyan: "#06b6d4",
    brightWhite: "#ffffff",
  },
};

const variantBackgrounds: Record<string, { dark: string; light: string }> = {
  claude: { dark: "#141415", light: "#fcc7b6" },
  copilot: { dark: "#11131A", light: "#c8ddf1" },
};

const getTheme = (variant: string | undefined, isDark: boolean): ITheme => {
  const backgrounds = variant ? variantBackgrounds[variant] ?? variantBackgrounds.claude : variantBackgrounds.claude;
  const colors = isDark ? baseThemeColors.dark : baseThemeColors.light;
  return {
    background: isDark ? backgrounds.dark : backgrounds.light,
    ...colors,
  };
};

interface XtermTerminalProps {
  id: string;
  rootPath: string;
  variant?: string;
}

export function XtermTerminal({ id, rootPath, variant }: XtermTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const { darkMode } = useDarkMode();

  const theme = useMemo(() => getTheme(variant, darkMode), [variant, darkMode]);

  // Update terminal theme when dark mode or variant changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = theme;
    }
  }, [theme]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Geist Mono', 'SF Mono', Monaco, 'Cascadia Code', monospace",
      theme,
      allowProposedApi: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.open(container);

    // Slight delay to let the container settle before fitting
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    // Create the PTY backend
    window.api.terminal.create({ id, cwd: rootPath });

    // PTY output → xterm
    const removeDataListener = window.api.terminal.onData(
      (payload: { id: string; data: string }) => {
        if (payload.id === id) {
          term.write(payload.data);
        }
      },
    );

    // xterm input → PTY
    const onDataDisposable = term.onData((data) => {
      window.api.terminal.write(id, data);
    });

    // Auto-fit on resize
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
          const dims = fitAddonRef.current.proposeDimensions();
          if (dims) {
            window.api.terminal.resize(id, dims.cols, dims.rows);
          }
        }
      });
    });
    resizeObserver.observe(container);

    cleanupRef.current = () => {
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      removeDataListener();
      term.dispose();
      window.api.terminal.destroy(id);
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      termRef.current = null;
      fitAddonRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, rootPath]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-30"
      style={{ padding: "6px 4px" }}
    />
  );
}
