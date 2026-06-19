/**
 * QA Gate 4.4 + 4.7 — Dashboard load and real-time SSE verification
 * Issue: https://github.com/ch1kim0n1/parallel-agents/issues/31
 *
 * Automated: HTTP status, response shape, SSE content-type, zero-error health check.
 * Manual (it.todo): spawning a real agent and watching SSE update the Kanban card.
 *
 * Requires ao start running at AO_TEST_BASE_URL (default http://localhost:3000).
 */

import { describe, expect, it } from "vitest";

const BASE = process.env["AO_TEST_BASE_URL"] ?? "http://localhost:3000";

async function isServerUp(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/health`, {
      signal: AbortSignal.timeout(2_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

const serverUp = await isServerUp();

describe.skipIf(!serverUp)("QA 4.4/4.7 — Dashboard + SSE (live server)", () => {
  it("GET /api/health returns 200 with status:ok", async () => {
    const r = await fetch(`${BASE}/api/health`);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toMatchObject({ status: "ok" });
    expect(typeof body.version).toBe("string");
  });

  it("dashboard root returns 200", async () => {
    const r = await fetch(`${BASE}/`);
    expect(r.status).toBe(200);
    // Must be HTML, not a JSON error
    const ct = r.headers.get("content-type") ?? "";
    expect(ct).toMatch(/text\/html/);
  });

  it("SSE /api/sessions endpoint returns text/event-stream content-type", async () => {
    const controller = new AbortController();
    const r = await fetch(`${BASE}/api/sessions`, {
      signal: controller.signal,
      headers: { Accept: "text/event-stream" },
    });
    // Immediately abort after getting headers — we only care about the content-type
    controller.abort();
    expect(r.status).toBe(200);
    const ct = r.headers.get("content-type") ?? "";
    expect(ct).toMatch(/text\/event-stream/);
  });

  it("SSE /api/sessions emits at least one data event within 6 seconds", async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);

    let received = false;
    try {
      const r = await fetch(`${BASE}/api/sessions`, {
        signal: controller.signal,
        headers: { Accept: "text/event-stream" },
      });

      const reader = r.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();

      while (!received) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        if (chunk.includes("data:")) {
          received = true;
          reader.cancel();
          break;
        }
      }
    } catch (err: unknown) {
      // AbortError is expected after timeout if no data arrived
      if ((err as Error).name !== "AbortError") throw err;
    } finally {
      clearTimeout(timeout);
    }

    expect(received).toBe(true);
  }, 10_000);
});

describe("QA 4.4/4.7 — Dashboard + SSE (manual checklist)", () => {
  it.todo(
    "spawn a real session: new Kanban card appears within 5s without page refresh (SSE push)",
  );
  it.todo("session card shows: name, status badge, branch");
  it.todo("click session card → session detail opens with terminal panel");
  it.todo("PR link appears on card after agent creates PR");
  it.todo("CI status badge updates after CI runs");
  it.todo("DevTools console: zero uncaught errors, zero 404s in Network tab");
});
