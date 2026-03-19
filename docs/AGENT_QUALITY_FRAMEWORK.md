# Agent Quality Framework

A checklist for measuring the health and quality of each agent in this repo. Use this when adding new agents, reviewing PRs, or auditing existing ones.

## Health Indicators

Rate each indicator as: ✅ Healthy | ⚠️ Needs Work | ❌ Missing

### 1. Checklist Specificity
**Healthy:** Every item names specific patterns to grep for (e.g., "`dangerouslySetInnerHTML`", "`FromSqlRaw` with concat").
**Needs Work:** Items are generic (e.g., "check for XSS").
**Missing:** No checklist exists for the agent's domain.

### 2. FP Trap Coverage
**Healthy:** Known false-positive patterns are documented with `⚠️ FP TRAP` markers. Both "when it's NOT a finding" and "when it IS" are documented.
**Needs Work:** FP traps exist but are incomplete (missing one side).
**Missing:** No FP traps despite known false-positive patterns in the domain.

### 3. Tech Stack Auto-Detection
**Healthy:** Agent auto-detects relevant tech stack from file patterns and activates appropriate checklists.
**Needs Work:** Detection exists but triggers are too broad or too narrow.
**Missing:** User must manually specify tech stack.

### 4. Trigger Keyword Accuracy
**Healthy:** Trigger keywords in config.json match real filenames/frameworks with zero false activations.
**Needs Work:** Some triggers are ambiguous (e.g., `"a"` matches everything).
**Missing:** No triggers defined — checklist never auto-activates.

### 5. Error Handling
**Healthy:** Missing files, bad config, and empty inputs produce clear, actionable error messages.
**Needs Work:** Some errors are swallowed or produce cryptic messages.
**Missing:** Errors crash the agent silently.

<!-- TODO: Junior dev — research and complete indicators 6-10 below.

For each indicator, follow the same format:
- Name it (short, descriptive)
- Define "Healthy" (what good looks like)  
- Define "Needs Work" (partial quality)
- Define "Missing" (the failure state)

Suggested areas to cover:
6. **Prompt Quality** — Are role prompts specific enough to produce structured output?
7. **Output Consistency** — Does the agent produce findings in a parseable format?
8. **Documentation Completeness** — Does the agent have install steps, examples, troubleshooting?
9. **Update Mechanism** — Can the agent's knowledge be refreshed without code changes?
10. **Test Coverage** — Has the agent been validated against a sample repo?

Research what makes a "good" AI agent by looking at the existing security agent
as the gold standard — it has all 5 indicators above at "Healthy" level.
-->

### 6. Prompt Quality
<!-- YOUR CONTENT HERE -->

### 7. Output Consistency
<!-- YOUR CONTENT HERE -->

### 8. Documentation Completeness
<!-- YOUR CONTENT HERE -->

### 9. Update Mechanism
<!-- YOUR CONTENT HERE -->

### 10. Test Coverage
<!-- YOUR CONTENT HERE -->

---

## Scoring Rubric

<!-- TODO: Junior dev — create a scoring table.

Based on the 10 indicators above, create a table that maps scores to quality levels:

| Score | Label | Criteria |
|-------|-------|----------|
| 9-10 Healthy | Gold | ... |
| 7-8 Healthy | Silver | ... |
| 5-6 mixed | Bronze | ... |
| < 5 | Needs Work | ... |

Then apply the rubric to the current security agent as an example.
-->

## Current Agent Scorecard

| Agent | Score | Notes |
|-------|-------|-------|
| security (extension) | ?/10 | Rate after completing rubric |
| engineering (ported) | ?/10 | |
| product-management (ported) | ?/10 | |
