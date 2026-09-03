import { WS_PROTOCOL_VERSION } from "@mains/contracts/ws-protocol";

import { backendSession } from "../backend-session";
import { savePairedBackend } from "../paired-backend-store";
import { DEMO_BACKEND_ID, DEMO_ENDPOINT } from "./transport";
import snapshot from "./demo-snapshot.json";

/**
 * Enter the demo: a pairing record for the demo Mac goes where a real one
 * would, and the session connects to it through the demo transport. Leaving
 * is the ordinary way out — Settings → Forget this Mac.
 */
export async function startDemo(): Promise<void> {
  await savePairedBackend({
    backendId: DEMO_BACKEND_ID,
    name: "Demo Mac",
    endpoints: [DEMO_ENDPOINT],
    deviceId: "demo-device",
    deviceToken: "demo-token",
    pairedAt: new Date().toISOString(),
    appVersion: snapshot.backend.appVersion,
    protocolVersion: WS_PROTOCOL_VERSION,
  });
  await backendSession.start();
}
