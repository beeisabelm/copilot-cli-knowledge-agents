# Contributing to Copilot CLI Knowledge Agents

Thanks for your interest in contributing! This project welcomes contributions from everyone — from engineering students to senior security professionals.

## Quick Start

```powershell
git clone https://github.com/beeisabelm/copilot-cli-knowledge-agents
cd copilot-cli-knowledge-agents
copilot --experimental
```

## How to Contribute

### 1. Add a New Security Checklist (Beginner)

The easiest way to contribute. No code changes needed — just markdown.

**Steps:**
1. Pick a tech stack not yet covered (e.g., Python/Flask, Ruby on Rails, Mobile iOS, Go API)
2. Create a markdown file in `.github/extensions/security/checklists/`
3. Follow the format of existing checklists (8-9 items, OWASP/CWE focused)
4. Add a detection rule in `.github/extensions/security/config.json`
5. Submit a PR

**Example — adding a Python API checklist:**

Create `.github/extensions/security/checklists/python-api.md`:
```markdown
### Python API Security Checks
1. **Injection**: SQL via f-strings/format(), Jinja2 template injection, subprocess with user input, pickle deserialization
2. **Auth**: Flask-Login/Django auth misconfiguration, JWT validation, session management
3. **Sensitive Data**: Hardcoded secrets, .env files committed, DEBUG=True in production
4. **Dependencies**: Known CVEs in requirements.txt, unpinned versions, untrusted PyPI packages
5. **Input Validation**: Missing request validation, file upload without type checking, ReDoS
6. **SSRF**: requests.get() with user-controlled URLs, unvalidated redirects
7. **Misconfiguration**: CORS misconfiguration, missing HTTPS, Flask debug mode in prod
8. **API-Specific**: Missing rate limiting, mass assignment via **kwargs, excessive data in responses
```

Add detection rule to `config.json`:
```json
"python-api": {
  "file": "checklists/python-api.md",
  "triggers": ["requirements.txt", "flask", "django", "fastapi", "python", ".py"]
}
```

### 2. Add an FP Trap to an Existing Checklist (Beginner)

If you've used the security scanner and got a false positive, document it!

**Steps:**
1. Identify which checklist item triggered the false positive
2. Add a `⚠️ FP TRAP` annotation under that item
3. Explain: why it's usually NOT a finding AND when it IS a real finding
4. Submit a PR

**Format:**
```markdown
3. **Sensitive Data**: Hardcoded secrets, DEBUG=True...
   - ⚠️ **FP TRAP — DEBUG=True**: In Django, `DEBUG=True` in `settings.py` is only a finding
     if the file is deployed to production. Check for environment-based switching
     (`os.environ.get('DEBUG', False)`). If the setting is behind an env var, it's not a finding.
```

### 3. Improve an Existing Agent (Intermediate)

The 12 ported agents work but could be better. Pick one and:
- Add domain-specific examples to its commands
- Improve the prompt quality for a specific skill
- Add missing workflow steps

### 4. Add Agent Validation (Intermediate)

Create a `validate.ps1` script that checks:
- All checklist paths in `config.json` point to files that exist
- All prompt files referenced by the extension exist
- `config.json` is valid JSON
- No duplicate trigger keywords across checklists

### 5. Port Patterns from the Security Agent to Other Agents (Advanced)

Apply multi-perspective analysis, confidence scoring, or debate protocols to non-security agents. See the open issues for specific proposals.

## PR Guidelines

- **One change per PR** — don't bundle unrelated changes
- **Test locally** — run `copilot --experimental` and verify your change works
- **No internal references** — this is a public repo. No company names, internal URLs, or employee identifiers.
- **Checklist files** should have 8-9 items following OWASP/CWE/industry standards
- **FP Traps** must include BOTH sides: when it's harmless AND when it's real

## Code of Conduct

Be respectful. Be constructive. Help each other learn.
