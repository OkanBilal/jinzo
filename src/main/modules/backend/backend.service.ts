import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { app } from "electron";
import { WS_PROTOCOL_VERSION } from "../../../shared/ipc-kit/ws-protocol";
import { registeredChannels } from "../../ipc-kit";
import { generateToken, hashToken, tokensMatch } from "../../ipc-kit/ws-auth";
import { appSettingsService } from "../appSettings";
import { backendRepo } from "./backend.repo";
import { parsePairDeviceInput } from "./backend.validation";
import type {
  BackendDescriptor,
  PairDeviceResult,
  PairedDevice,
  PairedDeviceRecord,
  PairingCode,
} from "./backend.dto";

/**
 * This install as a backend: who it is, and who may talk to it.
 *
 * **Identity** — `backendId`, minted once and persisted for good, plus the
 * descriptor a remote client reads first (`backend:describe`).
 *
 * **Trust** — pairing, with two credentials deliberately different in lifetime:
 *  - a **pairing code** — minted by the desktop, shown as a QR, valid for five
 *    minutes and for exactly one exchange. Lives only in memory: a restart
 *    during the window just means showing a new QR.
 *  - a **device token** — what the code is exchanged for. Long-lived, stored on
 *    the device, stored here only as a hash, revocable per device from the
 *    desktop. Presented on every WS handshake in place of the shared pairing
 *    token (see ws-server-host `verifyDeviceToken`).
 *
 * The desktop reaches the pairing side through the localBackend module (which
 * owns the exposure pairing rides on); the WS host reaches it through the hooks
 * localBackend/serve inject. See docs/design/mobile-app.md (§5.3, §10.1).
 *
 * Throw-style: methods return plain values and throw on failure; the
 * ServiceResponse envelope is applied by handle() / the localBackend handlers
 * at the IPC seam.
 */

// ── Identity ──

/** Namespace part of a `"domain:action"` channel. */
function namespaceOf(channel: string): string {
  return channel.split(":")[0];
}

function machineName(): string {
  return hostname().replace(/\.local$/i, "");
}

// Two clients describing an un-minted backend at once must not each mint their
// own id (the last write would win and the other client would key its saved
// backend on an id that never persists). Share the in-flight mint instead.
let minting: Promise<string> | null = null;

// ── Pairing codes ──

const CODE_TTL_MS = 5 * 60 * 1000;

interface IssuedCode {
  hash: string;
  expiresAt: number;
}

// A handful of short-lived entries at most; scanned with constant-time compares.
let issued: IssuedCode[] = [];

function pruneExpired(now: number): void {
  issued = issued.filter((entry) => entry.expiresAt > now);
}

/** Test seam — forget every outstanding pairing code. */
export function clearPairingCodes(): void {
  issued = [];
}

/**
 * The link a QR encodes. The secret rides in the fragment so it never lands in
 * a request log should the link ever be opened as an https URL.
 */
export function buildPairingLink(params: {
  code: string;
  name: string;
  endpoints: string[];
}): string {
  const query = new URLSearchParams();
  query.set("code", params.code);
  query.set("name", params.name);
  for (const endpoint of params.endpoints) query.append("endpoint", endpoint);
  return `mains://pair#${query.toString()}`;
}

function toPairedDevice(record: PairedDeviceRecord): PairedDevice {
  return {
    id: record.id,
    name: record.name,
    platform: record.platform,
    appVersion: record.appVersion,
    createdAt: record.createdAt,
    lastSeenAt: record.lastSeenAt,
  };
}

export const backendService = {
  // ── Identity ──

  /** This install's stable id — minted on first use, then persisted for good. */
  async getBackendId(): Promise<string> {
    const settings = await appSettingsService.getSettings();
    if (settings.backendId) return settings.backendId;
    if (!minting) {
      minting = (async () => {
        const backendId = randomUUID();
        await appSettingsService.setBackendId(backendId);
        return backendId;
      })().finally(() => {
        minting = null;
      });
    }
    return minting;
  },

  async describe(): Promise<BackendDescriptor> {
    const backendId = await this.getBackendId();
    const capabilities = [
      ...new Set(registeredChannels().map(namespaceOf)),
    ].sort();
    return {
      backendId,
      name: machineName(),
      appVersion: app.getVersion(),
      protocolVersion: WS_PROTOCOL_VERSION,
      capabilities,
      serverTime: new Date().toISOString(),
    };
  },

  // ── Pairing ──

  /**
   * Mint a one-time code. `endpoints` are the URLs a phone could reach this
   * backend on (http(s)://host:port), most private first.
   */
  async createPairingCode(endpoints: string[]): Promise<PairingCode> {
    if (endpoints.length === 0) {
      throw new Error(
        "No address a phone could reach — turn on network access or Tailscale HTTPS first",
      );
    }
    const now = Date.now();
    pruneExpired(now);
    const code = generateToken();
    const expiresAt = now + CODE_TTL_MS;
    issued.push({ hash: hashToken(code), expiresAt });
    const { name } = await this.describe();
    return {
      code,
      link: buildPairingLink({ code, name, endpoints }),
      expiresAt: new Date(expiresAt),
    };
  },

  /** Exchange a code for a device token. The code is spent whether or not the insert succeeds. */
  async pairDevice(input: unknown): Promise<PairDeviceResult> {
    const parsed = parsePairDeviceInput(input);
    pruneExpired(Date.now());
    const presented = hashToken(parsed.code);
    const index = issued.findIndex((entry) => tokensMatch(entry.hash, presented));
    if (index === -1) {
      throw new Error("Pairing code is invalid or has expired");
    }
    issued.splice(index, 1);

    const deviceToken = generateToken();
    const deviceId = randomUUID();
    await backendRepo.insertPairedDevice({
      id: deviceId,
      name: parsed.deviceName,
      platform: parsed.platform,
      appVersion: parsed.appVersion ?? null,
      tokenHash: hashToken(deviceToken),
    });
    return { deviceId, deviceToken, backend: await this.describe() };
  },

  /** Resolve a presented device token, recording the sighting. Null when unknown or revoked. */
  async verifyDeviceToken(token: string): Promise<{ deviceId: string } | null> {
    const device = await backendRepo.findActivePairedDeviceByTokenHash(
      hashToken(token),
    );
    if (!device) return null;
    await backendRepo.touchPairedDeviceLastSeen(device.id);
    return { deviceId: device.id };
  },

  async listPairedDevices(): Promise<PairedDevice[]> {
    const records = await backendRepo.listActivePairedDevices();
    return records.map(toPairedDevice);
  },

  async revokePairedDevice(id: string): Promise<void> {
    const revoked = await backendRepo.revokePairedDevice(id);
    if (!revoked) throw new Error("Paired device not found");
  },
};
