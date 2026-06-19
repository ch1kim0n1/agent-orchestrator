import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateTask = vi.fn();

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    config: {
      projects: {
        agentmesh: { defaultBranch: "main" },
      },
    },
    coordinationService: {
      createTask: mockCreateTask,
    },
  })),
}));

import { POST as createTaskPOST } from "@/app/api/agentmesh/tasks/route";

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(
    new URL(url, "http://localhost:3000"),
    init as ConstructorParameters<typeof NextRequest>[1],
  );
}

describe("POST /api/agentmesh/tasks — title validation", () => {
  beforeEach(() => {
    mockCreateTask.mockReset();
  });

  it("returns 400 when title is empty string", async () => {
    const res = await createTaskPOST(
      makeRequest("/api/agentmesh/tasks", {
        method: "POST",
        body: JSON.stringify({ title: "", description: "d", projectId: "agentmesh" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "title is required" });
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it("returns 400 when title is whitespace only", async () => {
    const res = await createTaskPOST(
      makeRequest("/api/agentmesh/tasks", {
        method: "POST",
        body: JSON.stringify({ title: "   ", description: "d", projectId: "agentmesh" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "title is required" });
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it("returns 400 when title is missing", async () => {
    const res = await createTaskPOST(
      makeRequest("/api/agentmesh/tasks", {
        method: "POST",
        body: JSON.stringify({ description: "d", projectId: "agentmesh" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "title is required" });
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it("returns 200 when title is valid", async () => {
    mockCreateTask.mockResolvedValueOnce({
      id: "task-abc",
      title: "Valid title",
      status: "created",
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await createTaskPOST(
      makeRequest("/api/agentmesh/tasks", {
        method: "POST",
        body: JSON.stringify({ title: "Valid title", description: "d", projectId: "agentmesh" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockCreateTask).toHaveBeenCalledOnce();
  });
});
