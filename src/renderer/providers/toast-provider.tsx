import { ReactNode } from "react";
import { Toaster } from "../components/ui/toast/Toaster";

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
