import { ReactNode } from "react";
import { Toaster } from "../components/ui/toast/toaster";

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
