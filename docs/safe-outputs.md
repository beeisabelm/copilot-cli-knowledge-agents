# Safe Outputs — Agent Output Gating

## Concept

Every agent should declare **what it's allowed to output** — and what requires human approval. This prevents AI agents from taking irreversible actions without oversight.

Borrowed from [GitHub Agentic Workflows](https://github.com/github/gh-aw), which enforces this at the CI/CD level. We adapt it for Copilot CLI agents as a documented contract.

## How It Works

Each agent defines three tiers:

| Tier | Description | Example |
|------|-------------|---------|
| **Allowed** | Agent can do this freely | Display findings, show status, generate in-memory report |
| **Gated** | Agent asks for confirmation first | Write HTML report to disk, create GitHub discussion |
| **Blocked** | Agent cannot do this | Auto-fix code, create PRs, push commits |

## Security Agent Example

```
Agent: security-council
Version: 1.0

Allowed:
  - Display findings in terminal
  - Show convergence status
  - Generate in-memory HTML report

Gated (requires user confirmation):
  - Write HTML report to disk
  - Export findings as JSON

Blocked:
  - Auto-fix code (findings are advisory only)
  - Create pull requests
  - Push commits
  - Modify source files
```

## Why This Matters

Without output gating, an AI security scanner could:
1. Find a "vulnerability" (that's actually a false positive)
2. Auto-fix it (introducing a real bug)
3. Push the fix (breaking production)

Safe outputs ensure humans stay in the loop for irreversible actions.

<!-- TODO: Junior dev — add safe-output definitions for 2-3 more agents.

Pick from: engineering, data, legal, product-management, or finance.

For each agent, define:
- What should be ALLOWED (read-only, display, summarize)
- What should be GATED (creates files, sends messages, modifies data)
- What should be BLOCKED (destructive operations, external API calls)

Use the security agent example above as your template.

Think about: what's the worst thing this agent could do if it had no guardrails?
That's what goes in "Blocked."
-->

## Engineering Agent

```
Agent: engineering

Allowed:
  - Read and search code, logs, and documentation
  - Suggest code changes and architectural recommendations
  - Perform and write analyses such as code reviews
  - Summarize and help prepare for standup meetings

Gated (requires user confirmation):
  - Create tickets or tasks for a project
  - Escalate an incident
  - Engage in external correspondence (sending messages)

Blocked:
  - Push or approve code changes
  - Execute commands automatically
  - Modify project resources or security controls
```

## Data Agent

```
Agent: data

Allowed:
  - Read and query databases
  - Perform data visualization and analysis
  - Validate or write queries to run

Gated (requires user confirmation):
  - Execute queries that could incur compute costs or cause slowdowns (large datasets)
  - Queries involving PII data

Blocked:
  - Any modifying or destructive operations (e.g., write, update, delete)
  - Create or modify database schemas

```

## Legal Agent

```
Agent: legal

Allowed:
  - Read and analyze legal documents
  - Draft documents or responses for human review
  - Classify NDAs with reasoning
  - Review documents against organization playbook

Gated (requires user confirmation):
  - Engage in external correspondence (sending messages)
  - Generate or send a signature request

Blocked:
  - Access or disclose confidential information outside the intended workflow
  - Approve or refuse any document or contract on behalf of the organization
  - Provide definitive legal advice (agent does not replace qualified legal professionals)

```

---

## Implementation Status

| Agent | Safe Outputs Defined | Enforced in Code |
|-------|---------------------|-----------------|
| security | ✅ Yes (above) | Partial (report write is gated) |
| engineering | ✅ Yes (above) | — |
| data | ✅ Yes (above) | — |
| legal | ✅ Yes (above) | — |
| All others | ❌ Not yet | — |

> **Note**: Currently safe outputs are documented contracts, not runtime-enforced. Future work: add output gating to `extension.mjs` that checks allowed actions before executing.
