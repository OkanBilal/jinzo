import type { CSSProperties, ReactNode } from "react";
import { useTheme } from "@/hooks/useTheme";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const theme = useTheme();

  const backgroundStyle = theme.backgroundColor?.startsWith("linear-gradient")
    ? { background: theme.backgroundColor }
    : { backgroundColor: theme.backgroundColor };

  return (
    <div
      className="app-root flex flex-col h-screen antialiased"
      style={{
        ...backgroundStyle,
        transition: "background 300ms ease-in-out, background-color 300ms ease-in-out",
      }}
    >
      <DragRegion />
      <div className="flex h-full">{children}</div>
    </div>
  );
}

function DragRegion() {
  return (
    <div
      className="fixed top-0 left-0 right-0 h-8 z-50"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    />
  );
}
