import { Component, ReactNode } from "react";
import { Heading3, Muted } from "./text";
import { Button } from "./button";

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  level: "app" | "route";
}

function ErrorFallback({ error, resetError, level }: ErrorFallbackProps) {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Heading3>Something went wrong</Heading3>
        <Muted className="max-w-md">
          {level === "app"
            ? "The application encountered an unexpected error. Try reloading the app."
            : "This section encountered an error. You can try again or navigate elsewhere."}
        </Muted>
      </div>

      <details className="max-w-lg rounded-xl bg-primary-100 dark:bg-primary-900 p-4 text-left">
        <summary className="cursor-pointer text-xs font-medium text-primary-600 dark:text-primary-400">
          Error details
        </summary>
        <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-red-600 dark:text-red-400">
          {error.message}
          {error.stack && `\n\n${error.stack}`}
        </pre>
      </details>

      <div className="flex gap-3">
        <Button variant="primary" onClick={resetError}>
          Try again
        </Button>
        {level === "app" && (
          <Button variant="secondary" onClick={handleReload}>
            Reload app
          </Button>
        )}
      </div>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  level?: "app" | "route";
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(
      `[ErrorBoundary:${this.props.level ?? "app"}]`,
      error,
      info.componentStack,
    );
  }

  resetError = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          resetError={this.resetError}
          level={this.props.level ?? "app"}
        />
      );
    }

    return this.props.children;
  }
}
