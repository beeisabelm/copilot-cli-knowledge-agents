// Security Council — Copilot CLI Extension
// Multi-perspective security scan with adversarial debate.
// Loads checklists, prompts, and config from external files so they can be
// updated independently (monthly refresh, community PRs, or runtime fetch).

import { approveAll } from "@github/copilot-sdk";
import { joinSession } from "@github/copilot-sdk/extension";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Resolve paths relative to this file ────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Safe file loader with clear error messages ─────────────────────────────

function loadFile(relativePath, description) {
    const fullPath = join(__dirname, relativePath);
    if (!existsSync(fullPath)) {
        const msg = `⚠️ Missing ${description}: ${relativePath}\n` +
            `   Expected at: ${fullPath}\n` +
            `   The extension will work with defaults, but this file should exist.\n` +
            `   Run 'git checkout' or re-clone to restore it.`;
        console.error(msg);
        return null;
    }
    try {
        return readFileSync(fullPath, "utf-8");
    } catch (err) {
        console.error(`⚠️ Could not read ${description} (${relativePath}): ${err.message}`);
        return null;
    }
}

function loadJson(relativePath, description) {
    const text = loadFile(relativePath, description);
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (err) {
        console.error(
            `⚠️ Invalid JSON in ${description} (${relativePath}): ${err.message}\n` +
            `   Fix the JSON syntax and restart. The extension will use built-in defaults.`
        );
        return null;
    }
}

// ─── Load external config ───────────────────────────────────────────────────

const CONFIG = loadJson("config.json", "extension config") || {};

// ─── Load model pool from config (with safe defaults) ───────────────────────

const DEFAULT_MODELS = [
    { id: "claude-opus-4.6", shortName: "opus", strengths: "Deep security reasoning", pool: "primary" },
    { id: "gemini-3-pro-preview", shortName: "gemini", strengths: "Design-level reasoning", pool: "primary" },
    { id: "gpt-5.2-codex", shortName: "codex", strengths: "Cross-file analysis", pool: "primary" },
    { id: "gpt-5.4", shortName: "gpt54", strengths: "Adversarial reasoning", pool: "cross-review" },
    { id: "claude-sonnet-4.6", shortName: "sonnet46", strengths: "Fast analysis", pool: "reserve" },
    { id: "claude-sonnet-4.5", shortName: "sonnet45", strengths: "State analysis", pool: "reserve" },
    { id: "gpt-5.1-codex", shortName: "codex51", strengths: "Pattern detection", pool: "reserve" },
];

function buildModelPool() {
    const m = CONFIG.models;
    if (!m) return DEFAULT_MODELS;
    try {
        return [
            ...(m.primary || []).map((x) => ({ ...x, pool: "primary" })),
            ...(m.crossReview || []).map((x) => ({ ...x, pool: "cross-review" })),
            ...(m.reserve || []).map((x) => ({ ...x, pool: "reserve" })),
        ];
    } catch {
        return DEFAULT_MODELS;
    }
}

const MODEL_POOL = buildModelPool();

// ─── Load checklists from external files ────────────────────────────────────

const CHECKLIST_DETECTION = CONFIG.checklistDetection || {};
const CHECKLISTS = {};

for (const [key, def] of Object.entries(CHECKLIST_DETECTION)) {
    const content = loadFile(def.file, `${key} checklist`);
    CHECKLISTS[key] = content || `### ${key} Security Checks\nChecklist file missing — apply standard OWASP Top 10 checks for this stack.`;
}

// Ensure general fallback always exists
if (!CHECKLISTS.general) {
    CHECKLISTS.general = "### General Security Checks\nApply standard OWASP Top 10 and CWE Top 25 checks adapted to whatever tech stack is present.";
}

function selectChecklists(techStack) {
    const stack = (techStack || "").toLowerCase();
    const matched = [];
    for (const [key, def] of Object.entries(CHECKLIST_DETECTION)) {
        if (key === "general") continue;
        const triggers = def.triggers || [];
        if (triggers.some((t) => stack.includes(t))) matched.push(key);
    }
    if (matched.length === 0) matched.push("general");
    return matched.map((k) => CHECKLISTS[k] || CHECKLISTS.general).join("\n\n");
}

// ─── Load prompt templates from external files ──────────────────────────────

const ROLE_PROMPTS = {};
for (const role of ["attacker", "auditor", "architect"]) {
    ROLE_PROMPTS[role] = loadFile(`prompts/${role}.md`, `${role} prompt`) ||
        `# ${role}\nPrompt file missing. Perform a ${role}-perspective security review using OWASP Top 10.\n\n{{SERVICE_CHECKLIST}}\n\n{{CONTEXT}}\n\n{{PATH}}`;
}

const CROSS_REVIEW_PROMPT = loadFile("prompts/cross-review.md", "cross-review prompt") ||
    "# Cross-Review\nDebate all findings. Challenge each one. Confirm or reject.\n\n{{FINDINGS}}\n\n{{CONTEXT}}";

// ─── In-memory state ────────────────────────────────────────────────────────

const findings = new Map();
const rounds = [];

function addFinding(finding) { findings.set(finding.id, finding); }
function getFindings() { return Array.from(findings.values()); }
function getActiveFindings() {
    return getFindings().filter(
        (f) => f.status !== "false_positive" && f.status !== "wont_fix" && f.status !== "resolved"
    );
}

// ─── Display helpers ────────────────────────────────────────────────────────

const EMOJI = { CRITICAL: "🔴", HIGH: "🟠", MEDIUM: "🟡", LOW: "🔵" };
const SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const SEV_WEIGHT = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function formatFindings(items) {
    if (items.length === 0) return "No findings.";
    const grouped = new Map();
    for (const f of items) {
        const list = grouped.get(f.severity) ?? [];
        list.push(f);
        grouped.set(f.severity, list);
    }
    const lines = [];
    for (const sev of SEV_ORDER) {
        const group = grouped.get(sev);
        if (!group?.length) continue;
        lines.push(`\n${EMOJI[sev]} ${sev} (${group.length})`);
        for (const f of group) {
            const loc = f.filePath ? ` — ${f.filePath}${f.lineNumbers ? `:${f.lineNumbers}` : ""}` : "";
            const badges = [
                f.convergent ? "⚡convergent" : "",
                f.confidence != null ? `📊${f.confidence.toFixed(2)}` : "",
                f.agents?.length ? `🤖${f.agents.join(",")}` : "",
                f.debateStatus ? `⚖️${f.debateStatus}` : "",
            ].filter(Boolean).join(" ");
            lines.push(`  [${f.id}] ${f.title}${loc}${badges ? "\n    " + badges : ""}`);
        }
    }
    const total = items.length;
    const critHigh = items.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH").length;
    lines.push(`\n📊 ${total} findings | ${critHigh} CRITICAL/HIGH`);
    return lines.join("\n");
}

function getStats() {
    const all = getFindings();
    if (all.length === 0) return "No findings recorded yet. Say 'run council scan' to start.";
    const total = all.length;
    const byStatus = (s) => all.filter((f) => f.status === s).length;
    const critHighPending = all.filter(
        (f) => (f.severity === "CRITICAL" || f.severity === "HIGH") && f.status === "pending"
    ).length;
    return [
        `📊 Stats (${rounds.length} round${rounds.length !== 1 ? "s" : ""})`,
        `  Total: ${total} | Pending: ${byStatus("pending")} | Resolved: ${byStatus("resolved")}`,
        `  False positives: ${byStatus("false_positive")} | Won't fix: ${byStatus("wont_fix")}`,
        `  Convergent: ${all.filter((f) => f.convergent).length} | High-conf: ${all.filter((f) => f.confidence >= 0.8 && f.status === "pending").length}`,
        critHighPending === 0
            ? "\n✅ No open CRITICAL/HIGH findings"
            : `\n⚠️ ${critHighPending} CRITICAL/HIGH pending`,
    ].join("\n");
}

// ─── Model rotation ─────────────────────────────────────────────────────────

const ROLES = ["attacker", "auditor", "architect"];

function getRotation(roundIndex) {
    const primaries = MODEL_POOL.filter((m) => m.pool === "primary");
    const reserves = MODEL_POOL.filter((m) => m.pool === "reserve");
    const crossReview = MODEL_POOL.find((m) => m.pool === "cross-review") || reserves[0] || primaries[0];

    if (primaries.length === 0) {
        return {
            council: ROLES.map((role) => ({ role, model: { id: "default", shortName: "default", strengths: "general" } })),
            crossReviewer: { role: "cross-reviewer", model: crossReview },
            error: "⚠️ No primary models configured. Check config.json models.primary array.",
        };
    }

    let roleAssignments;
    if (roundIndex < primaries.length) {
        roleAssignments = ROLES.map((role, i) => ({
            role,
            model: primaries[(i + roundIndex) % primaries.length],
        }));
    } else {
        roleAssignments = ROLES.map((role, i) => {
            const reserveIndex = roundIndex - primaries.length;
            if (i === reserveIndex % ROLES.length && reserveIndex < reserves.length) {
                return { role, model: reserves[reserveIndex] };
            }
            return { role, model: primaries[(i + roundIndex) % primaries.length] };
        });
    }

    const phase1Ids = roleAssignments.map((r) => r.model.id);
    let crossModel = crossReview;
    if (phase1Ids.includes(crossModel.id)) {
        crossModel = reserves.find((m) => !phase1Ids.includes(m.id)) || crossReview;
    }

    return {
        council: roleAssignments,
        crossReviewer: { role: "cross-reviewer", model: crossModel },
    };
}

// ─── Prompt builders ────────────────────────────────────────────────────────

function getRolePrompt(role, context, paths, techStack) {
    const template = ROLE_PROMPTS[role] || ROLE_PROMPTS.attacker;
    return template
        .replace("{{CONTEXT}}", context || "Not provided — auto-discover the tech stack first.")
        .replace(/\{\{PATH\}\}/g, paths || "Entire repository")
        .replace("{{SERVICE_CHECKLIST}}", selectChecklists(techStack));
}

function getCrossReviewPrompt(findingsJson, context) {
    return CROSS_REVIEW_PROMPT
        .replace("{{FINDINGS}}", findingsJson)
        .replace("{{CONTEXT}}", context || "");
}

// ─── System context (injected via hook) ─────────────────────────────────────

const SYSTEM_CONTEXT = `You are orchestrating a Security Council scan.

## Available Tools
- rta_status: Convergence stats across all rounds
- rta_show_findings: Display findings (filters out false positives by default)
- rta_mark: Update finding status (resolved, false_positive, wont_fix)
- rta_add_finding: Record findings with confidence scores and agent tracking
- rta_get_rotation: Get model-to-role assignments for a round
- rta_get_prompt: Get role-based review prompts (attacker, auditor, architect, cross-review)
- rta_generate_report: Generate HTML security report

## Workflow

### Phase 0: Auto-Discover
Scan repo for tech stack. Identify applicable checklists. Confirm with user.

### Phase 1: Council Review (3 personas)
🗡️ Attacker (A## IDs) — exploit chains, bug bounty mindset
📋 Auditor (B## IDs) — OWASP/CWE checklist, coverage %
🏗️ Architect (C## IDs) — STRIDE, trust boundaries, defense-in-depth

Use rta_get_rotation then rta_get_prompt for each role. Run 3 sequential reviews.

### Phase 2: Cross-Review & Debate
⚖️ Fourth model challenges every finding. Critical/High get formal debate.

### Phase 3: Triage
Record via rta_add_finding. Mark false positives via rta_mark.

### Phase 4: Fix (optional)
Fix confirmed CRITICAL/HIGH grouped by file.

### Phase 5: Next Round (optional)
Rotate models, scan again for convergence.

## Model Pool
${MODEL_POOL.map((m) => `${m.shortName} (${m.id}) — ${m.strengths} [${m.pool}]`).join("\n")}

## Commands
- "run council scan" → start
- "next round" → rotate models, scan again
- "show findings" → display current findings
- "fix findings" → auto-fix pending CRITICAL/HIGH
- "generate report" → HTML report`;

// ─── Scan triggers ──────────────────────────────────────────────────────────

const SCAN_TRIGGERS = CONFIG.scanTriggers || [
    "council", "red team", "agentic", "security scan", "run scan",
    "next round", "convergence", "show findings", "fix findings",
    "generate report", "moe",
];

// ─── HTML report generator ──────────────────────────────────────────────────

function generateReportHtml(title, techStack, scope) {
    const all = getFindings();
    const active = getActiveFindings();
    const falsePositives = all.filter((f) => f.status === "false_positive");
    const wontFix = all.filter((f) => f.status === "wont_fix");
    const timestamp = new Date().toISOString().split("T")[0];

    const sevCounts = {};
    for (const sev of SEV_ORDER) sevCounts[sev] = active.filter((f) => f.severity === sev).length;
    const convergentCount = active.filter((f) => f.convergent).length;
    const highConfCount = active.filter((f) => f.confidence >= 0.8).length;

    const sorted = [...active].sort((a, b) => {
        const sd = (SEV_WEIGHT[b.severity] || 0) - (SEV_WEIGHT[a.severity] || 0);
        return sd !== 0 ? sd : (b.confidence || 0) - (a.confidence || 0);
    });

    const esc = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const confBadge = (c) => {
        if (c == null) return "";
        const cls = c >= 0.8 ? "high" : c >= 0.5 ? "med" : "low";
        const label = c >= 0.8 ? "High" : c >= 0.5 ? "Medium" : "Low";
        return `<span class="cb cb-${cls}">${label} (${c.toFixed(2)})</span>`;
    };

    const agentBadges = (agents) => {
        if (!agents?.length) return "";
        const icons = { attacker: "🗡️", auditor: "📋", architect: "🏗️" };
        return agents.map((a) => `<span class="ab">${icons[a] || "🤖"} ${a}</span>`).join(" ");
    };

    const findingCard = (f, dimmed = false) => {
        const sevClass = f.severity.toLowerCase();
        const loc = f.filePath ? `${esc(f.filePath)}${f.lineNumbers ? `:${f.lineNumbers}` : ""}` : "";
        const badges = [
            f.convergent ? `<span class="cvb">convergent</span>` : "",
            f.debateStatus ? `<span class="db db-${f.debateStatus}">${f.debateStatus}</span>` : "",
            dimmed ? `<span class="fpb">${f.status.replace("_", " ")}</span>` : "",
        ].filter(Boolean).join(" ");
        const details = [
            f.description ? `<div class="dd"><div class="dl">Description</div><div class="dt">${esc(f.description)}</div></div>` : "",
            f.exploitScenario ? `<div class="dd"><div class="dl">Attack Scenario</div><div class="dt">${esc(f.exploitScenario)}</div></div>` : "",
            f.suggestedFix ? `<div class="dd"><div class="dl">Remediation</div><div class="dt fix">${esc(f.suggestedFix)}</div></div>` : "",
            f.owaspCwe ? `<div class="dd"><div class="dl">OWASP / CWE</div><div class="dt">${esc(f.owaspCwe)}</div></div>` : "",
        ].filter(Boolean).join("");
        return `<div class="fc sev-${sevClass}-c${dimmed ? " dim" : ""}"><div class="fh" onclick="this.parentElement.classList.toggle('open')"><span class="chv">▶</span><span class="sev sev-${sevClass}">${f.severity}</span>${confBadge(f.confidence)}<span class="fid">${esc(f.id)}</span><span class="ft">${esc(f.title)}</span>${badges}<span class="fl">${loc}</span></div><div class="fd"><div class="ar">${agentBadges(f.agents)}</div>${details}</div></div>`;
    };

    const critHigh = sevCounts.CRITICAL + sevCounts.HIGH;
    let posture = "strong", pc = "ps";
    if (sevCounts.CRITICAL > 0) { posture = "critical — immediate action required"; pc = "pc"; }
    else if (sevCounts.HIGH > 2) { posture = "concerning — prioritize remediation"; pc = "ph"; }
    else if (sevCounts.HIGH > 0) { posture = "moderate — address high-severity findings"; pc = "pm"; }

    const sectionsHtml = SEV_ORDER.map((sev) => {
        const items = sorted.filter((f) => f.severity === sev);
        if (!items.length) return "";
        return `<h2 class="sh">${EMOJI[sev]} ${sev} (${items.length})</h2>${items.map((f) => findingCard(f)).join("")}`;
    }).join("");

    const fpHtml = falsePositives.length
        ? `<h2 class="sh app">Appendix A: False Positives (${falsePositives.length})</h2><p class="note">Challenged during debate and rejected. Included for transparency.</p>${falsePositives.map((f) => findingCard(f, true)).join("")}`
        : "";

    const wfHtml = wontFix.length
        ? `<h2 class="sh app">Appendix B: Accepted Risk (${wontFix.length})</h2><p class="note">Acknowledged but accepted. Included for audit trail.</p>${wontFix.map((f) => findingCard(f, true)).join("")}`
        : "";

    const matrixRows = sorted.map((f) =>
        `<tr class="m-${f.severity.toLowerCase()}"><td class="mono">${esc(f.id)}</td><td>${esc(f.title)}</td><td><span class="sev sev-${f.severity.toLowerCase()}">${f.severity}</span></td><td>${confBadge(f.confidence)}</td><td>${(f.agents || []).join(", ") || "—"}</td></tr>`
    ).join("");

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{--c:#d32f2f;--cb:#fde8e8;--h:#e65100;--hb:#fff3e0;--m:#f9a825;--mb:#fffde7;--l:#1565c0;--lb:#e3f2fd;--g:#2e7d32;--gb:#e8f5e9;--p:#6a1b9a;--pb:#f3e5f5;--bg:#fff;--sf:#fafbfc;--bd:#e1e4e8;--tx:#24292f;--tm:#57606a}
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:var(--bg);color:var(--tx);line-height:1.6;padding:2rem}
.ctr{max-width:1200px;margin:0 auto}header{margin-bottom:2rem;border-bottom:2px solid var(--bd);padding-bottom:1.5rem}
h1{font-size:1.75rem;margin-bottom:.25rem}.sub{color:var(--tm);font-size:.9rem;margin-bottom:.5rem}
.meta{color:var(--tm);font-size:.82rem;display:flex;gap:1.5rem;flex-wrap:wrap}
.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.75rem;margin-bottom:1.5rem}
.sc{background:var(--sf);border:1px solid var(--bd);border-radius:8px;padding:1rem;text-align:center}
.sc .n{font-size:2rem;font-weight:700}.sc .lb{color:var(--tm);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em}
.nc{color:var(--c)}.nh{color:var(--h)}.nm{color:#b8860b}.nl{color:var(--l)}.ng{color:var(--g)}.np{color:var(--p)}.nt{color:var(--tm)}
.es{background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:1.5rem;margin-bottom:2rem}
.es h2{font-size:1.15rem;margin-bottom:1rem}.po{display:inline-block;padding:.3rem .8rem;border-radius:6px;font-weight:700;font-size:.85rem;margin-bottom:1rem}
.pc{background:var(--cb);color:var(--c)}.ph{background:var(--hb);color:var(--h)}.pm{background:var(--mb);color:#b8860b}.ps{background:var(--gb);color:var(--g)}
.es p{font-size:.88rem;margin-bottom:.6rem;line-height:1.65}
.sh{font-size:1.15rem;margin:2rem 0 1rem;padding-bottom:.5rem;border-bottom:1px solid var(--bd)}.app{color:var(--tm)}
.fc{background:var(--sf);border:1px solid var(--bd);border-radius:8px;margin-bottom:.75rem;overflow:hidden}
.sev-critical-c{border-left:4px solid var(--c)}.sev-high-c{border-left:4px solid var(--h)}.sev-medium-c{border-left:4px solid var(--m)}.sev-low-c{border-left:4px solid var(--l)}
.fh{padding:.8rem 1rem;display:flex;align-items:center;gap:.5rem;cursor:pointer;user-select:none;flex-wrap:wrap}
.fh:hover{background:#f0f2f4}.chv{color:var(--tm);transition:transform .2s;font-size:.8rem}
.fc.open .chv{transform:rotate(90deg)}.fd{display:none;padding:0 1rem 1rem;border-top:1px solid var(--bd)}
.fc.open .fd{display:block;padding-top:.8rem}
.sev{display:inline-block;padding:.15rem .55rem;border-radius:12px;font-size:.7rem;font-weight:700;text-transform:uppercase;color:#fff}
.sev-critical{background:var(--c)}.sev-high{background:var(--h)}.sev-medium{background:#d4a017}.sev-low{background:var(--l)}
.fid{color:var(--tm);font-family:monospace;font-size:.8rem;min-width:60px}.ft{font-weight:600;font-size:.88rem;flex:1}.fl{color:var(--tm);font-family:monospace;font-size:.72rem}
.dd{margin-bottom:.65rem}.dl{color:var(--tm);font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.2rem}
.dt{font-size:.84rem;line-height:1.55}.fix{background:var(--gb);border-left:3px solid var(--g);padding:.5rem .75rem;border-radius:4px}
.cb{display:inline-block;padding:.15rem .45rem;border-radius:12px;font-size:.65rem;font-weight:600;color:#fff}
.cb-high{background:var(--g)}.cb-med{background:#f57c00}.cb-low{background:#9e9e9e}
.cvb{display:inline-block;padding:.12rem .4rem;border-radius:12px;font-size:.65rem;font-weight:600;background:var(--pb);color:var(--p)}
.fpb{display:inline-block;padding:.12rem .4rem;border-radius:12px;font-size:.65rem;font-weight:600;background:#f5f5f5;color:var(--tm)}
.ab{display:inline-block;padding:.1rem .4rem;border-radius:8px;font-size:.72rem;background:#f0f2f4;margin-right:.3rem}.ar{margin-bottom:.6rem}
.db{display:inline-block;padding:.12rem .4rem;border-radius:12px;font-size:.65rem;font-weight:600}
.db-confirmed{background:var(--gb);color:var(--g)}.db-downgraded{background:var(--mb);color:#b8860b}
.db-rejected{background:var(--cb);color:var(--c)}.db-challenged,.db-pending,.db-defended{background:var(--pb);color:var(--p)}
.dim{opacity:.55}.note{color:var(--tm);font-size:.85rem;margin-bottom:1rem;font-style:italic}.mono{font-family:monospace;font-size:.82rem;color:var(--tm)}
table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.84rem}th,td{padding:.55rem .75rem;text-align:left;border-bottom:1px solid var(--bd)}
th{background:var(--sf);color:var(--tm);font-size:.72rem;text-transform:uppercase;letter-spacing:.04em}
.m-critical{background:#fef2f2}.m-high{background:#fffbeb}.m-medium{background:#fefce8}.m-low{background:#eff6ff}
.pb{background:var(--sf);border:1px solid var(--bd);color:var(--tx);padding:.5rem 1.2rem;border-radius:6px;cursor:pointer;font-size:.85rem;float:right}
.pb:hover{background:#f0f2f4}footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--bd);color:var(--tm);font-size:.8rem}
@media print{body{padding:1rem}.fd{display:block!important;padding-top:.5rem}.chv,.pb{display:none}.dim{opacity:.7}}
</style></head><body><div class="ctr">
<button class="pb" onclick="window.print()">🖨️ Print</button>
<header><h1>🔒 ${esc(title)}</h1>
<p class="sub">Security Council — Multi-perspective review with adversarial debate</p>
<div class="meta"><span>📅 ${timestamp}</span>${scope ? `<span>📁 ${esc(scope)}</span>` : ""}${techStack ? `<span>🔧 ${esc(techStack)}</span>` : ""}<span>🤖 ${rounds.length} round${rounds.length !== 1 ? "s" : ""}</span></div>
</header>
<div class="es"><h2>📊 Executive Summary</h2>
<div class="po ${pc}">Security Posture: ${posture}</div>
<p><strong>${active.length}</strong> active finding${active.length !== 1 ? "s" : ""} across ${rounds.length} round${rounds.length !== 1 ? "s" : ""}. ${critHigh > 0 ? `<strong>${critHigh} Critical/High</strong> require immediate attention.` : "No Critical/High findings."}</p>
<p>✅ ${highConfCount} high-confidence | ⚡ ${convergentCount} convergent | ❌ ${falsePositives.length} rejected as false positives</p>
</div>
<div class="sg">
<div class="sc"><div class="n">${active.length}</div><div class="lb">Total</div></div>
<div class="sc"><div class="n nc">${sevCounts.CRITICAL}</div><div class="lb">Critical</div></div>
<div class="sc"><div class="n nh">${sevCounts.HIGH}</div><div class="lb">High</div></div>
<div class="sc"><div class="n nm">${sevCounts.MEDIUM}</div><div class="lb">Medium</div></div>
<div class="sc"><div class="n nl">${sevCounts.LOW}</div><div class="lb">Low</div></div>
<div class="sc"><div class="n ng">${highConfCount}</div><div class="lb">High Conf</div></div>
<div class="sc"><div class="n np">${convergentCount}</div><div class="lb">Convergent</div></div>
<div class="sc"><div class="n nt">${falsePositives.length}</div><div class="lb">FP Rejected</div></div>
</div>
<h2 class="sh">📋 Priority Matrix</h2>
<table><thead><tr><th>#</th><th>Issue</th><th>Severity</th><th>Confidence</th><th>Found By</th></tr></thead><tbody>${matrixRows}</tbody></table>
${sectionsHtml}${fpHtml}${wfHtml}
<footer><p><strong>Security Council</strong> — Attacker / Auditor / Architect with adversarial cross-review. Generated ${timestamp}.</p></footer>
</div>
<script>
window.addEventListener('beforeprint',()=>{document.querySelectorAll('.fc').forEach(f=>f.classList.add('open'))});
document.querySelectorAll('.fc').forEach(f=>{if(f.querySelector('.sev-critical,.sev-high'))f.classList.add('open')});
</script></body></html>`;
}

// ─── Extension entry point ──────────────────────────────────────────────────

const session = await joinSession({
    onPermissionRequest: approveAll,

    tools: [
        {
            name: "rta_status",
            description: "Show convergence status and cumulative finding statistics",
            parameters: { type: "object", properties: {} },
            handler: async () => getStats(),
        },
        {
            name: "rta_show_findings",
            description: "Display findings, optionally filtered by round or file path",
            parameters: {
                type: "object",
                properties: {
                    round: { type: "string", description: "Filter by round, e.g. 'R1'" },
                    filePath: { type: "string", description: "Filter by file path substring" },
                    includeAll: { type: "boolean", description: "Include false positives and resolved (default: false)" },
                },
            },
            handler: async (args) => {
                let items = args.includeAll ? getFindings() : getActiveFindings();
                if (args.round) items = items.filter((f) => f.round === args.round);
                if (args.filePath) items = items.filter((f) => f.filePath?.includes(args.filePath));
                return formatFindings(items);
            },
        },
        {
            name: "rta_mark",
            description: "Update finding status (resolved, false_positive, wont_fix)",
            parameters: {
                type: "object",
                properties: {
                    findingId: { type: "string", description: "Finding ID, e.g. 'A01'" },
                    status: { type: "string", enum: ["resolved", "false_positive", "wont_fix"] },
                },
                required: ["findingId", "status"],
            },
            handler: async (args) => {
                const f = findings.get(args.findingId);
                if (!f) {
                    const available = getFindings().map((x) => x.id).join(", ");
                    return `❌ Finding '${args.findingId}' not found.\n   Available: ${available || "none — run a scan first"}`;
                }
                f.status = args.status;
                return `✅ ${args.findingId} → ${args.status}`;
            },
        },
        {
            name: "rta_add_finding",
            description: "Record a finding discovered during review",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string", description: "Unique ID (e.g. 'A01', 'B03', 'C07')" },
                    round: { type: "string", description: "Round ID (e.g. 'R1')" },
                    model: { type: "string", description: "Model short name" },
                    severity: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
                    area: { type: "string", description: "backend, frontend, infrastructure, dead-code" },
                    filePath: { type: "string" },
                    lineNumbers: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    exploitScenario: { type: "string" },
                    suggestedFix: { type: "string" },
                    convergent: { type: "boolean" },
                    confidence: { type: "number", description: "0.0–1.0" },
                    agents: { type: "array", items: { type: "string" }, description: "attacker, auditor, architect" },
                    debateStatus: { type: "string", enum: ["pending", "challenged", "defended", "confirmed", "downgraded", "rejected"] },
                    validates: { type: "string" },
                    validation: { type: "string", enum: ["confirmed", "challenged"] },
                    owaspCwe: { type: "string" },
                },
                required: ["id", "round", "model", "severity", "area", "title"],
            },
            handler: async (args) => {
                if (findings.has(args.id)) {
                    return `⚠️ Finding '${args.id}' already exists. Use a different ID or rta_mark to update status.`;
                }
                // Quality gate: warn on findings missing key quality indicators
                const qualityIssues = [];
                if (!args.filePath) qualityIssues.push("no file path");
                if (!args.exploitScenario && !args.description) qualityIssues.push("no exploit scenario or description");
                if (!args.suggestedFix) qualityIssues.push("no suggested fix");
                if ((args.confidence ?? 0.5) < 0.3 && (args.severity === "CRITICAL" || args.severity === "HIGH")) {
                    qualityIssues.push("low confidence for CRITICAL/HIGH — consider downgrading severity");
                }
                const qualityWarning = qualityIssues.length > 0
                    ? `\n⚠️ Quality gaps: ${qualityIssues.join(", ")}. Findings with more detail survive cross-review better.`
                    : "";
                addFinding({ ...args, status: "pending", convergent: args.convergent || false, confidence: args.confidence ?? 0.5, agents: args.agents || [] });
                return `✅ Recorded ${args.id}: ${args.title} (${args.severity}, confidence: ${(args.confidence ?? 0.5).toFixed(2)})${qualityWarning}`;
            },
        },
        {
            name: "rta_get_rotation",
            description: "Get model-to-role assignments for a review round",
            parameters: {
                type: "object",
                properties: {
                    roundIndex: { type: "number", description: "Zero-based round index (0=R1, 1=R2)" },
                },
                required: ["roundIndex"],
            },
            handler: async (args) => {
                const rotation = getRotation(args.roundIndex);
                const label = `R${args.roundIndex + 1}`;
                if (!rounds.includes(label)) rounds.push(label);
                const lines = rotation.council.map(
                    (r) => `  🎭 ${r.role}: ${r.model.shortName} (${r.model.id})`
                );
                const cross = `  ⚖️ cross-reviewer: ${rotation.crossReviewer.model.shortName} (${rotation.crossReviewer.model.id})`;
                return `Round ${label}:\n\nCouncil:\n${lines.join("\n")}\n\nCross-Reviewer:\n${cross}${rotation.error ? `\n\n${rotation.error}` : ""}`;
            },
        },
        {
            name: "rta_get_prompt",
            description: "Get the review prompt for a role, filled with project context and checklists",
            parameters: {
                type: "object",
                properties: {
                    area: { type: "string", enum: ["attacker", "auditor", "architect", "cross-review"], description: "Review role" },
                    context: { type: "string", description: "Project profile/context" },
                    paths: { type: "string", description: "File paths to review" },
                    techStack: { type: "string", description: "Detected tech stack (e.g. '.NET, React, Bicep') for checklist selection" },
                },
                required: ["area", "context", "paths"],
            },
            handler: async (args) => {
                if (args.area === "cross-review") {
                    const active = getActiveFindings();
                    if (active.length === 0) {
                        return "⚠️ No findings to cross-review yet. Run Phase 1 (council review) first.";
                    }
                    return getCrossReviewPrompt(JSON.stringify(active, null, 2), args.context);
                }
                return getRolePrompt(args.area, args.context, args.paths, args.techStack || args.context);
            },
        },
        {
            name: "rta_generate_report",
            description: "Generate a self-contained HTML security report",
            parameters: {
                type: "object",
                properties: {
                    title: { type: "string", description: "Report title" },
                    techStack: { type: "string", description: "Tech stack summary" },
                    scope: { type: "string", description: "Scope summary" },
                },
            },
            handler: async (args) => {
                if (getFindings().length === 0) {
                    return "⚠️ No findings to report. Run a council scan first:\n\n  > run council scan";
                }
                return generateReportHtml(
                    args.title || "Security Council Report",
                    args.techStack || "",
                    args.scope || ""
                );
            },
        },
    ],

    hooks: {
        onSessionStart: async () => {
            const checklistCount = Object.keys(CHECKLISTS).length;
            const modelCount = MODEL_POOL.length;
            await session.log(`🛡️ Security Council loaded — ${checklistCount} checklists, ${modelCount} models`);

            // Report any config issues on startup so user knows immediately
            if (!CONFIG.models) await session.log("⚠️ config.json missing or has no models — using defaults");
            if (checklistCount <= 1) await session.log("⚠️ Only general checklist found — check checklists/ directory");
        },
        onUserPromptSubmitted: async (input) => {
            const prompt = input.prompt.toLowerCase();
            if (SCAN_TRIGGERS.some((t) => prompt.includes(t))) {
                return { additionalContext: SYSTEM_CONTEXT };
            }
        },
    },
});

await session.log("🛡️ Security Council ready — say 'run council scan' to start");
