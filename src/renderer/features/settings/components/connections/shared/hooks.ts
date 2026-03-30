import { useState } from "react";

export function useResourceSelection<T = string>() {
  const [selectedResources, setSelectedResources] = useState<Set<T>>(new Set());

  const toggleResource = (id: T) => {
    setSelectedResources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedResources(new Set());
  };

  const setSelection = (ids: T[]) => {
    setSelectedResources(new Set(ids));
  };

  return {
    selectedResources,
    toggleResource,
    clearSelection,
    setSelection,
  };
}

export function useConnectionModal() {
  const [initializing, setInitializing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  const clearError = () => setError("");

  const withMinLoadingTime = async <T>(
    promise: Promise<T>,
    minTime: number = 800
  ): Promise<T> => {
    const startTime = Date.now();
    const result = await promise;
    const elapsed = Date.now() - startTime;
    const remainingTime = Math.max(0, minTime - elapsed);
    await new Promise((resolve) => setTimeout(resolve, remainingTime));
    return result;
  };

  return {
    initializing,
    setInitializing,
    isProcessing,
    setIsProcessing,
    error,
    setError,
    clearError,
    withMinLoadingTime,
  };
}
