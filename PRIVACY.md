# Privacy Policy

> **Important notice:** This document is a template starting point provided for
> convenience. It is **not legal advice**. AgentMesh is open-source software
> distributed under the MIT License, and this policy describes how the software
> behaves by default. If you intend to rely on this document for a commercial
> offering, a hosted service, or any deployment where you process other people's
> data, you must have qualified legal counsel review and adapt it before relying
> on it.

**Effective date:** [EFFECTIVE DATE]

## Overview

AgentMesh is a **local-first** command-line tool and dashboard. It spawns and
supervises parallel AI coding agents, each running in an isolated git worktree,
and helps you manage the pull requests they produce. AgentMesh runs entirely on
your own machine. It has **no backend service of its own**, no central server
that receives your data, and no account system.

The guiding principle of this policy is simple: AgentMesh processes your data
locally, and the only data that leaves your machine is data you explicitly
direct it to send through integrations you configure with your own credentials.

## Data AgentMesh Processes and Where It Lives

All of the following are stored as plain files on your local filesystem. There
is no database and no remote storage operated by the AgentMesh project.

- **Configuration.** Project configuration lives in `agent-orchestrator.yaml`
  within your repository, and global configuration lives in
  `~/.agent-orchestrator/config.yaml`. These describe your projects, plugin
  choices, and integration settings.
- **Session metadata and worktrees.** Information about each agent session,
  along with the git worktrees the agents work in, is stored under
  `~/.agent-orchestrator/`. This includes session state, activity logs, and the
  source code the agents read and write.
- **Runtime state.** Files such as `running.json` and `last-stop.json` record
  which sessions are active so the tool can resume or clean up correctly.

This data remains on your machine. The AgentMesh project does not have access to
it and does not receive a copy of it.

## Credentials and Tokens

AgentMesh uses **your own** credentials to talk to the third-party services you
choose to connect, such as GitHub, GitLab, Linear, and the AI coding agents
themselves. These credentials are read from your local environment and existing
tool configuration (for example, your shell environment variables or the
configuration files of the underlying agent CLIs). Credentials are used locally
to authenticate to the services you have configured and are **not transmitted to
the AgentMesh project** or to any party other than the service the credential
belongs to.

## First-Party Telemetry and Analytics

AgentMesh contains **no first-party telemetry, analytics, usage tracking, or
crash reporting**. The software does not phone home, does not collect usage
statistics, and does not send error reports to the project maintainers or to any
third party on the project's behalf. There is no first-party data collection of
any kind.

(For transparency: a Sentry package appears in the web dashboard's dependency
manifest but is not initialized or wired into the running application, so no
error data is collected or transmitted. If a future release activates such a
feature, this policy will be updated and the behavior will be disclosed before
any data is collected.)

## Data Shared With Third Parties

Data leaves your machine **only** through integrations you explicitly enable and
configure. When you use these integrations, you are interacting directly with
those services under your own account, and their respective privacy policies and
terms govern that data. AgentMesh is the conduit, not the recipient.

The categories of third parties you may choose to connect include:

- **AI coding agents** that AgentMesh shells out to, such as Claude Code, Codex,
  Aider, OpenCode, and similar tools. These tools send your prompts and source
  code to the AI provider behind them in order to generate code.
- **Source control and code hosting providers** such as GitHub and GitLab, used
  to push branches, open and update pull requests, and read CI status.
- **Issue and project trackers** such as GitHub Issues, GitLab, and Linear, used
  to read and update the issues your agents work on.
- **Notification destinations** you configure, such as desktop notifications,
  Slack, Discord, generic webhooks, and other notifier plugins. These receive
  whatever notification content you have configured AgentMesh to send.

Because these services receive your data directly, you should review the privacy
policies of each provider you enable. As a general matter, you can find a
provider's privacy policy on its official website, typically linked in the
footer or under a "Legal," "Privacy," or "Trust" section.

## Your Responsibilities

Because AgentMesh runs on your machine with your credentials, you are
responsible for:

- Keeping your machine, credentials, and tokens secure.
- Choosing which integrations to enable and understanding what data each one
  sends and to whom.
- Ensuring you have the right to share any source code, issue content, or other
  material with the AI agents and services you connect.
- Reviewing and complying with the privacy policies and terms of every
  third-party service you use through AgentMesh.
- Configuring notifiers and webhooks so they only send data to destinations you
  trust.

## Children's Privacy

AgentMesh is a developer tool that is not directed to children and is not
intended for use by anyone under the age of majority in their jurisdiction.

## Changes to This Policy

Because AgentMesh is open-source software, this policy may be updated in the
repository over time. Material changes to the software's data behavior will be
reflected here. The "Effective date" above indicates when the current version
took effect.

## Contact

Questions about this policy or the software's data behavior can be raised by
opening an issue in the project repository or by contacting the maintainers at
[CONTACT EMAIL].
