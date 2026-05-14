import { Heading2 } from "@/components/ui";
import { PageShell } from "@/components/layout/page-shell";

export default function RelayPage() {
  return (
    <PageShell bottomPadded>
      <header>
        <Heading2>Relay</Heading2>
        <p className="text-sm text-primary-500 mt-1">
          Coming soon — remote control and handoff between this app and your agents or other machines.
        </p>
      </header>
    </PageShell>
  );
}
