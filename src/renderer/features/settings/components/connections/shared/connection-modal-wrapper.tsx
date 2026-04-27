import { Button, Text, Muted } from "@/components/ui";
import { Close } from "@/components/ui/icons";
interface ConnectionModalWrapperProps {
  open: boolean;
  onClose: () => void;
  appName: string;
  appIcon: string;
  children: React.ReactNode;
}

export function ConnectionModalWrapper({
  open,
  onClose,
  appName,
  appIcon,
  children,
}: ConnectionModalWrapperProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-(--z-overlay) flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-primary-950/50 "
        role="presentation"
        onClick={onClose}
      />
      <div className="relative z-(--z-overlay) w-full max-w-2xl rounded-2xl overflow-hidden glass-morphism">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <img
              src={appIcon}
              alt={appName}
              className="w-10 h-10"
              width={256}
              height={256}
            />
            <Text variant="h3">{appName}</Text>
          </div>
          <Button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg cursor-pointer hover:bg-primary-100/80 dark:hover:bg-primary/10 p-1 text-primary-900 dark:text-primary-300 transition-all duration-300 ease-out"
          >
            <Close className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-6 min-h-75">{children}</div>
      </div>
    </div>
  );
}

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-3">
        <Muted className="shine-text">{message}</Muted>
      </div>
    </div>
  );
}
