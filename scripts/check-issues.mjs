// Portable issue-store gate — the repo-local replacement for the issue-tracking skill's
// PowerShell scripts, which live at a machine-specific path (~/.agents/skills/...) and need
// pwsh. This checks the same contract the tree file declares for itself, offline, on any OS:
//
//   SUMMARY|themes=N|issues=N|P0=N|P1=N|P2=N|P3=N|blocked=N     counts must match the issues
//   ## THEME|id|priority|status|title                           one per type: theme
//   - id|theme|parent|priority|status|title                     one per non-theme issue
//
// It validates the *store* (every issue file's frontmatter and its tree line), not the HTML
// view: the view is a derived artifact whose renderer is also machine-local.
//
// Usage: node scripts/check-issues.mjs [--quiet]
// Exit 0 when the store is consistent; 1 with one line per finding otherwise.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const quiet = process.argv.includes("--quiet");

// The tracker manifest is the issue-tracking skill's contract: this script only reads the
// path fields it needs and never writes it.
function storeDir() {
  const manifest = join(root, ".github", "issue-tracker.json");
  if (existsSync(manifest)) {
    try {
      const m = JSON.parse(readFileSync(manifest, "utf8"));
      if (typeof m.issuesDir === "string" && m.issuesDir) return join(root, m.issuesDir);
      if (typeof m.treeFile === "string" && m.treeFile) return dirname(join(root, m.treeFile));
    } catch { /* a malformed manifest falls through to the convention */ }
  }
  return join(root, "issues");
}

const dir = storeDir();
if (!existsSync(dir)) {
  console.error(`grill: issue store not found at ${dir}`);
  process.exit(1);
}

const PRIORITIES = new Set(["P0", "P1", "P2", "P3"]);
const STATUSES = new Set(["open", "done", "blocked", "proposed", "deferred"]);

// Minimal frontmatter reader: the store uses flat `key: value` lines only, so a full YAML
// parser would be a dependency this repo does not otherwise have.
function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

const files = readdirSync(dir).filter((n) => /^\d{4}-.*\.md$/.test(n));
const issues = new Map();
const findings = [];

for (const name of files) {
  const id = name.slice(0, 4);
  const fm = frontmatter(readFileSync(join(dir, name), "utf8"));
  if (!fm) { findings.push(`${name}: no frontmatter block`); continue; }
  if (fm.id !== id) findings.push(`${name}: frontmatter id ${JSON.stringify(fm.id)} does not match the filename`);
  if (!fm.title) findings.push(`${name}: missing title`);
  if (!fm.type) findings.push(`${name}: missing type`);
  if (fm.type !== "theme") {
    if (!PRIORITIES.has(fm.priority)) findings.push(`${name}: priority ${JSON.stringify(fm.priority)} is not P0-P3`);
    if (!STATUSES.has(fm.status)) findings.push(`${name}: status ${JSON.stringify(fm.status)} is not one of ${[...STATUSES].join(", ")}`);
    if (!/^\d{4}$/.test(fm.theme || "")) findings.push(`${name}: theme ${JSON.stringify(fm.theme)} is not a 4-digit theme id`);
  }
  issues.set(id, { name, fm });
}

for (const [id, { name, fm }] of issues) {
  if (fm.type === "theme") continue;
  const parent = issues.get(fm.theme);
  if (!parent) findings.push(`${name}: theme ${fm.theme} has no issue file`);
  else if (parent.fm.type !== "theme") findings.push(`${name}: theme ${fm.theme} is ${parent.name}, which is not type: theme`);
}

// The tree file, when present, must agree with the store: a stale tree is the failure mode
// the PowerShell gate was catching, so reproduce that specific check offline.
const treeFile = join(dir, "tree.md");
if (existsSync(treeFile)) {
  const lines = readFileSync(treeFile, "utf8").split(/\r?\n/);
  const summary = lines.find((l) => l.startsWith("SUMMARY|"));
  if (!summary) findings.push("tree.md: no SUMMARY line");

  const treeThemes = new Set(), treeIssues = new Set();
  for (const line of lines) {
    if (line.startsWith("## THEME|")) treeThemes.add(line.split("|")[1]);
    else if (/^- /.test(line)) treeIssues.add(line.replace(/^-\s*/, "").split("|")[0]);
  }

  const storeThemes = [...issues.values()].filter((i) => i.fm.type === "theme");
  const storeIssues = [...issues.entries()].filter(([, i]) => i.fm.type !== "theme");

  for (const [id, { name }] of issues) {
    if (treeThemes.has(id) || treeIssues.has(id)) continue;
    findings.push(`${name}: missing from tree.md (regenerate the tree)`);
  }
  for (const id of treeIssues) {
    if (!issues.has(id)) findings.push(`tree.md: lists ${id}, which has no issue file`);
  }

  if (summary) {
    const f = Object.fromEntries(summary.split("|").slice(1).map((c) => c.split("=")));
    const want = { themes: String(storeThemes.length), issues: String(storeIssues.length) };
    for (const k of ["themes", "issues"]) {
      if (f[k] !== want[k]) findings.push(`tree.md: SUMMARY ${k}=${f[k]} but the store has ${want[k]}`);
    }
    const byP = (p) => String(storeIssues.filter(([, i]) => i.fm.priority === p).length);
    for (const p of ["P0", "P1", "P2", "P3"]) {
      const got = f[p] ?? "0";
      if (got !== byP(p)) findings.push(`tree.md: SUMMARY ${p}=${got} but the store has ${byP(p)}`);
    }
    const blocked = String(storeIssues.filter(([, i]) => i.fm.status === "blocked").length);
    if (f.blocked !== undefined && f.blocked !== blocked) {
      findings.push(`tree.md: SUMMARY blocked=${f.blocked} but the store has ${blocked}`);
    }
  }
} else {
  findings.push("tree.md: missing (the store needs its generated tree)");
}

if (findings.length) {
  for (const f of findings) console.error(`grill: ${f}`);
  process.exit(1);
}
if (!quiet) {
  console.log(`issue store OK — ${files.length} issues, ${[...issues.values()].filter((i) => i.fm.type === "theme").length} themes, tree.md in sync`);
}
