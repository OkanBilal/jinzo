import { LoadingIndicator } from "./loading-indicator";

export default function ChatLoadingFallback() {
  return (
    <div className="min-h-screen w-full px-4 flex items-center justify-center">
      <div className="text-center">
        <LoadingIndicator />
      </div>
    </div>
  );
}
