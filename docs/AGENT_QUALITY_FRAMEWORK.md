# Agent Quality Framework

A checklist for measuring the health and quality of each agent in this repo. Use this when adding new agents, reviewing PRs, or auditing existing ones.

## Health Indicators

Rate each indicator as: ✅ Healthy | ⚠️ Needs Work | ❌ Missing

### 1. Checklist Specificity
**Healthy:** Every item names specific patterns to grep for (e.g., "`dangerouslySetInnerHTML`", "`FromSqlRaw` with concat").\
**Needs Work:** Items are generic (e.g., "check for XSS").\
**Missing:** No checklist exists for the agent's domain.

### 2. FP Trap Coverage
**Healthy:** Known false-positive patterns are documented with `⚠️ FP TRAP` markers. Both "when it's NOT a finding" and "when it IS" are documented.\
**Needs Work:** FP traps exist but are incomplete (missing one side).\
**Missing:** No FP traps despite known false-positive patterns in the domain.

### 3. Tech Stack Auto-Detection
**Healthy:** Agent auto-detects relevant tech stack from file patterns and activates appropriate checklists.\
**Needs Work:** Detection exists but triggers are too broad or too narrow.\
**Missing:** User must manually specify tech stack.

### 4. Trigger Keyword Accuracy
**Healthy:** Trigger keywords in config.json match real filenames/frameworks with zero false activations.\
**Needs Work:** Some triggers are ambiguous (e.g., `"a"` matches everything).\
**Missing:** No triggers defined — checklist never auto-activates.

### 5. Error Handling
**Healthy:** Missing files, bad config, and empty inputs produce clear, actionable error messages.\
**Needs Work:** Some errors are swallowed or produce cryptic messages.\
**Missing:** Errors crash the agent silently.

### 6. Prompt Quality
**Healthy:** Behavior is true to description and agent performs all duties fluently and competently.\
**Needs Work:** Occasionally confused about capabilities and requires some user hand-holding most of the time.\
**Missing:** Not significantly different from an unprompted model or acts antithetically to intended behavior.

### 7. Output Consistency
**Healthy:** Findings are consistently easy to read and all relevant information can be quickly understood.\
**Needs Work:** Occasionally presented well and/or not all required information is made available consistently.\
**Missing:** Findings not presented, often difficult to interpret, and/or quality is very hit-or-miss.

### 8. Documentation Completeness
**Healthy:** Agent installation steps with examples and troubleshooting for all common issues is provided.\
**Needs Work:** Guidance exists but glosses over important details and/or contains mistakes.\
**Missing:** Little to no guidance exists and users must figure out the process themselves.

### 9. Update Mechanism
**Healthy:** Agent's knowledge can be refreshed without the need to touch its code or prompts.\
**Needs Work:** Agent's knowledge can be updated by modifying its agent prompt (.agent.md).\
**Missing:** Agent's rules are baked in with logic (if/else) and requires testing and redeploying to update.

### 10. Test Coverage
**Healthy:** Validated robustly against a repo (or repos) representative of agent use cases with thorough documentation of results.\
**Needs Work:** Validated against a repo but not all common situations have been tested or results documentation is incomplete.\
**Missing:** Agent behavior has not been validated, or has been validated but results are not documented.

---

## Scoring Rubric
Calculate score by taking the summing the points across the 10 health indicators and rounding to the nearest integer (x.33 = x, x.67 = x+1). For each indicator, "Healthy" is 1 point, "Needs Work" is 1/3 (0.33) points, and "Missing" is 0 points.

| Score | Label | Criteria |
|-------|-------|----------|
| 9-10 | Gold | High quality agent |
| 7-8 | Silver | Good quality agent with minor issues |
| 5-6 | Bronze | Acceptable but has some non-trivial issues |
| <5 | Inadequate | Agent requires improvements |

### Security Agent Scoring Example
| Indicator | Rating | Rationale |
|----------|-------|----------|
| Checklist Specificity | "Healthy" | Item names are specific |
| False-Positive Trap Coverage | "Healthy" | Catches and documents potential false-positives appropriately |
| Tech Stack Auto-Detection | "Healthy" | Automatically activates appropriate checklists for tech stack |
| Trigger Keyword Accuracy | "Healthy" | Keywords are distinct so no false activations |
| Error Handling | "Healthy" | Error messages are clear and actionable |
| Prompt Quality | "Healthy" | The agent readily understands its capabilities and duties |
| Output Consistency | "Healthy" | Findings are presented in a readable format with all pertinent information |
| Documentation Completeness | "Healthy" | Installation steps with examples and troubleshooting are given |
| Update Mechanism | "Healthy" | Knowledge can be updated through checklist markdown files |
| Test Coverage | "Missing" | No documented results of validation tests conducted |

Final score: ("HEALTHY" x 1) + ("NEEDS WORK" x 1/3) + ("MISSING" x 0) = (9 x 1) + (0 x 1/3) + (1 x 0) = 9

## Current Agent Scorecard

| Agent | Score | Notes |
|-------|-------|-------|
| security (extension) | 9/10 | Gold |
| engineering (ported) | ?/10 | |
| product-management (ported) | ?/10 | |
