/**
 * QALoopStatus Component
 *
 * Visual representation of the QA loop state for a task.
 * Shows the current state, retry count, and recent QA results.
 */

"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";

/**
 * State icons are monochrome inline SVG (lucide-derived paths) that inherit the
 * surrounding token color via `currentColor` — they theme with light/dark and
 * sit inside the mission-control palette. Do not use emoji here: full-color
 * emoji ignore the palette and read as unfinished against the control-room UI.
 */
function StateGlyph({ children }: { children: ReactNode }) {
  return <span className="inline-flex text-2xl leading-none">{children}</span>;
}

function StateIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="h-[22px] w-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

interface QALoopState {
  taskId: string;
  state:
    | "idle"
    | "building"
    | "qa_running"
    | "qa_passed"
    | "qa_failed"
    | "rework"
    | "blocked"
    | "done";
  retryCount: number;
  maxRetries: number;
  lastQAResult?: QAResult;
  lastTransition?: string;
}

interface QAResult {
  verdict: "PASS" | "FAIL" | "BLOCKED";
  summary: string;
  findings: QAFinding[];
  score?: number;
  timestamp: string;
}

interface QAFinding {
  severity: "critical" | "major" | "minor" | "info";
  category: string;
  message: string;
  file?: string;
  line?: number;
  code?: string;
}

const STATE_CONFIG: Record<
  QALoopState["state"],
  { label: string; className: string; icon: ReactNode }
> = {
  idle: {
    label: "Idle",
    className: "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]",
    icon: <StateGlyph>○</StateGlyph>,
  },
  building: {
    label: "Building",
    className: "bg-[var(--color-tint-blue)] text-[var(--color-accent-blue)]",
    // hammer
    icon: (
      <StateIcon>
        <path d="m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9" />
        <path d="M17.64 15 22 10.64" />
        <path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h.86c.85 0 1.65.34 2.25.93l1.25 1.25" />
      </StateIcon>
    ),
  },
  qa_running: {
    label: "QA Running",
    className: "bg-[var(--color-tint-yellow)] text-[var(--color-accent-yellow)]",
    // magnifier
    icon: (
      <StateIcon>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </StateIcon>
    ),
  },
  qa_passed: {
    label: "QA Passed",
    className: "bg-[var(--color-tint-green)] text-[var(--color-status-merge)]",
    icon: <StateGlyph>✓</StateGlyph>,
  },
  qa_failed: {
    label: "QA Failed",
    className: "bg-[var(--color-tint-red)] text-[var(--color-status-error)]",
    icon: <StateGlyph>✗</StateGlyph>,
  },
  rework: {
    label: "Rework",
    className: "bg-[var(--color-tint-orange)] text-[var(--color-accent-orange)]",
    // cycle / refresh
    icon: (
      <StateIcon>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
      </StateIcon>
    ),
  },
  blocked: {
    label: "Blocked",
    className: "bg-[var(--color-tint-red)] text-[var(--color-status-error)]",
    // ban / no-entry
    icon: (
      <StateIcon>
        <circle cx="12" cy="12" r="10" />
        <path d="m4.9 4.9 14.2 14.2" />
      </StateIcon>
    ),
  },
  done: {
    label: "Done",
    className: "bg-[var(--color-tint-violet)] text-[var(--color-accent-violet)]",
    icon: <StateGlyph>✓</StateGlyph>,
  },
};

const SEVERITY_COLORS = {
  critical: "bg-[var(--color-status-error)] text-[var(--color-text-inverse)]",
  major: "bg-[var(--color-accent-orange)] text-[var(--color-text-inverse)]",
  minor: "bg-[var(--color-accent-yellow)] text-[var(--color-text-inverse)]",
  info: "bg-[var(--color-accent-blue)] text-[var(--color-text-inverse)]",
};

interface QALoopStatusProps {
  taskId: string;
}

export default function QALoopStatus({ taskId }: QALoopStatusProps) {
  const [qaState, setQaState] = useState<QALoopState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadQALoopState();
    const interval = setInterval(loadQALoopState, 3000);
    return () => clearInterval(interval);
  }, [taskId]);

  const loadQALoopState = async () => {
    try {
      const response = await fetch(`/api/agentmesh/tasks/${taskId}/qa-status`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to fetch QA status");
      }
      const data = (await response.json()) as { qaState?: QALoopState };
      setQaState(data.qaState ?? null);
      setLoadError(null);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load QA loop state:", error);
      setLoadError(error instanceof Error ? error.message : "Failed to load QA status");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-[var(--color-text-tertiary)] text-sm">Loading QA status...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center py-4">
        <div className="text-[var(--color-status-error)] text-sm font-medium">
          Failed to load QA status
        </div>
        <div className="text-xs text-[var(--color-text-tertiary)] mt-1">{loadError}</div>
      </div>
    );
  }

  if (!qaState) {
    return (
      <div className="text-[var(--color-text-tertiary)] text-sm">No QA loop data available</div>
    );
  }

  const config = STATE_CONFIG[qaState.state];
  const score = qaState.lastQAResult?.score;
  const scoreToneClass =
    score === undefined
      ? ""
      : score >= 80
        ? "bg-[var(--color-status-merge)]"
        : score >= 60
          ? "bg-[var(--color-accent-yellow)]"
          : "bg-[var(--color-status-error)]";
  const reworkProgress =
    qaState.maxRetries > 0 ? (qaState.retryCount / qaState.maxRetries) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Current State */}
      <div className={`${config.className} rounded-lg p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center">{config.icon}</span>
            <div>
              <h3 className="font-semibold">{config.label}</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">Task: {qaState.taskId}</p>
            </div>
          </div>
          {qaState.state === "rework" && (
            <div className="text-sm text-[var(--color-text-secondary)]">
              Retry {qaState.retryCount}/{qaState.maxRetries}
            </div>
          )}
        </div>
      </div>

      {/* QA Result */}
      {qaState.lastQAResult && (
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm">Last QA Result</h4>
            <span
              className={`text-xs px-2 py-1 rounded ${
                qaState.lastQAResult.verdict === "PASS"
                  ? "bg-[var(--color-tint-green)] text-[var(--color-status-merge)]"
                  : qaState.lastQAResult.verdict === "FAIL"
                    ? "bg-[var(--color-tint-red)] text-[var(--color-status-error)]"
                    : "bg-[var(--color-tint-yellow)] text-[var(--color-accent-yellow)]"
              }`}
            >
              {qaState.lastQAResult.verdict}
            </span>
          </div>

          <p className="text-sm text-[var(--color-text-secondary)] mb-3">
            {qaState.lastQAResult.summary}
          </p>

          {score !== undefined && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-[var(--color-text-secondary)]">Quality Score</span>
                <span className="font-semibold">{score}/100</span>
              </div>
              <div className="w-full bg-[var(--color-bg-subtle)] rounded-full h-2">
                <div
                  className={`qa-progress-bar__fill h-2 rounded-full ${scoreToneClass}`}
                  style={{ "--progress": `${score}%` } as React.CSSProperties}
                />
              </div>
            </div>
          )}

          {qaState.lastQAResult.findings.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Findings ({qaState.lastQAResult.findings.length})
              </h5>
              <div className="space-y-2">
                {qaState.lastQAResult.findings.map((finding, index) => (
                  <div
                    key={index}
                    className="border border-[var(--color-border-subtle)] rounded p-3 bg-[var(--color-bg-subtle)]"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${SEVERITY_COLORS[finding.severity]}`}
                      >
                        {finding.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        {finding.category}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-1">
                      {finding.message}
                    </p>
                    {finding.file && (
                      <div className="text-xs text-[var(--color-text-tertiary)]">
                        {finding.file}:{finding.line}
                      </div>
                    )}
                    {finding.code && (
                      <div className="mt-2 bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] p-2 rounded text-xs font-mono">
                        {finding.code}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 text-xs text-[var(--color-text-tertiary)]">
            {new Date(qaState.lastQAResult.timestamp).toLocaleString()}
          </div>
        </div>
      )}

      {/* Retry Progress */}
      {qaState.state === "rework" && (
        <div className="bg-[var(--color-tint-orange)] border border-[var(--color-accent-amber-border)] rounded-lg p-4">
          <h4 className="font-semibold text-sm text-[var(--color-accent-orange)] mb-2">
            Rework in Progress
          </h4>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[var(--color-bg-subtle)] rounded-full h-2">
              <div
                className="qa-progress-bar__fill bg-[var(--color-accent-orange)] h-2 rounded-full"
                style={{ "--progress": `${reworkProgress}%` } as React.CSSProperties}
              />
            </div>
            <span className="text-sm text-[var(--color-accent-orange)]">
              {qaState.retryCount}/{qaState.maxRetries}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
            Agent is addressing QA findings. Will escalate if max retries exceeded.
          </p>
        </div>
      )}

      {/* Last Transition */}
      {qaState.lastTransition && (
        <div className="text-xs text-[var(--color-text-tertiary)]">
          Last transition: {new Date(qaState.lastTransition).toLocaleString()}
        </div>
      )}
    </div>
  );
}
