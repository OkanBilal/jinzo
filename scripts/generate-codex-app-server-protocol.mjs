#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(
  repoRoot,
  "src/main/modules/providers/adapters/codex-app-server-protocol/generated",
);
const codexBinary = process.env.CODEX_BINARY || "codex";
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "mains-codex-protocol-"),
);

// Keep this list focused on the stable protocol surfaces consumed as typed
// data by codex.driver.ts. Transitive imports are discovered automatically.
const roots = [
  "InitializeParams.ts",
  "InitializeResponse.ts",
  "v2/ExperimentalFeatureListParams.ts",
  "v2/ExperimentalFeatureListResponse.ts",
  "v2/GetAccountParams.ts",
  "v2/GetAccountResponse.ts",
  "v2/GetAccountRateLimitsResponse.ts",
  "v2/SkillsListParams.ts",
  "v2/SkillsListResponse.ts",
];

function normalizeVersion(rawVersion) {
  return rawVersion.match(/\d+\.\d+\.\d+(?:-[^\s]+)?/)?.[0] ?? rawVersion.trim();
}

function importedFiles(relativePath) {
  const absolutePath = path.join(temporaryRoot, relativePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  const directory = path.posix.dirname(relativePath);
  const dependencies = [];
  for (const match of source.matchAll(/from\s+"(\.[^"]+)"/g)) {
    const dependency = path.posix.normalize(
      path.posix.join(directory, `${match[1]}.ts`),
    );
    dependencies.push(dependency);
  }
  return dependencies;
}

try {
  execFileSync(
    codexBinary,
    ["app-server", "generate-ts", "--out", temporaryRoot],
    { stdio: "inherit" },
  );

  const pending = [...roots];
  const selected = new Set();
  while (pending.length > 0) {
    const relativePath = pending.pop();
    if (!relativePath || selected.has(relativePath)) continue;
    if (!fs.existsSync(path.join(temporaryRoot, relativePath))) {
      throw new Error(`Generated protocol file is missing: ${relativePath}`);
    }
    selected.add(relativePath);
    pending.push(...importedFiles(relativePath));
  }

  fs.rmSync(outputRoot, { recursive: true, force: true });
  for (const relativePath of [...selected].sort()) {
    const source = path.join(temporaryRoot, relativePath);
    const destination = path.join(outputRoot, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }

  const cliVersion = normalizeVersion(
    execFileSync(codexBinary, ["--version"], { encoding: "utf8" }),
  );
  const files = [...selected].sort().map((relativePath) => {
    const contents = fs.readFileSync(path.join(outputRoot, relativePath));
    return {
      path: relativePath,
      sha256: crypto.createHash("sha256").update(contents).digest("hex"),
    };
  });
  fs.writeFileSync(
    path.join(outputRoot, "manifest.json"),
    `${JSON.stringify({ cliVersion, files }, null, 2)}\n`,
  );
  process.stdout.write(
    `Generated ${files.length} Codex app-server protocol files from CLI ${cliVersion}.\n`,
  );
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
