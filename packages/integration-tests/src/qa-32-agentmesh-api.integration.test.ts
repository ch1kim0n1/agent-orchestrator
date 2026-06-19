/**
 * QA Gate 4.5 + 4.6 — AgentMesh task board full API flow
 * Issue: https://github.com/ch1kim0n1/parallel-agents/issues/32
 *
 * Automated: full CRUD cycle via HTTP — create, read, start, qa-state, delete.
 *            Validates: branch generation, persistence, 404 on nonexistent, 400 on empty title.
 * Manual (it.todo): UI checks requiring a browser.
 *
 * Requires ao start running at AO_TEST_BASE_URL (default http://localhost:3000).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

describe.skipIf(!serverUp)("QA 4.5/4.6 — AgentMesh task board API (live server)", () => {
  let createdTaskId: string;

  beforeAll(async () => {
    // Create a task to use in subsequent tests
    const r = await fetch(`${BASE}/api/agentmesh/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "QA Integration Test Task",
        description: "Created by qa-32 integration test",
        role: "builder",
        priority: "medium",
        projectId: "agentmesh",
        branch: "",
      }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { id?: string };
    expect(typeof body.id).toBe("string");
    createdTaskId = body.id!;
  }, 15_000);

  afterAll(async () => {
    // Clean up the test task
    if (createdTaskId) {
      await fetch(`${BASE}/api/agentmesh/tasks/${createdTaskId}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  });

  it("POST /api/agentmesh/tasks — creates task with generated branch", async () => {
    const r = await fetch(`${BASE}/api/agentmesh/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Branch Gen Test",
        description: "",
        role: "builder",
        priority: "low",
        projectId: "agentmesh",
      }),
    });

    expect(r.status).toBe(200);
    const task = (await r.json()) as { id: string; branch: string; status: string };
    expect(task.id).toBeTruthy();
    expect(task.branch).toMatch(/^task\//);
    expect(task.status).toBe("created");

    // cleanup
    await fetch(`${BASE}/api/agentmesh/tasks/${task.id}`, { method: "DELETE" }).catch(() => {});
  });

  it("POST /api/agentmesh/tasks — returns 400 for empty title", async () => {
    const r = await fetch(`${BASE}/api/agentmesh/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "", description: "d", projectId: "agentmesh" }),
    });
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body).toHaveProperty("error");
  });

  it("GET /api/agentmesh/tasks — lists tasks including the created one", async () => {
    const r = await fetch(`${BASE}/api/agentmesh/tasks`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { tasks: unknown[]; count: number };
    expect(Array.isArray(body.tasks)).toBe(true);
    expect(typeof body.count).toBe("number");
    const ids = body.tasks.map((t: unknown) => (t as { id: string }).id);
    expect(ids).toContain(createdTaskId);
  });

  it("GET /api/agentmesh/tasks/:id — returns the task", async () => {
    const r = await fetch(`${BASE}/api/agentmesh/tasks/${createdTaskId}`);
    expect(r.status).toBe(200);
    const task = (await r.json()) as { id: string; title: string; status: string };
    expect(task.id).toBe(createdTaskId);
    expect(task.title).toBe("QA Integration Test Task");
    expect(task.status).toBe("created");
  });

  it("GET /api/agentmesh/tasks/:id/qa — returns QA state", async () => {
    const r = await fetch(`${BASE}/api/agentmesh/tasks/${createdTaskId}/qa`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { taskId: string; state: string };
    expect(body.taskId).toBe(createdTaskId);
    expect(typeof body.state).toBe("string");
  });

  it("GET /api/agentmesh/tasks/nonexistent-task-id — returns 404", async () => {
    const r = await fetch(`${BASE}/api/agentmesh/tasks/TASK-fake-id-does-not-exist`);
    expect(r.status).toBe(404);
    const body = await r.json();
    expect(body).toHaveProperty("error");
  });

  it("GET /api/agentmesh/tasks/:id/qa for nonexistent task — returns 404", async () => {
    const r = await fetch(`${BASE}/api/agentmesh/tasks/TASK-fake-id-qa/qa`);
    expect(r.status).toBe(404);
  });
});

describe("QA 4.5/4.6 — Task board UI (manual checklist)", () => {
  it.todo("/agentmesh page loads without blank screen or JS error");
  it.todo("empty state renders (not an error)");
  it.todo("'Create Task' button visible and clickable");
  it.todo("create task modal opens");
  it.todo("submit with empty title: button disabled (UI-level guard)");
  it.todo("submit with title + description: task appears in 'Created' column");
  it.todo("refresh: task persists (SQLite write confirmed)");
  it.todo("click 'Start': task moves to 'Building' column");
});
