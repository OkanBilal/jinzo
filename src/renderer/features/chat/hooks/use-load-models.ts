import { useState, useEffect } from "react";

export function useLoadModels(
  currentModel: string,
  onModelChange: (model: string) => void
) {
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/ollama/models", { cache: "no-store" });
        if (!res.ok) return;
        const data: { models?: string[] } = await res.json();
        if (isMounted && Array.isArray(data.models) && data.models.length) {
          setModels(data.models);
          if (!data.models.includes(currentModel)) {
            onModelChange(data.models[0]);
          }
        }
      } catch {}
    };
    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return models;
}
