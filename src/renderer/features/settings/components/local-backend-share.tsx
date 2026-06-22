import { useEffect, useState } from "react";
import { Body, Caption, Input, Toggle, Button, toast } from "@/components/ui";
import { Clipboard, Check } from "@/components/ui/icons";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { SettingsSection, SettingsDivider } from "./settings-layout";

interface Address {
  label: string;
  url: string;
  webUrl: string;
  wsUrl: string;
}

interface Status {
  remoteAccess: boolean;
  lanAccess: boolean;
  port: number;
  token: string | null;
  addresses: Address[];
  tailscale: boolean;
  tailscaleWebUrl: string | null;
  tailscaleWsUrl: string | null;
  webUiAvailable: boolean;
}

type Busy = "remote" | "lan" | "tailscale" | null;

const valueInputCls = "flex-1 min-w-0 font-mono text-xs";

/** Read-only value field — copyable but never edited. */
function ValueField({ value }: { value: string }) {
  return <Input value={value} readOnly className={valueInputCls} />;
}

/** Icon-only copy button with a brief check on success. */
function CopyButton({ value, tooltip }: { value: string; tooltip: string }) {
  const { copy, isCopied } = useCopyToClipboard();
  return (
    <Button
      type="button"
      variant="bare"
      className="text-primary-900 dark:text-primary-200"
      tooltip={tooltip}
      onClick={() => void copy(value)}
    >
      {isCopied ? (
        <Check className="size-4" />
      ) : (
        <Clipboard className="size-4" />
      )}
    </Button>
  );
}

/**
 * "This machine" — expose the RUNNING desktop app as a backend so a phone, a LAN
 * device, or another mains over an SSH tunnel can drive it. No separate `serve`
 * process or repo. Desktop-only (rendered only outside web mode in BackendsSettings).
 *
 * Two privacy levels: loopback-only ("Allow remote access" — SSH attaches to it,
 * nothing on the network) and LAN ("Network access" — binds 0.0.0.0).
 */
export function LocalBackendShare() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  useEffect(() => {
    let active = true;
    window.api.localBackend
      .getStatus()
      .then((res) => {
        if (active && res?.success) setStatus(res.data as Status);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const run = async (
    which: Busy,
    call: Promise<{ success: boolean; data?: unknown; error?: string }>,
    okMsg?: string,
  ) => {
    setBusy(which);
    try {
      const res = await call;
      if (res?.success) {
        setStatus(res.data as Status);
        if (okMsg) toast.success(okMsg);
      } else {
        toast.error(res?.error ?? "Failed");
      }
    } finally {
      setBusy(null);
    }
  };

  const remoteOn = !!status?.remoteAccess;
  const lanOn = !!status?.lanAccess;
  const tailscaleOn = !!status?.tailscale;

  return (
    <SettingsSection title="This machine">
      {/* Allow remote access (loopback / SSH) */}
      <div className="flex items-center justify-between py-3">
        <div className="flex-1 pr-8">
          <Body className="mb-1">Allow remote access</Body>
          <Caption>
            SSH-tunnel in from another machine. Loopback only — not on your
            network.
          </Caption>
        </div>
        <Toggle
          enabled={remoteOn}
          onChange={(v) =>
            run("remote", window.api.localBackend.setRemoteAccess(v))
          }
          disabled={busy !== null}
        />
      </div>

      {remoteOn && status && (
        <div className="space-y-2 pb-2">
          {status.addresses.map((a) => (
            <div key={a.label} className="flex items-center gap-2">
              <Caption className="w-28 shrink-0">{a.label}</Caption>
              <ValueField value={a.url} />
              <CopyButton value={a.webUrl} tooltip="Copy browser link" />
              {/* <CopyButton value={a.wsUrl} tooltip="Copy ws:// URL" /> */}
            </div>
          ))}
          {status.token && (
            <div className="flex items-center gap-2">
              <Caption className="w-28 shrink-0">Pairing token</Caption>
              <ValueField value={status.token} />
              <CopyButton value={status.token} tooltip="Copy token" />
            </div>
          )}
          {!status.webUiAvailable && (
            <Caption className="text-warning block">
              Web UI not built — run{" "}
              <code className="text-xs">npm run build:web</code> once so browsers
              can load the interface.
            </Caption>
          )}

          {/* Network access (LAN) — requires remote access */}
          <div className="flex items-center justify-between pt-3">
            <div className="flex-1 pr-8">
              <Body className="mb-1">Network access (LAN)</Body>
              <Caption>
                Also bind your LAN / Tailscale IPs for direct access (token-gated,
                less private).
              </Caption>
            </div>
            <Toggle
              enabled={lanOn}
              onChange={(v) => run("lan", window.api.localBackend.setLanAccess(v))}
              disabled={busy !== null}
            />
          </div>
        </div>
      )}

      <SettingsDivider />

      {/* Tailscale HTTPS */}
      <div className="flex items-center justify-between py-3">
        <div className="flex-1 pr-8">
          <Body className="mb-1">Tailscale HTTPS</Body>
          <Caption>
            A MagicDNS HTTPS URL via Tailscale Serve. Requires the Tailscale app
            with HTTPS enabled.
          </Caption>
        </div>
        <Toggle
          enabled={tailscaleOn}
          onChange={(v) =>
            run(
              "tailscale",
              window.api.localBackend.setTailscaleHttps(v),
              v ? "Exposed over Tailscale HTTPS" : undefined,
            )
          }
          disabled={busy !== null}
        />
      </div>

      {tailscaleOn && status?.tailscaleWebUrl && (
        <div className="flex items-center gap-2 pb-3">
          <ValueField value={status.tailscaleWebUrl} />
          <CopyButton value={status.tailscaleWebUrl} tooltip="Copy browser link" />
          {/* {status.tailscaleWsUrl && (
            <CopyButton value={status.tailscaleWsUrl} tooltip="Copy ws:// URL" />
          )} */}
        </div>
      )}
    </SettingsSection>
  );
}
