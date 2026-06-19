/**
 * QA Gate 4.10 + 4.11 — Multi-agent parallel run and session restore
 * Issue: https://github.com/ch1kim0n1/parallel-agents/issues/35
 *
 * Automated: create 3 tasks in parallel, all succeed; tasks are independent;
 *            individual task deletion does not affect others.
 * Manual (it.todo): spawning real agents and verifying parallel operation in dashboard.
 *
 * Requires ao start running at AO_TEST_BASE_URL (default http://localhost:3000).
 */

import { afterAll, describe, expect, it } from "vitest";

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

async function createTask(title: string): Promise<{ id: string; status: string; branch: string }> {
  const r = await fetch(`${BASE}/api/agentmesh/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      description: `Multi-agent test task: ${title}`,
      role: "builder",
      priority: "medium",
      projectId: "agentmesh",
    }),
  });
  if (!r.ok) throw new Error(`createTask failed: ${r.status}`);
  return r.json() as Promise<{ id: string; status: string; branch: string }>;
}

async function deleteTask(id: string): Promise<void> {
  await fetch(`${BASE}/api/agentmesh/tasks/${id}`, { method: "DELETE" }).catch(() => {});
}

describe.skipIf(!serverUp)("QA 4.10 — Multi-agent parallel (live server)", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdIds.map(deleteTask));
  });

  it("creates 3 tasks simultaneously — all succeed with unique IDs and branches", async () => {
    const results = await Promise.all([
      createTask("QA35 Agent Task Alpha"),
      createTask("QA35 Agent Task Beta"),
      createTask("QA35 Agent Task Gamma"),
    ]);

    for (const task of results) {
      createdIds.push(task.id);
      expect(task.status).toBe("created");
      expect(task.branch).toMatch(/^task\//);
    }

    // All IDs must be unique
    const ids = results.map((t) => t.id);
    expect(new Set(ids).size).toBe(3);

    // All branches must be unique (no collision)
    const branches = results.map((t) => t.branch);
    expect(new Set(branches).size).toBe(3);
  }, 15_000);

  it("all 3 tasks appear in GET /api/agentmesh/tasks", async () => {
    const r = await fetch(`${BASE}/api/agentmesh/tasks`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { tasks: Array<{ id: string }> };
    const allIds = body.tasks.map((t) => t.id);
    for (const id of createdIds) {
      expect(allIds).toContain(id);
    }
  });

  it("deleting one task does not affect the others", async () => {
    if (createdIds.length < 3) return;

    const [idToDelete, ...survivors] = createdIds;
    await deleteTask(idToDelete!);

    // Deleted task must return 404
    const deleted = await fetch(`${BASE}/api/agentmesh/tasks/${idToDelete}`);
    expect(deleted.status).toBe(404);

    // Survivors must still return 200
    for (const id of survivors) {
      const r = await fetch(`${BASE}/api/agentmesh/tasks/${id}`);
      expect(r.status).toBe(200);
    }

    // Remove from cleanup list — already deleted
    const idx = createdIds.indexOf(idToDelete!);
    if (idx !== -1) createdIds.splice(idx, 1);
  }, 10_000);

  it("task state is independent — starting one task does not change another", async () => {
    if (createdIds.length < 2) return;

    const [idA, idB] = createdIds;

    // Check initial state
    const beforeB = await fetch(`${BASE}/api/agentmesh/tasks/${idB}`);
    const taskBBefore = (await beforeB.json()) as { status: string };
    const statusBefore = taskBBefore.status;

    // Start task A (will likely fail — no real adapter — but state machine fires)
    await fetch(`${BASE}/api/agentmesh/tasks/${idA}/start`, { method: "POST" }).catch(() => {});

    // Task B status must be unchanged
    const afterB = await fetch(`${BASE}/api/agentmesh/tasks/${idB}`);
    if (afterB.ok) {
      const taskBAfter = (await afterB.json()) as { status: string };
      expect(taskBAfter.status).toBe(statusBefore);
    }
  }, 10_000);
});

describe("QA 4.10/4.11 — Multi-agent parallel + restore (manual checklist)", () => {
  it.todo("spawn 3 sessions against 3 different GitHub issues simultaneously");
  it.todo("all 3 appear in dashboard within 10s (SSE push)");
  it.todo("lifecycle manager polls all 3 independently (check ao status)");
  it.todo("kill one session mid-task: other 2 continue unaffected");
  it.todo("ao status shows mixed states (working, killed, pr_open) correctly");
  it.todo("spawn 2 sessions with active agents, ao stop, ao start --restore");
  it.todo("both sessions reappear with correct prior state after restore");
  it.todo("agent processes re-attached or correctly marked terminated after restore");
});
