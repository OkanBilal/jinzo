import { useEffect, useState } from "react";

interface UsePageMountOptions {
  delay?: number;
}

export function usePageMount({
  delay = 10,
}: UsePageMountOptions = {}): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return mounted;
}
