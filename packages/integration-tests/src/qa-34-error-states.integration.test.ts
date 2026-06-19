/**
 * QA Gate 4.9 — Error states and disconnection resilience
 * Issue: https://github.com/ch1kim0n1/parallel-agents/issues/34
 *
 * Automated: API error responses (404, 400, 405), health endpoint shape.
 * Manual (it.todo): backend kill → dashboard banner; reconnect; bad GitHub token;
 *                   agent process kill → state machine transition.
 *
 * Requires ao start running at AO_TEST_BASE_URL (default http://localhost:3000).
 */

import { describe, expect, it } from "vitest";

const BASE = process.env["AO_TEST_BASE_URL"] ?? "http://localhost:3000";

async function isServerUp(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2_000) });
    return r.ok;
  } catch {
    return false;
  }
}

const serverUp = await isServerUp();

describe.skipIf(!serverUp)("QA 4.9 — Error states (live server API checks)", () => {
  it("GET /api/agentmesh/tasks/nonexistent — returns JSON 404, not 500", async () => {
    const r = await fetch(`${BASE}/api/agentmesh/tasks/TASK-fake-id`);
    expect(r.status).toBe(404);
    // Must be JSON, not HTML error page
    const ct = r.headers.get("content-type") ?? "";
    expect(ct).toMatch(/application\/json/);
    const body = (await r.json()) as { error: string };
    expect(typeof body.error).toBe("string");
    expect(body.error).not.toBe("");
  });

  it("POST /api/agentmesh/tasks with empty title — returns 400, not 500", async () => {
    const r = await fetch(`${BASE}/api/agentmesh/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    expect(r.status).toBe(400);
    const ct = r.headers.get("content-type") ?? "";
    expect(ct).toMatch(/application\/json/);
    const body = (await r.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  it("POST /api/agentmesh/tasks with missing body fields — returns 400, not 500", async () => {
    const r = await fetch(`${BASE}/api/agentmesh/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    // Missing title must be rejected — not swallowed as a 500
    expect(r.status).toBe(400);
  });

  it("GET /api/agentmesh/tasks/:id/qa for nonexistent task — returns 404 JSON", async () => {
    const r = await fetch(`${BASE}/api/agentmesh/tasks/TASK-fake-id-qa/qa`);
    expect(r.status).toBe(404);
    const body = await r.json();
    expect(body).toHaveProperty("error");
  });

  it("GET /api/health — always returns 200 ok", async () => {
    const r = await fetch(`${BASE}/api/health`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  it("nonexistent API route — returns non-500 (404 or 405)", async () => {
    const r = await fetch(`${BASE}/api/this-route-does-not-exist-qa34`);
    // Should be 404, not 500
    expect(r.status).not.toBe(500);
  });
});

describe("QA 4.9 — Disconnection resilience (manual checklist)", () => {
  it.todo("open dashboard, run ao stop → shows 'disconnected' banner, not blank screen");
  it.todo("run ao start again while dashboard open → dashboard reconnects within 10s");
  it.todo("configure invalid GitHub token, spawn session → warning badge, not crash");
  it.todo("kill agent process PID manually → session transitions detecting → terminated");
});
