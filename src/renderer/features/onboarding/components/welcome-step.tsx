import { useWizard } from "@/components/ui";
import { ChevronUp } from "@/components/ui/icons";

export function WelcomeStep() {
  const { goNext } = useWizard();

  return (
    <div className="flex gap-8 items-center ">
      {/* Left — Image card */}
      <div className="shrink-0 w-80 h-90 -mt-14 mb-2 rounded-2xl overflow-hidden relative">
        <img
          src="welcome.png"
          alt="Welcome"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1">
          <p className="text-xs text-primary/80 font-mono leading-relaxed">
            Where ideas rise like mountains <br/>and flow like water.
          </p>

        </div>
      </div>

      {/* Right — Content */}
      <div className="flex-1 space-y-4 mb-12">
        <h1 className="text-3xl font-serif tracking-tight text-primary-900 dark:text-primary-100 leading-tight">
          Welcome to Jinzo
          <br />
          
        </h1>

        <p className="text-sm text-primary-600 dark:text-primary-400 leading-relaxed max-w-sm">
          Your AI-powered workspace for coding, research, and productivity. Connect your tools and let AI agents help you build faster.
        </p>

        <button
          onClick={goNext}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-900 dark:text-primary-100 hover:opacity-70 transition-opacity cursor-pointer"
        >
          Begin
          <ChevronUp className="w-4 h-4 rotate-90" />
        </button>
      </div>
    </div>
  );
}
