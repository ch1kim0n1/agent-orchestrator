# AgentMesh CLI Reference

The `ao` CLI is the control interface for AgentMesh. Most commands are used by the **orchestrator agent itself** to manage sessions, not by humans directly. Humans typically only need `ao start` and the web dashboard.

## Commands humans use

```bash
ao start                               # Auto-detect, generate config, start dashboard + orchestrator
ao start <url>                         # Clone repo, auto-configure, and start
ao start ~/other-repo                  # Add a new project and start
ao stop                                # Stop everything (dashboard, orchestrator, lifecycle worker)
ao status                              # Overview of all sessions
ao status --watch                      # Live-updating terminal status view
ao dashboard                           # Open web dashboard in browser
ao setup dashboard                     # Configure dashboard notification retention/routing
ao setup desktop                       # Install/configure native macOS desktop notifications
ao notify test --to desktop            # Send a manual notifier test without starting AgentMesh
ao completion zsh                      # Print the zsh completion script
```

## Commands the orchestrator agent uses

These are primarily invoked by the orchestrator agent running inside a runtime session (a tmux window on macOS/Linux; a ConPTY pty-host on Windows). You can use them manually if needed, but the orchestrator handles this automatically.

```bash
ao spawn [issue]                       # Spawn an agent (project auto-detected from cwd)
ao spawn 123 --agent codex             # Override agent for this session
ao batch-spawn 101 102 103             # Spawn agents for multiple issues at once
ao send <session> "Fix the tests"      # Send instructions to a running agent
ao session ls                          # List active sessions (terminated hidden)
ao session ls --include-terminated     # Include killed/done/merged/errored/cleanup sessions
ao session ls --json                   # Machine-readable session inventory (see note below)
ao session kill <session>              # Kill a session
ao session restore <session>           # Revive a crashed agent
```

> **JSON output:** `ao session ls --json` and `ao status --json` emit
> `{ "data": [...], "meta": { "hiddenTerminatedCount": N } }`. Terminated sessions
> (`killed`, `terminated`, `done`, `merged`, `errored`, `cleanup`) are filtered from
> `data` by default; `meta.hiddenTerminatedCount` reports how many were dropped.
> Pass `--include-terminated` to include them and reset the count to `0`.

## Maintenance commands

```bash
ao doctor                              # Check install, runtime, and stale temp issues
ao doctor --fix                        # Apply safe fixes automatically
ao setup openclaw                      # Connect AO notifications to OpenClaw
ao update                              # Update local AO install (source installs only)
ao config-help                         # Show full config schema reference
```

## Zsh completion

```bash
mkdir -p ~/.zsh/completions
ao completion zsh > ~/.zsh/completions/_ao
```

Add the directory to `fpath` before running `compinit`:

```zsh
fpath=(~/.zsh/completions $fpath)
autoload -Uz compinit
compinit
```

With Oh My Zsh, write the generated file to `${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/ao/_ao`
and add `ao` to the `plugins=(...)` list in `~/.zshrc`.

`ao doctor` checks PATH and launcher resolution, required binaries, configured plugin resolution, terminal-runtime health (tmux on Unix; PowerShell / `runtime-process` on Windows), GitHub CLI health, config support directories, stale AO temp files, and core build/runtime sanity. Runs and is supported on macOS, Linux, and Windows.

### `ao update`

`ao update` detects how the running `ao` binary was installed and upgrades it accordingly. It works on macOS, Linux, and Windows.

**Install methods and what each does:**

- **Git / source checkout** — fast-forwards the local install on `main`, reinstalls dependencies, clean-rebuilds core packages, refreshes the launcher, and runs smoke tests. Windows uses the bundled `ao-update.ps1` script automatically. Use `ao update --skip-smoke` to stop after rebuild, or `ao update --smoke-only` to rerun just the smoke checks. (These two flags only apply to git installs; on package-manager installs they are rejected with an error.)
- **npm / pnpm / bun global** — checks the registry, then runs the matching package-manager command (`npm install -g @aoagents/ao@latest`, `pnpm add -g @aoagents/ao@latest`, or `bun add -g @aoagents/ao@latest`).
- **Homebrew** — does not auto-install (it would clobber brew's symlinks); prints `brew upgrade ao` for you to run.
- **Unknown** — prints the npm command as a best-effort suggestion. You can override detection in `~/.agent-orchestrator/config.yaml` with `installMethod: pnpm-global` (or `bun-global`, `npm-global`, `homebrew`, `git`).

`ao update --check` prints version/channel info as JSON without upgrading.

**Lifecycle around the install (package-manager installs).** When AO is running — or there are active sessions (`working`, `idle`, `needs_input`, `stuck`) — `ao update`:

1. Snapshots which projects/sessions are live (from `running.json`, falling back to the global config), so they can be restored afterward.
2. Pauses AO with `ao stop --yes` and re-checks that it is fully stopped. If AO still appears active after the stop, the update aborts before installing and tells you to run `ao stop` and retry.
3. Runs the package-manager install command.
4. Verifies the result with `ao --version`, comparing it to the expected latest version.
5. Restarts AO with `ao start <project> --restore` (or `--no-restore` if you passed `ao update --no-restore`).

**If the install or verification fails:** AO reports that it was **not** updated (you are still on the previous version), prints classified remediation (permission, network, registry, lockfile, pnpm virtual store, etc.) plus the package-manager output, and — if it had paused a running AO — **restarts the previous installation** so you are not left with AO stopped.

#### Windows specifics

- **File locks / "release the locks first."** A running AO daemon (the dashboard, lifecycle worker, and any pty-host processes) can hold open handles to the installed files. On Windows an open handle prevents the package manager from overwriting those files, so the install would fail with a sharing-violation/`EPERM`-style error. This is exactly why `ao update` stops AO *before* installing (step 2 above): the stop releases the file locks so the global package directory can be rewritten cleanly.
- **pty-hosts are swept on stop.** On Windows, runtime sessions run as ConPTY pty-host processes rather than tmux windows. `ao stop` reaps orphaned pty-hosts (`sweepWindowsPtyHosts()` / the registry-backed cleanup), so the pause performed by `ao update` also clears any lingering pty-host handles that could otherwise keep files locked.
- **Global install permissions / `EPERM`.** Global package installs write to the npm/pnpm/bun global prefix. If that location is not writable by your user, the install fails with `EPERM` / "access denied". `ao update` classifies this and tells you to fix your global prefix permissions or retry from a shell that can write there. If your global prefix lives under `Program Files` (or another protected path), re-run from an **elevated** (Run as administrator) PowerShell. The cleaner fix is to point the global prefix at a user-writable directory (e.g. `npm config set prefix %USERPROFILE%\.npm-global`) so elevation is never required.
- **Shim resolution.** npm/pnpm/bun install as `*.cmd` shims on Windows; `ao update` spawns the install through a shell so `PATHEXT` is consulted and the shim resolves. You do not need to do anything for this — it is handled automatically.

#### Windows manual fallback

If `ao update` itself cannot complete (for example, it cannot spawn the package manager, or you want to run the steps by hand), reproduce the same flow manually in PowerShell:

```powershell
ao stop --yes                          # release file locks; sweep pty-hosts
npm install -g @aoagents/ao@latest     # if EPERM, re-run from an elevated shell
ao start --restore                     # restart AO and restore stopped sessions
```

Use `pnpm add -g @aoagents/ao@latest` or `bun add -g @aoagents/ao@latest` instead of the npm line if that is your global package manager.

#### Verification checklist (Windows)

Run these to confirm the update flow worked end to end. Expected results are listed alongside each command.

```powershell
# 1. Record the version you are on before updating.
ao --version
#    → prints the current version, e.g. 0.9.1

# 2. (Optional) Confirm an update is available without installing.
ao update --check
#    → prints JSON with currentVersion / latestVersion / channel

# 3. Run the update. With AO running, watch for the pause/restart lines.
ao update
#    → "… will be paused and restored after the update." (if sessions were active)
#    → "Restarting AO: ao start … --restore"
#    → "Update complete: <old> → <new>. AO restarted."

# 4. Confirm the binary now reports the new version.
ao --version
#    → prints the NEW version (different from step 1)

# 5. Confirm AO came back up and your sessions were restored.
ao status
#    → dashboard/orchestrator running; previously active sessions listed again
```

If step 3 reports "AO was not updated", `ao --version` in step 4 should still equal step 1, and step 5 should show AO restarted on the *previous* version — that is the documented failure behavior (the previous install is restarted, nothing is left half-upgraded).

## Multi-Project Rollout

Portfolio mode is enabled by default. Users do not need to set `AO_ENABLE_PORTFOLIO` unless they explicitly want to disable portfolio/project-management flows.

---

# AgentMesh CLI Reference

The `agentmesh` CLI is the control interface for the AgentMesh coordination layer. It runs on top of AO — `ao start` must be running (or AgentMesh starts its own daemon) before `agentmesh` commands can spawn agents.

See [`AGENTMESH.md`](AGENTMESH.md) for the full architectural reference.

## MVP commands (ship with initial release)

```bash
agentmesh init                             # Initialize .agentmesh/ in the current repo
agentmesh run "Task description"           # Full builder → QA → PR loop
agentmesh status                           # Overview of all tasks and their states
agentmesh board                            # Kanban board view of all tasks
agentmesh watch TASK-001                   # Live-updating view of a running task
agentmesh logs TASK-001                    # Stream raw logs for a task
agentmesh timeline TASK-001                # Structured event timeline for a task
agentmesh replay TASK-001                  # Replay full task execution (prompts, outputs, diffs, QA)
```

## Task management commands

```bash
agentmesh task create "Description"        # Create a task on the local board
agentmesh task run TASK-001                # Run a specific task (uses defaults from config)
agentmesh task run TASK-001 --builder claude-code --qa codex
agentmesh task assign TASK-001 --builder claude-code --qa codex
agentmesh task ready-for-qa TASK-001       # Manually mark a task ready for QA
agentmesh task watch TASK-001              # Live view of running task
agentmesh task logs TASK-001              # Raw logs
agentmesh task logs TASK-001 --agent qa   # Logs filtered by agent role
agentmesh task replay TASK-001            # Replay all steps
```

## QA commands

```bash
agentmesh qa run TASK-001                  # Run QA against a completed builder task (uses default QA agent)
agentmesh qa run TASK-001 --qa codex       # Specify QA agent
```

## Loop commands

```bash
agentmesh run "Task description" --builder claude-code --qa codex --retries 2
agentmesh run TASK-001 --loop --retries 2  # Run QA loop on existing task
agentmesh run "Add password reset flow" --builder claude-code --qa codex --retries 2 --open-pr
```

## Message bus commands

```bash
agentmesh message list TASK-001            # All messages for a task
agentmesh message send TASK-001 <from_agent> <to_agent> "Message body"
```

## Agent management commands

```bash
agentmesh agents list                      # All registered agent adapters
agentmesh agents status                    # Current status of all active agents
```

## PR commands

```bash
agentmesh pr open TASK-001                 # Open PR (runs policy check first)
```

## Config commands

```bash
agentmesh config validate                  # Validate agentmesh.yaml
```

## run command — full reference

```bash
agentmesh run "Add password reset flow" \
  --builder claude-code \    # Agent for the builder role
  --qa codex \               # Agent for the QA role
  --retries 2 \              # Max QA retry attempts (default: 2)
  --open-pr \                # Open PR automatically after QA pass
  --no-loop \                # Run builder only, skip QA
  --workspace worktree       # Override workspace mode
```

## Expected output (run command)

```
AgentMesh started TASK-001: Add password reset flow
Builder: claude-code
QA: codex
Retry limit: 2
Branch: agentmesh/TASK-001-password-reset

[10:01:02] Created task TASK-001
[10:01:04] Created branch agentmesh/TASK-001-password-reset
[10:01:08] Started Claude Code builder session
[10:04:32] Builder modified 5 files
[10:05:10] Builder ran npm test
[10:05:42] Builder requested QA
[10:05:45] Started Codex QA session
[10:08:21] QA failed: reset token can be reused
[10:08:23] Sent QA feedback to builder
[10:12:50] Builder submitted fix
[10:13:00] QA retest started
[10:15:30] QA passed
[10:15:52] PR opened: https://github.com/org/repo/pull/42
```

## Task states visible in board and status

| State                  | Meaning                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `created`              | Task exists, not yet started                                   |
| `assigned`             | Builder and QA assigned                                        |
| `building`             | Builder agent is working                                       |
| `builder_self_testing` | Builder running its own tests                                  |
| `ready_for_qa`         | Builder claims done, waiting for QA                            |
| `qa_running`           | QA agent is testing                                            |
| `qa_failed`            | QA returned FAIL verdict                                       |
| `reworking`            | Builder fixing based on QA feedback                            |
| `qa_passed`            | QA returned PASS verdict                                       |
| `pr_opening`           | AgentMesh creating the PR                                      |
| `ci_running`           | Waiting for CI                                                 |
| `ci_failed`            | CI failed (AO CI reaction loop routes back to agent)           |
| `review_pending`       | PR has reviewer assigned                                       |
| `merge_ready`          | CI passed, reviews done, ready to merge                        |
| `done`                 | Merged and complete                                            |
| `blocked`              | QA failed after max retries, or policy violation, or hard stop |
| `cancelled`            | User cancelled                                                 |
