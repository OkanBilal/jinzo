import { Button, useWizard } from "@/components/ui";
import { ChevronUp, Mains } from "@/components/ui/icons";

export function IntroStep() {
  const { goNext } = useWizard();

  return (
    <div className="flex flex-col -m-6">
      <div className="relative flex items-center justify-center overflow-hidden h-80 -mt-13 bg-linear-to-br from-primary-100 via-primary-50 to-primary-200 dark:from-primary-900 dark:via-primary-950 dark:to-primary-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_60%)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_60%)]" />
        <div className="absolute inset-x-0 -bottom-1/2 h-full bg-linear-to-t from-primary/40 to-transparent dark:from-primary-950/60" />
        <Mains className="relative w-16 h-auto text-primary-500 dark:text-primary-100 drop-shadow-lg" />
      </div>

      <div className="flex flex-col items-center text-center px-8 pt-10 pb-6 space-y-3">
        <span className="text-xxs uppercase tracking-[0.18em] font-medium text-primary-500 dark:text-primary-400">
          v{__APP_VERSION__ ?? "0.2.1"}
        </span>
        <h1 className="text-3xl font-serif tracking-tight text-primary-900 dark:text-primary-50 leading-tight">
          Welcome to Mains
        </h1>
        <p className="text-sm text-primary-600 dark:text-primary-400 leading-relaxed max-w-md">
          Your AI-powered workspace where ideas rise like mountains and flow
          like water. Let&apos;s get you set up.
        </p>
      </div>

      <div className="flex items-center justify-between px-6 pb-6 pt-2">
        <div/>

      
        <Button
          variant="submit"
          onClick={goNext}
          className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium"
        >
          Get Started
          <ChevronUp className="w-4 h-4 rotate-90" />
        </Button>
      </div>
    </div>
  );
}
