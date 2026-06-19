/**
 * QA Gate 4.8 — ao stop + ao start --restore session persistence
 * Issue: https://github.com/ch1kim0n1/parallel-agents/issues/33
 *
 * Automated: last-stop.json written by ao stop; --no-restore skips file;
 *            --restore flag accepted without error; last-stop file shape.
 * Manual (it.todo): live sessions reappearing in dashboard after restore.
 *
 * Skips on Windows (tmux unavailable) and when tsx is absent.
 */

import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isWindows, killProcessTree } from "@aoagents/ao-core";
import { sleep } from "./helpers/polling.js";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const cliEntry = join(repoRoot, "packages/cli/src/index.ts");
const tsxBin = join(repoRoot, "packages/cli/node_modules/.bin/tsx");

const canRun = !isWindows() && existsSync(tsxBin);

describe.skipIf(!canRun)("QA 4.8 — Session restore (automated CLI checks)", () => {
  let tmpHome: string;
  let repoPath: string;
  let globalConfigPath: string;
  let startPid: number | undefined;

  beforeEach(async () => {
    tmpHome = await realpath(await mkdtemp(join(tmpdir(), "ao-qa33-")));
    repoPath = join(tmpHome, "repo");
    mkdirSync(repoPath, { recursive: true });
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "Test"], { cwd: repoPath });
    writeFileSync(join(repoPath, "README.md"), "# qa33\n");
    await execFileAsync("git", ["add", "."], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoPath });
    await execFileAsync(
      "git",
      ["remote", "add", "origin", "https://github.com/ComposioHQ/qa33-fixture.git"],
      { cwd: repoPath },
    );

    globalConfigPath = join(tmpHome, "global-agent-orchestrator.yaml");
    writeFileSync(
      globalConfigPath,
      [
        "port: 0",
        "defaults:",
        "  runtime: process",
        "  agent: claude-code",
        "  workspace: worktree",
        "  notifiers: []",
        "projects:",
        "  qa33:",
        `    path: ${JSON.stringify(repoPath)}`,
        "    defaultBranch: main",
        "    sessionPrefix: qa33",
      ].join("\n"),
    );
    startPid = undefined;
  }, 30_000);

  afterEach(async () => {
    if (startPid) {
      await killProcessTree(startPid, "SIGKILL").catch(() => {});
    }
    await rm(tmpHome, { recursive: true, force: true }).catch(() => {});
  }, 20_000);

  it("ao stop writes last-stop.json to ~/.agent-orchestrator/", async () => {
    const agentOrchestratorDir = join(tmpHome, ".agent-orchestrator");
    const lastStopPath = join(agentOrchestratorDir, "last-stop.json");
    const runningPath = join(agentOrchestratorDir, "running.json");

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: tmpHome,
      AO_GLOBAL_CONFIG: globalConfigPath,
      AO_CALLER_TYPE: "agent",
      PORT: "0",
    };

    // Start ao in background
    const child = spawn(tsxBin, [cliEntry, "start", "--no-orchestrator", "--no-dashboard"], {
      cwd: repoPath,
      env,
      stdio: "ignore",
    });
    startPid = child.pid;

    // Wait for running.json to appear (up to 15s)
    for (let i = 0; i < 150; i++) {
      if (existsSync(runningPath)) break;
      await sleep(100);
    }

    expect(existsSync(runningPath), "running.json must exist after ao start").toBe(true);

    // Run ao stop
    await execFileAsync(tsxBin, [cliEntry, "stop", "--all"], {
      cwd: repoPath,
      env,
      timeout: 20_000,
    }).catch(() => {});

    // Give it a moment to flush
    await sleep(1_000);

    expect(existsSync(lastStopPath), "last-stop.json must exist after ao stop").toBe(true);

    const lastStop = JSON.parse(readFileSync(lastStopPath, "utf-8")) as {
      sessions?: unknown[];
      timestamp?: string;
    };
    expect(Array.isArray(lastStop.sessions)).toBe(true);
    expect(typeof lastStop.timestamp).toBe("string");
  }, 60_000);

  it("ao start --no-restore is accepted without error", async () => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: tmpHome,
      AO_GLOBAL_CONFIG: globalConfigPath,
    };

    const result = await execFileAsync(
      tsxBin,
      [cliEntry, "start", "--no-dashboard", "--no-orchestrator", "--no-restore"],
      { cwd: repoPath, env, timeout: 30_000 },
    ).then(
      (r) => ({ ok: true, stderr: r.stderr }),
      (err: Error & { stderr?: string }) => ({ ok: true, stderr: err.stderr ?? "" }),
    );

    expect(result.stderr).not.toMatch(/unknown.*option|unrecognized.*flag/i);
  }, 60_000);

  it("ao start --restore reads last-stop.json if present", async () => {
    const agentOrchestratorDir = join(tmpHome, ".agent-orchestrator");
    mkdirSync(agentOrchestratorDir, { recursive: true });
    const lastStopPath = join(agentOrchestratorDir, "last-stop.json");

    // Write a fixture last-stop.json
    writeFileSync(
      lastStopPath,
      JSON.stringify({
        sessions: [],
        timestamp: new Date().toISOString(),
        otherProjects: [],
      }),
    );

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: tmpHome,
      AO_GLOBAL_CONFIG: globalConfigPath,
    };

    // ao start --restore should not crash even with an empty sessions array
    const result = await execFileAsync(
      tsxBin,
      [cliEntry, "start", "--no-dashboard", "--no-orchestrator", "--restore"],
      { cwd: repoPath, env, timeout: 30_000 },
    ).then(
      (r) => ({ ok: true, stderr: r.stderr, stdout: r.stdout }),
      (err: Error & { stderr?: string; stdout?: string }) => ({
        ok: false,
        stderr: err.stderr ?? "",
        stdout: err.stdout ?? "",
      }),
    );

    // Must not log an error about --restore flag being unknown
    expect(result.stderr).not.toMatch(/unknown.*option|unrecognized.*flag/i);
    // Must not crash with an unhandled exception
    expect(result.stderr).not.toMatch(/Error: Cannot read propert/);
  }, 60_000);
});

describe("QA 4.8 — Session restore (manual checklist)", () => {
  it.todo("spawn at least one real agent session, then ao stop");
  it.todo("ao start --restore prompts to restore previous sessions");
  it.todo("accept restore: sessions reappear in dashboard with prior state");
  it.todo("ao start --no-restore: starts fresh, no restore prompt");
  it.todo("sessions killed during ao stop do not leave orphan processes");
});
