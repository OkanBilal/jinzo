import { describe, it, expect } from "vitest";
import { buildSshArgs, parseSshConfig } from "./ssh.service";

describe("parseSshConfig", () => {
  it("parses host blocks with hostname/user/port", () => {
    const hosts = parseSshConfig(
      [
        "Host devbox",
        "  HostName 10.0.0.5",
        "  User me",
        "  Port 2222",
        "",
        "Host other",
        "  HostName example.com",
      ].join("\n"),
    );
    expect(hosts).toEqual([
      { alias: "devbox", hostName: "10.0.0.5", user: "me", port: 2222 },
      { alias: "other", hostName: "example.com", user: null, port: null },
    ]);
  });

  it("skips comments and pattern hosts, keeping concrete aliases", () => {
    const hosts = parseSshConfig(
      ["# a comment", "Host *", "  User x", "Host a b*", "  HostName h"].join(
        "\n",
      ),
    );
    expect(hosts.map((h) => h.alias)).toEqual(["a"]);
    expect(hosts[0].hostName).toBe("h");
  });

  it("returns an empty list for empty input", () => {
    expect(parseSshConfig("")).toEqual([]);
  });
});

describe("buildSshArgs", () => {
  it("builds a -N forward when there is no remote command", () => {
    expect(
      buildSshArgs({ localPort: 5000, host: "dev", remotePort: 8787 }),
    ).toEqual([
      "-o",
      "ExitOnForwardFailure=yes",
      "-o",
      "ServerAliveInterval=30",
      "-o",
      "ServerAliveCountMax=3",
      "-L",
      "5000:127.0.0.1:8787",
      "-N",
      "dev",
    ]);
  });

  it("appends the remote command instead of -N", () => {
    const args = buildSshArgs({
      localPort: 5000,
      host: "dev",
      remotePort: 8787,
      remoteCommand: "  npm run serve  ",
    });
    expect(args).toContain("-L");
    expect(args).not.toContain("-N");
    expect(args.slice(-2)).toEqual(["dev", "npm run serve"]);
  });
});
