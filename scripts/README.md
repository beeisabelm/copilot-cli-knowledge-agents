# Copilot CLI Agent Sync

Single script to regenerate all agents from Anthropic knowledge-work-plugins.

## Quick Start

```powershell
cd scripts
.\Sync-Agents.ps1 -Force
```

## Files

| File | Purpose |
|------|---------|
| `Sync-Agents.ps1` | Regenerate all agents from Anthropic source |
| `agents-config.json` | Which plugins to convert (enable/disable) |

## Workflow: Updating from Anthropic

When Anthropic releases updates:

```powershell
# 1. Pull latest
cd anthropic-plugins && git pull

# 2. Regenerate all agents
cd ../scripts
.\Sync-Agents.ps1 -Force

# 3. Test
cd .. && copilot
```

## Configuration

Edit `agents-config.json` to enable/disable plugins:

```json
{
  "agents": [
    {
      "plugin": "product-management",
      "enabled": true,
      "notes": "PM workflows"
    }
  ]
}
```

## Transformation Rules

The scripts apply minimal transformations:

| Source | Target | Reason |
|--------|--------|--------|
| `plugin.json` | YAML frontmatter | CLI requires name + description |
| `commands/*.md` | `# Commands` section | Concatenated |
| `skills/*/SKILL.md` | `# Skills` section | Concatenated |
| `# /command` | `## command` | Avoid CLI command conflicts |
| Git commit | YAML comments | Source traceability |

Everything else (embedded YAML, CONNECTORS.md refs) is kept as-is. The model ignores what doesn't apply.

## Source Tracking

Generated agent files include Anthropic source commit info:

```yaml
---
name: product-management
description: ...
# Source: anthropic/knowledge-work-plugins
# Commit: 477c893b7a63f9ee021d2ccd55d89afd1c4b7c03
# CommitDate: 2026-02-24
# Generated: 2026-03-10
---
```

This enables traceability between your agents and Anthropic's source.

## Options

```powershell
.\Sync-Agents.ps1 -Force     # Overwrite without prompting
.\Sync-Agents.ps1 -WhatIf    # Preview without writing
.\Sync-Agents.ps1 -Verbose   # Show detailed progress
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (see output for details) |

## Version

- **Script Version**: 2.0.0
- **Source**: [Anthropic knowledge-work-plugins](https://github.com/anthropics/anthropic-quickstarts/tree/main/knowledge-work-plugins)
- **License**: Apache-2.0 (source), MIT (scripts)
