/**
 * QA Gate 4.3 — Windows first-run verification
 * Issue: https://github.com/ch1kim0n1/parallel-agents/issues/30
 *
 * Automated: CLI flag contracts, process exit codes, config file shape.
 * Manual (it.todo): clean-install behaviour requiring a fresh Windows machine + npm -g.
 *
 * Runs only on Windows.
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isWindows } from "@aoagents/ao-core";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const tsxBin = join(repoRoot, "packages/cli/node_modules/.bin/tsx.CMD");
const cliEntry = join(repoRoot, "packages/cli/src/index.ts");

const canRun = isWindows() && existsSync(tsxBin);

describe.skipIf(!canRun)("QA 4.3 — Windows first-run (automated checks)", () => {
  let tmpHome: string;
  let repoPath: string;
  let globalConfigPath: string;

  beforeEach(async () => {
    tmpHome = await realpath(await mkdtemp(join(tmpdir(), "ao-qa30-")));
    repoPath = join(tmpHome, "qa30-repo");
    globalConfigPath = join(tmpHome, "global-agent-orchestrator.yaml");
    mkdirSync(repoPath, { recursive: true });
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "Test"], { cwd: repoPath });
    writeFileSync(join(repoPath, "README.md"), "# qa30\n");
    await execFileAsync("git", ["add", "."], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoPath });
    await execFileAsync(
      "git",
      ["remote", "add", "origin", "https://github.com/ComposioHQ/qa30-fixture.git"],
      { cwd: repoPath },
    );
  }, 30_000);

  afterEach(async () => {
    await rm(tmpHome, { recursive: true, force: true }).catch(() => {});
  });

  it("ao start --no-restore exits cleanly (no prompt hang)", async () => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: tmpHome,
      AO_GLOBAL_CONFIG: globalConfigPath,
      AO_CALLER_TYPE: "agent",
    };
    delete env["AO_CONFIG_PATH"];

    // --no-dashboard --no-orchestrator --no-restore must exit without hanging
    const { code } = await execFileAsync(
      tsxBin,
      [cliEntry, "start", "--no-dashboard", "--no-orchestrator", "--no-restore"],
      { cwd: repoPath, env, timeout: 30_000 },
    ).then(
      () => ({ code: 0 }),
      (err: NodeJS.ErrnoException & { code?: number }) => ({ code: err.code ?? 1 }),
    );

    // Exit 0 or known non-crash codes (no tmux on Windows = exits with 0 from process runtime)
    expect(code).toBe(0);
  }, 60_000);

  it("ao --version prints a semver string", async () => {
    const { stdout } = await execFileAsync(tsxBin, [cliEntry, "--version"], {
      cwd: repoPath,
      timeout: 15_000,
    });
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  }, 30_000);

  it("--no-restore flag is accepted without error", async () => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: tmpHome,
      AO_GLOBAL_CONFIG: globalConfigPath,
    };
    delete env["AO_CONFIG_PATH"];

    const result = await execFileAsync(
      tsxBin,
      [cliEntry, "start", "--no-dashboard", "--no-orchestrator", "--no-restore"],
      { cwd: repoPath, env, timeout: 30_000 },
    ).then(
      (r) => ({ ok: true, stderr: r.stderr }),
      (err: Error & { stderr?: string }) => ({ ok: false, stderr: err.stderr ?? "" }),
    );

    // Must not print "Unknown option" or similar
    expect(result.stderr).not.toMatch(/unknown.*option|unrecognized.*flag/i);
  }, 60_000);
});

describe("QA 4.3 — Windows first-run (manual checklist)", () => {
  it.todo("clean Windows machine: npm install -g @aoagents/ao → ao --version prints 0.9.x");
  it.todo("ao doctor shows 16 PASS, 0 FAIL on Windows (runtime-process: PASS)");
  it.todo("ao start prints 'Dashboard running at http://localhost:3000'");
  it.todo("no 'tmux: command not found' error on Windows");
  it.todo("dashboard opens at http://localhost:3000 without error banner");
  it.todo("ao stop exits cleanly, no orphan processes");
  it.todo("second ao start offers no restore prompt (no prior sessions)");
});
