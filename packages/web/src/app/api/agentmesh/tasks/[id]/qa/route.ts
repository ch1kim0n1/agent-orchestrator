import { getCorrelationId, jsonWithCorrelation } from "@/lib/observability";
import { getServices } from "@/lib/services";
import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/agentmesh/tasks/:id/qa
 *
 * Get current QA state for a task
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = getCorrelationId(request);
  const { id: taskId } = await params;

  try {
    const { coordinationService } = await getServices();
    const task = coordinationService.getTask(taskId);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return jsonWithCorrelation(
      {
        taskId,
        state: task.status,
        updatedAt: task.updatedAt,
      },
      undefined,
      correlationId,
    );
  } catch (error) {
    console.error("Error in GET /api/agentmesh/tasks/:id/qa:", error);
    return NextResponse.json({ error: "Failed to get QA state" }, { status: 500 });
  }
}

/**
 * POST /api/agentmesh/tasks/:id/qa
 *
 * Submit QA result for a task
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = getCorrelationId(request);
  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const { verdict, summary, findings, diff } = body;

    const { coordinationService } = await getServices();
    const decision = await coordinationService.processQAResult(taskId, {
      verdict,
      summary,
      findings,
      diff: diff || "",
    });

    return jsonWithCorrelation(
      {
        taskId,
        decision: decision.action,
        message: `QA ${verdict}: ${summary}`,
      },
      undefined,
      correlationId,
    );
  } catch (error) {
    console.error("Error in POST /api/agentmesh/tasks/:id/qa:", error);

    return NextResponse.json({ error: "Failed to submit QA result" }, { status: 500 });
  }
}
