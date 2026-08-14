import { Body, Heading1 } from "@/components/ui";
import { MainsColor } from "@/components/ui/icons";

/** Full-screen welcome hero shown as the first onboarding step. */
export function WelcomeIntroStep() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
        <MainsColor className=" size-24 " />
      <span className="mt-8 text-xs font-medium uppercase tracking-widest text-primary-800 dark:text-primary-200">
        v{__APP_VERSION__ ?? "1.0"}
      </span>
      <Heading1 className="mt-3 font-mono tracking-tight text-primary-900 dark:text-primary-100">
        Welcome to Mains
      </Heading1>
      <Body className="mt-3 max-w-md">
        Your AI-powered workspace. Let&apos;s get you set up.
      </Body>
    </div>
  );
}
