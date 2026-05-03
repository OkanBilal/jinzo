import { Heading2 } from "@/components/ui";

export default function RelayPage() {
  return (
    <div className="h-full max-w-240 mx-auto px-2 py-16 overflow-y-auto noscrollbar bg-primary dark:bg-primary-950">
      <header>
        <Heading2>Relay</Heading2>
        <p className="text-sm text-primary-500 mt-1">
          Coming soon — remote control and handoff between this app and your agents or other machines.
        </p>
      </header>
    </div>
  );
}
