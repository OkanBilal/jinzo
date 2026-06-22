import { PageShell } from "@/components/layout/page-shell";
import BackendsSettings from "@/features/settings/components/backends";

// For now the Relay route shows the same backend-management UI as
// Settings → Remote Backends. A distinct relay flow will replace this.
export default function RelayPage() {
  return (
    <PageShell>
      <BackendsSettings />
    </PageShell>
  );
}
