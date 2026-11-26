// Contract consistency gate. The skill's rules are deliberately spread across files that
// different readers load (the prompt, the Finish briefs, the repo instructions, the design
// record), so a rule can be fixed in one and left stale in another. This asserts the small
// set of facts that must agree, and the vocabulary that must NOT reappear.
//
// The rules are data, in RULES below: a grep-shaped check would drift from the prose it
// guards, while a list of invariants is one edit when the contract changes.
//
// Usage: node scripts/check-contract.mjs [--verbose]
// Exit 0 when every invariant holds; 1 with one line per violation.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const verbose = process.argv.includes("--verbose");
const SKILL = "skills/grill-with-ui";

const read = (rel) => {
  const p = join(root, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
};

const findings = [];
const check = (ok, msg) => { if (!ok) findings.push(msg); };

// The files that carry the Finish contract. Each must exist and agree on the pipeline.
const CONTRACT_FILES = [
  `${SKILL}/SKILL.md`,
  `${SKILL}/domain-brief.md`,
  `${SKILL}/spec-brief.md`,
  `${SKILL}/adr-template.md`,
  ".github/copilot-instructions.md",
];

for (const f of CONTRACT_FILES) {
  if (read(f) === null) findings.push(`${f}: missing from the contract set`);
}

const skill = read(`${SKILL}/SKILL.md`) || "";
const brief = read(`${SKILL}/domain-brief.md`) || "";
const spec = read(`${SKILL}/spec-brief.md`) || "";
const tmpl = read(`${SKILL}/adr-template.md`) || "";
const instr = read(".github/copilot-instructions.md") || "";
const design = read("docs/design.md") || "";
const readme = read("README.md") || "";

// ---- 1. The opt-in question is gone; it may only survive as documented legacy handling ----
// A live `q-domain` id outside a legacy sentence means the removed question came back
// (e.g. via a fork-sync port of the upstream branch).
for (const [name, text] of Object.entries({ "SKILL.md": skill, "domain-brief.md": brief, "visual-brief.md": read(`${SKILL}/visual-brief.md`) || "" })) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!line.includes("q-domain")) return;
    // Legitimate: sentences that explain it is legacy, ordinary, or not special.
    const legacy = /legacy|old session|no longer|not special|ordinary|never (a )?(candidate|durable)|removed/i.test(line);
    check(legacy, `${name}:${i + 1}: q-domain appears without a legacy qualifier — the opt-in question must stay removed`);
  });
}

// ---- 2. The ADR template's section list is the one the brief and tests describe ----
const SECTIONS = ["## Context and Problem Statement", "## Decision Drivers", "## Considered Options",
  "## Decision Outcome", "### Confirmation", "## More Information", "## Consequences"];
for (const s of SECTIONS) {
  check(tmpl.includes(s), `adr-template.md: missing section "${s}"`);
}
check(!/Technical Implementation/.test(tmpl), "adr-template.md: still carries the removed Technical Implementation section");
check(!/Technical Implementation/.test(brief), "domain-brief.md: still sources the removed Technical Implementation section");

// The server test asserts the same list; if one moves, both must move together.
const test = read("test/server.test.mjs") || "";
const m = /const ADR_SECTIONS = \[([\s\S]*?)\];/.exec(test);
check(Boolean(m), "server.test.mjs: ADR_SECTIONS list not found");
if (m) {
  for (const s of SECTIONS) check(m[1].includes(s), `server.test.mjs: ADR_SECTIONS is missing "${s}"`);
  check(!/Technical Implementation/.test(m[1]), "server.test.mjs: ADR_SECTIONS still lists the removed section");
}

// ---- 3. finished.pipeline is the same four counts everywhere it is described ----
const KEYS = ["durable", "decisions", "written", "skipped"];
for (const [name, text] of Object.entries({ "SKILL.md": skill, "domain-brief.md": brief })) {
  for (const k of KEYS) {
    check(text.includes(k), `${name}: finished.pipeline key "${k}" is not mentioned`);
  }
}
const server = read(`${SKILL}/server.mjs`) || "";
check(/finished\.pipeline/.test(server), "server.mjs: validateState does not mention finished.pipeline");
for (const k of KEYS) check(server.includes(`"${k}"`) || server.includes(`'${k}'`), `server.mjs: finished.pipeline key "${k}" is not validated`);

// ---- 4. The spec verdict has exactly three outcomes, named the same way everywhere ----
const VERDICTS = ["not warranted", "blocked", "recommended"];
for (const v of VERDICTS) check(spec.includes(v), `spec-brief.md: verdict "${v}" is not defined`);
// The write order is glossary -> ADRs -> design doc, stated in the brief.
check(/glossary[^\n]{0,80}then[^\n]{0,40}ADR/i.test(brief) || /glossary, then the ADRs/i.test(brief),
  "domain-brief.md: the write order (glossary, then ADRs, then the design doc) is not stated");

// ---- 5. The legacy flag is described as ignored, never as active ----
check(/accept(ed)? and ignor/i.test(skill) || /accepted and ignored/i.test(instr),
  "SKILL.md: domainModeling is not documented as accepted-and-ignored");
for (const [name, text] of Object.entries({ "SKILL.md": skill, "copilot-instructions": instr })) {
  check(!/domain-modeling mode on/.test(text), `${name}: still describes domainModeling as an active mode`);
}

// ---- 6. Version agreement: the manifest and the skill frontmatter must match ----
const plugin = JSON.parse(read("plugin.json") || "{}");
const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skill);
const skillVer = fm && /version:\s*([\d.]+)/.exec(fm[1])?.[1];
check(Boolean(skillVer), "SKILL.md: frontmatter version missing");
check(plugin.version === skillVer, `version mismatch: plugin.json ${plugin.version} vs SKILL.md ${skillVer}`);

// ---- 7. Prose that must stay in step with the contract ----
check(/pipeline/i.test(readme), "README.md: does not mention the decision pipeline");
check(/spec/i.test(readme) && /verdict|readiness/i.test(readme), "README.md: does not describe the spec readiness verdict");
check(/q-domain/.test(design), "docs/design.md: the superseded opt-in entry was deleted instead of annotated");

// ---- 8. The unit-test skip list is a fixed contract, not a growing filter ----
// `task test` must mean the same thing everywhere, and a real failure must not be silenced
// by appending a pattern. The same three tests are named in Taskfile.yml and scripts/ci.mjs;
// both are asserted to name exactly these three.
const SKIPPED = [
  "outside git the key comes from the cwd",
  "ready line + server.json",
  "reuses the last port from server.json",
];
// Both files hold regex source with escaped quantifiers (`\\s+`, `\\+`, `\\.`), so undo the
// escaping before comparing plain phrases. Order matters: the `\s+` runs first, then `\.`,
// then a bare escaped `+`.
const plain = (t) => t
  .replace(/\\+s\s*\+?/g, " ")
  .replace(/\\+\./g, ".")
  .replace(/\\+\+/g, "+");
const taskfile = plain(read("Taskfile.yml") || "");
const ci = plain(read("scripts/ci.mjs") || "");
for (const phrase of SKIPPED) {
  check(taskfile.includes(phrase), `Taskfile.yml: UNIT_SKIP does not name "${phrase}"`);
  check(ci.includes(phrase), `scripts/ci.mjs: the skip list does not name "${phrase}"`);
}
// A fourth skip entry means the filter grew without review. Count the alternations in the
// Taskfile's pattern string specifically.
const m2 = /UNIT_SKIP:\s*'--test-skip-pattern\s+"([^"]+)"/.exec(read("Taskfile.yml") || "");
check(Boolean(m2), "Taskfile.yml: UNIT_SKIP pattern string not found");
if (m2) {
  const n = m2[1].split("|").length;
  check(n === SKIPPED.length, `Taskfile.yml: UNIT_SKIP lists ${n} patterns, expected ${SKIPPED.length} (a new skip needs a documented reason and this contract updated)`);
}

if (findings.length) {
  for (const f of findings) console.error(`grill: ${f}`);
  process.exit(1);
}
if (!verbose) process.exit(0);
console.log(`contract OK — ${CONTRACT_FILES.length} files, ${SECTIONS.length} ADR sections, ${VERDICTS.length} verdicts, v${plugin.version}`);
