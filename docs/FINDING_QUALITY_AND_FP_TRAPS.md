# Finding Quality and False-Positive Traps

Two practices that keep multi-persona security scans credible: **FP trap markers** (stop recurring false positives) and the **Finding Quality Score** (gate what gets reported). Use them with the council scan in `.github/extensions/security/`.

## 1. FP Trap Markers — Prevent Recurring False Positives

### Problem
Scanners repeatedly flag the same non-issues. Each false positive wastes reviewer time and erodes trust in the tool.

### Pattern
Embed an **FP TRAP** marker in the checklist directly next to the check that causes the false positive. The marker tells the reviewer to apply extra scrutiny before reporting the pattern.

```
N. **Check Area**: What to look for
   - ⚠️ **FP TRAP — Pattern Name**: Why this is usually NOT a finding,
     what evidence IS needed to flag it, and which compensating controls to check first.
```

### Starter traps

| ID | Pattern | Usually NOT a finding because | IS a finding when |
|----|---------|-------------------------------|-------------------|
| FPT-001 | Exception object passed to a logger | Generic exception messages carry no PII; logging hygiene is a code-quality rule, not a vulnerability | The exception demonstrably contains PII (email, tenant ID, user-specific path). Cite the exact line and PII type; check for a PII-safe exception wrapper first |
| FPT-002 | `dangerouslySetInnerHTML` in React | Hardcoded strings, build-time content, and localized strings are not XSS | User-controlled input reaches it unsanitized. Check whether the codebase has a sanitizer that this path skips |
| FPT-003 | CORS `Origin: null` | Intentional for sandboxed iframes (for example portal embedding) | It combines with an independently exploitable endpoint and no other access controls. Do not build an attack chain on CORS alone |
| FPT-004 | "This pattern can be dangerous" | Generic pattern matching without exploit evidence is noise | You cite the exact file, line, and data flow showing untrusted input reaching the dangerous operation |

### Add a new trap
When a human rejects a finding as a false positive:
1. Identify the checklist item that triggered it.
2. Annotate that item with `⚠️ FP TRAP`: why it is not a finding, when it is, what to check first.
3. Add a row to the table with the next ID (FPT-NNN).
4. Let the trap propagate to future scans through the shared checklists.

### Quality rules
- State both sides: why it is usually harmless AND when it is dangerous.
- Name the specific compensating controls to check.
- Never dismiss an entire category. `dangerouslySetInnerHTML` with user input IS XSS.

## 2. Finding Quality Score (FQS)

Rate every finding 1–5 before presenting it. FQS measures the quality of the finding, separate from severity and confidence.

| Score | Label | Criteria | Action |
|-------|-------|----------|--------|
| **5** | Production-ready | Exact file + line, reproducible exploit path, specific fix, OWASP/CWE reference, compensating controls checked | Report as-is |
| **4** | Strong | Exact file + line, plausible exploit, specific fix; may need runtime confirmation | Report with a "needs verification" note |
| **3** | Needs work | Correct pattern, but missing exact lines or the exploit path is theoretical | Add evidence before reporting |
| **2** | Weak | Generic pattern match, no exploit path, may be an FP trap | Do not report; rework or drop |
| **1** | Noise | "This could be dangerous" with no code evidence, or hits an FP trap with no new evidence | Drop |

### Minimum thresholds

| Context | Minimum FQS |
|---------|-------------|
| Scan results presented to a team | 4 |
| PR review comments | 4 |
| Tracked work items/tickets | 5 |
| Private investigation notes | 3 |

### Quality checklist per finding
- [ ] **Exact location**: file path and line numbers.
- [ ] **Specific data flow**: how untrusted input reaches the vulnerable operation.
- [ ] **Compensating controls checked**: sanitizers, middleware, framework protections.
- [ ] **FP trap check**: known pattern? If yes, state the new evidence.
- [ ] **Actionable fix**: a developer can act without more research.
- [ ] **OWASP/CWE reference** attached.

### Human-in-the-loop checkpoints
Flag for human review when:

| Condition | Why |
|-----------|-----|
| You reject a finding that scored FQS ≥ 3 | It may be real; the human may hold context you lack |
| The pattern is not in the FP trap list | It may be a new false-positive class or a real issue |
| You downgrade an attack chain | Chain logic is subtle; humans judge "would this actually work?" better |
| Perspectives disagree on severity | You may lack domain context |
| It is the first scan of a codebase | No baseline exists; every FP conclusion is provisional |

Record human decisions:

```
### Human Review: [Finding ID]
- **AI conclusion**: [FP / Confirmed / Downgraded]
- **Human verdict**: [Agree / Override to X]
- **Rationale**: [Why]
- **Action**: [Added FPT-NNN / Created work item / No action]
```
