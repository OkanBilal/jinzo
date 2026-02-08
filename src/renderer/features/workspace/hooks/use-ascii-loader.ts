import { useState, useEffect } from "react";

// ASCII spinner frames - classic braille/dots pattern
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Alternative patterns you can swap in:
// const SPINNER_FRAMES = ["◐", "◓", "◑", "◒"];
// const SPINNER_FRAMES = ["▖", "▘", "▝", "▗"];
// const SPINNER_FRAMES = ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"];
// const SPINNER_FRAMES = ["|", "/", "-", "\\"];

export function useAsciiLoader(enabled: boolean, fps = 12) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [enabled, fps]);

  return {
    spinner: SPINNER_FRAMES[frame],
    frame,
  };
}
