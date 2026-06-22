/**
 * Regression test: .env.example files exist and are non-empty (issue #65).
 *
 * Guards against the example files being accidentally deleted or emptied,
 * which would leave new users and CI pipelines with no way to discover
 * required environment variables.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testFileDir = dirname(fileURLToPath(import.meta.url));
// packages/core/src/__tests__/ -> repo root
const repoRoot = join(testFileDir, "..", "..", "..", "..");

function envExample(relPath: string): string {
  const fullPath = join(repoRoot, relPath);
  expect(existsSync(fullPath), `${relPath} should exist`).toBe(true);
  return readFileSync(fullPath, "utf-8");
}

describe(".env.example files exist and are non-empty (issue #65)", () => {
  it("root .env.example exists and documents required vars", () => {
    const content = envExample(".env.example");
    expect(content.length).toBeGreaterThan(500);
    // Must document the terminal ports (the one var that's always required)
    expect(content).toContain("TERMINAL_PORT");
    expect(content).toContain("DIRECT_TERMINAL_PORT");
    // Must document webhook secret (referenced by agent-orchestrator.yaml)
    expect(content).toContain("GITHUB_WEBHOOK_SECRET");
    // Must document the common agent tokens for discoverability
    expect(content).toContain("ANTHROPIC_API_KEY");
    expect(content).toContain("GITHUB_TOKEN");
    // Must warn against committing secrets
    expect(content.toLowerCase()).toContain("never commit");
  });

  it("packages/web/.env.local.example exists and documents terminal ports", () => {
    const content = envExample("packages/web/.env.local.example");
    expect(content.length).toBeGreaterThan(200);
    expect(content).toContain("TERMINAL_PORT");
    expect(content).toContain("NEXT_PUBLIC_TERMINAL_PORT");
    expect(content).toContain("GITHUB_WEBHOOK_SECRET");
  });

  it("packages/cli/.env.example exists and documents CLI vars", () => {
    const content = envExample("packages/cli/.env.example");
    expect(content.length).toBeGreaterThan(200);
    expect(content).toContain("AO_PUBLIC_URL");
    expect(content).toContain("AO_PROJECT_ID");
  });

  it("no .env.example file is empty", () => {
    const files = [
      ".env.example",
      "packages/web/.env.local.example",
      "packages/cli/.env.example",
    ];
    for (const f of files) {
      const content = envExample(f);
      expect(content.trim().length, `${f} should not be empty`).toBeGreaterThan(0);
    }
  });
});
