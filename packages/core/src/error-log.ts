/**
 * Tiny structured fatal-error logger.
 *
 * Appends a single JSON line per fatal event to `~/.agent-orchestrator/error.log`
 * so daemon crashes (uncaughtException / unhandledRejection) leave a durable,
 * greppable trail without any external dependency. Best-effort: this logger
 * never throws — if it cannot write, it stays silent rather than masking the
 * original fatal error.
 *
 * NOTE: needs a barrel export added to `packages/core/src/index.ts`:
 *   export { logFatal } from "./error-log.js";
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getEnvDefaults } from "./platform.js";

function errorLogPath(): string {
  return join(getEnvDefaults().HOME, ".agent-orchestrator", "error.log");
}

/** Append a structured fatal-error record. Swallows its own I/O errors. */
export function logFatal(scope: string, err: unknown): void {
  try {
    const entry = {
      ts: new Date().toISOString(),
      scope,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    };
    const path = errorLogPath();
    mkdirSync(join(path, ".."), { recursive: true });
    appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf-8");
  } catch {
    // Best-effort — never let logging mask the original failure.
  }
}
