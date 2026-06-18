import { spawn, type ChildProcess } from "child_process";
import { createServer, connect as netConnect } from "net";
import { readFile } from "fs/promises";
import { homedir } from "os";
import path from "path";
import {
  ok,
  fail,
  type ServiceResponse,
} from "../../../shared/ipc-kit/service-response";
import { generateToken } from "../../ipc-kit/ws-auth";

/**
 * SSH access for remote backends. The `ssh` client runs on the LOCAL machine and
 * forwards a loopback port to a `mains serve` instance on the remote host, so the
 * renderer connects to `ws://127.0.0.1:<localPort>` and all traffic is tunneled
 * (encrypted + authenticated by SSH). This is the secure, zero-infrastructure
 * path — the remote backend never has to listen on a routable interface.
 *
 * See docs/design/remote-backend.md (Phase 5).
 */

export interface SshHost {
  alias: string;
  hostName: string | null;
  user: string | null;
  port: number | null;
}

export interface OpenTunnelInput {
  /** SSH target — an alias from ~/.ssh/config or `user@host`. */
  host: string;
  /** Loopback port the backend listens on, on the remote. */
  remotePort: number;
  /**
   * Optional command to launch the backend on the remote (e.g.
   * `cd ~/mains && npm run serve -- --port=8787`). When omitted, the tunnel
   * assumes a backend is already running (`ssh -N`).
   */
  remoteCommand?: string | null;
}

export interface TunnelHandle {
  id: string;
  localPort: number;
  localUrl: string;
  /**
   * Ephemeral pairing token generated when this tunnel auto-launches the backend
   * (via `remoteCommand`). The renderer must present it on the WS connection.
   * Absent when connecting to an already-running backend.
   */
  token?: string;
}

/** Parse the relevant fields out of an ~/.ssh/config file. Pure + best-effort. */
export function parseSshConfig(text: string): SshHost[] {
  const hosts: SshHost[] = [];
  let current: {
    aliases: string[];
    hostName: string | null;
    user: string | null;
    port: number | null;
  } | null = null;

  const flush = () => {
    if (!current) return;
    for (const alias of current.aliases) {
      hosts.push({
        alias,
        hostName: current.hostName,
        user: current.user,
        port: current.port,
      });
    }
    current = null;
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    const key = parts[0].toLowerCase();
    const value = parts.slice(1).join(" ");
    if (key === "host") {
      flush();
      // Skip pattern hosts (`*`, `?`); keep concrete aliases only.
      const aliases = parts
        .slice(1)
        .filter((a) => !a.includes("*") && !a.includes("?"));
      current = { aliases, hostName: null, user: null, port: null };
    } else if (current) {
      if (key === "hostname") current.hostName = value;
      else if (key === "user") current.user = value;
      else if (key === "port") {
        const p = Number(value);
        if (Number.isFinite(p)) current.port = p;
      }
    }
  }
  flush();
  return hosts;
}

/** Build the `ssh` argv for a loopback forward. Pure + testable. */
export function buildSshArgs(input: {
  localPort: number;
  host: string;
  remotePort: number;
  remoteCommand?: string | null;
}): string[] {
  const args = [
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "ServerAliveInterval=30",
    "-o",
    "ServerAliveCountMax=3",
    "-L",
    `${input.localPort}:127.0.0.1:${input.remotePort}`,
  ];
  if (input.remoteCommand && input.remoteCommand.trim()) {
    args.push(input.host, input.remoteCommand.trim());
  } else {
    args.push("-N", input.host);
  }
  return args;
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port =
        typeof address === "object" && address ? address.port : 0;
      server.close(() => (port ? resolve(port) : reject(new Error("No free port"))));
    });
  });
}

/** Resolve once the local forwarded port accepts a connection, else reject. */
function waitForLocalPort(
  port: number,
  child: ChildProcess,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let stderr = "";
  child.stderr?.on("data", (d) => {
    stderr += String(d);
  });
  let exited = false;
  child.on("exit", () => {
    exited = true;
  });

  return new Promise<void>((resolve, reject) => {
    const attempt = () => {
      if (exited) {
        reject(new Error(`ssh exited: ${stderr.trim() || "unknown error"}`));
        return;
      }
      const socket = netConnect({ port, host: "127.0.0.1" });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(
            new Error(
              `tunnel not ready after ${timeoutMs}ms${stderr.trim() ? `: ${stderr.trim()}` : ""}`,
            ),
          );
        } else {
          setTimeout(attempt, 300);
        }
      });
    };
    attempt();
  });
}

const tunnels = new Map<string, ChildProcess>();
let tunnelCounter = 0;

export const sshService = {
  /** List concrete hosts from ~/.ssh/config (best-effort; empty if none). */
  async discoverHosts(): Promise<ServiceResponse<SshHost[]>> {
    try {
      const configPath = path.join(homedir(), ".ssh", "config");
      const text = await readFile(configPath, "utf-8").catch(() => "");
      return ok(parseSshConfig(text));
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : "Failed to read SSH config",
      );
    }
  },

  /** Open a tunnel and return the local ws URL the renderer should connect to. */
  async openTunnel(
    input: OpenTunnelInput,
  ): Promise<ServiceResponse<TunnelHandle>> {
    if (!input?.host || typeof input.host !== "string") {
      return fail("SSH host is required");
    }
    if (!Number.isInteger(input.remotePort) || input.remotePort <= 0) {
      return fail("A valid remote port is required");
    }
    let child: ChildProcess | null = null;
    try {
      const localPort = await getFreePort();

      // When we launch the backend ourselves, generate an ephemeral token and
      // hand it to the remote serve via the environment, then present the same
      // token on the (tunneled) WS connection. Nothing is persisted.
      let token: string | undefined;
      let remoteCommand = input.remoteCommand?.trim() || undefined;
      if (remoteCommand) {
        token = generateToken();
        remoteCommand = `export MAINS_SERVE_TOKEN=${token}; ${remoteCommand}`;
      }

      const args = buildSshArgs({
        localPort,
        host: input.host,
        remotePort: input.remotePort,
        remoteCommand,
      });
      child = spawn("ssh", args, { stdio: ["ignore", "pipe", "pipe"] });
      const id = `tunnel-${++tunnelCounter}`;
      tunnels.set(id, child);
      child.on("exit", () => tunnels.delete(id));

      await waitForLocalPort(localPort, child, 15_000);
      return ok({
        id,
        localPort,
        localUrl: `ws://127.0.0.1:${localPort}`,
        token,
      });
    } catch (error) {
      if (child && !child.killed) child.kill();
      return fail(
        error instanceof Error ? error.message : "Failed to open SSH tunnel",
      );
    }
  },

  async closeTunnel(id: string): Promise<ServiceResponse<void>> {
    const child = tunnels.get(id);
    if (child && !child.killed) child.kill();
    tunnels.delete(id);
    return ok(undefined);
  },

  /** Kill every tunnel (called on app shutdown). */
  closeAllTunnels(): void {
    for (const child of tunnels.values()) {
      if (!child.killed) child.kill();
    }
    tunnels.clear();
  },
};
