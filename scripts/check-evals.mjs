// Offline harness for the waza eval suite. `waza run` needs a live LLM, so the graders in
// evals/grill-with-ui/tasks/*.yaml would otherwise be write-only: authored, never executed.
// This runs every embedded program grader twice and asserts the pair of outcomes that make
// a grader worth having:
//
//   accept fixture -> exit 0     (it can pass on correct state)
//   reject fixture -> exit != 0  (it can FAIL — it is not a no-op)
//
// A grader that passes both is a no-op and is reported as a finding. Each task supplies its
// own fixtures below: the accept one holds exactly the state that task's grader is looking
// for, and the reject one breaks precisely the property the task exists to protect, so the
// check is meaningful rather than "some garbage input".
//
// Fixtures are seeded into a temp GRILL_HOME as well as the workspace, because every grader
// locates the session the way the skill does: by walking the workspace, then this machine's
// ~/.grill-with-ui/sessions keys that mention the workspace folder name.
//
// Usage: node scripts/check-evals.mjs [--verbose]
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const tasksDir = join(root, "evals", "grill-with-ui", "tasks");
const verbose = process.argv.includes("--verbose");

// Pull the literal block out of a task's `args: [ -e, - | ]`, which is where every grader
// lives. A YAML dependency for one block type is not worth it.
function graderCode(text) {
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex((l) => /^\s*-\s*\|\s*$/.test(l));
  if (i < 0) return null;
  const indent = /^(\s*)/.exec(lines[i])[1].length;
  const out = [];
  for (let j = i + 1; j < lines.length; j++) {
    const line = lines[j];
    if (line.trim() === "") { out.push(""); continue; }
    if (/^(\s*)/.exec(line)[1].length <= indent) break;
    out.push(line.slice(indent + 2));
  }
  const code = out.join("\n").trimEnd();
  return code.includes("state.json") ? code : null;
}

const ADR_OK = [
  "# 0001: Store settings in a dotfile", "",
  "* **Status:** Accepted", "* **Date:** 2026-11-26", "* **Authors:** Someone", "",
  "## Context and Problem Statement", "Per-user settings need a home.",
  "## Decision Drivers", "- Portability.",
  "## Considered Options", "- Dotfile", "- Environment variable",
  "## Decision Outcome", "Chosen Option: **Dotfile**, because it needs no platform API.",
  "### Confirmation", "A test asserts the file is read from $HOME.",
  "## More Information", "See design.md.",
  "## Consequences", "* **Good:** portable", "* **Bad:** no encryption", "* **Risks:** none",
].join("\n") + "\n";

const ADR_STALE = "# 0001: X\n\n## Decision Outcome\n\n## Technical Implementation\n";

// One session, written both where the graders walk and under a matching GRILL_HOME key.
function seed(dir, { state, events = "", adrs = {}, glossary, monitor }) {
  const session = join(dir, ".grill-session");
  mkdirSync(session, { recursive: true });
  writeFileSync(join(session, "state.json"), JSON.stringify(state, null, 2));
  if (events) writeFileSync(join(session, "events.jsonl"), events);
  if (monitor) writeFileSync(join(session, "monitor.json"), "{}");
  if (Object.keys(adrs).length) {
    const d = join(dir, "docs", "adr");
    mkdirSync(d, { recursive: true });
    for (const [n, body] of Object.entries(adrs)) writeFileSync(join(d, n), body);
  }
  if (glossary) writeFileSync(join(dir, "GLOSSARY.md"), glossary);
  mkdirSync(join(dir, ".github"), { recursive: true });
  writeFileSync(join(dir, ".github", "issue-tracker.json"),
    JSON.stringify({ tracker: "local-markdown", issuesDir: "issues" }));
  // The home mirror: graders read <home>/sessions/<key containing the dir name>/<session>/.
  const h = mkdtempSync(join(tmpdir(), "eval-home-"));
  const key = `${basename(dir)}-${process.pid}`;
  const mirror = join(h, "sessions", key);
  mkdirSync(mirror, { recursive: true });
  writeFileSync(join(mirror, "state.json"), JSON.stringify(state, null, 2));
  if (events) writeFileSync(join(mirror, "events.jsonl"), events);
  if (monitor) writeFileSync(join(mirror, "monitor.json"), "{}");
  return { session, home: h };
}

const baseState = (over = {}) => ({
  topic: "Where do settings live", intent: "Pick a store.", doc: ".grill-with-ui/261126-where/design.md",
  project: "WS", created: "2026-11-26T00:00:00.000Z",
  agent: { status: "waiting", since: "2026-11-26T00:00:00.000Z", handled: 1 },
  terms: [{ term: "Settings store", def: "Where settings live.", avoid: [] }],
  questions: [
    { id: "q1", round: 1, deps: [], title: "Which store holds settings?", body: "A dotfile.", options: [{ k: "A", text: "Dotfile" }, { k: "B", text: "Env" }],
      rec: { option: "A", why: "No platform API." }, status: "answered", durable: true, updated: false, answer: { kind: "option", option: "A" } },
    { id: "q2", round: 1, deps: [], title: "Which features ship first?", body: "Offline or sharing.", options: [{ k: "A", text: "Offline" }, { k: "B", text: "Sharing" }],
      rec: { option: "A", why: "Unblocks users." }, status: "answered", durable: true, updated: false, answer: { kind: "option", option: "A" } },
  ],
  ...over,
});

const FIN = (adrs = ["docs/adr/0001-x.md"], pipeline = { durable: 2, decisions: 1, written: 1, skipped: 1 }) => ({
  doc: ".grill-with-ui/261126-where/design.md", glossary: "GLOSSARY.md", adrs,
  pipeline, at: "2026-11-26T00:00:00.000Z",
});

const GLOSS = "# Glossary\n\n## Language\n\n**Settings store**: Where settings live.\n_Avoid_: prefs blob\n";

// Each entry: { accept(ctx), reject(ctx) } where ctx = {dir, home}.
// `reject` must break the exact property the task guards.
const FIXTURES = {
  "extension-attach": {
    accept: (d) => seed(d, { state: baseState({ questions: [
      { id: "q1", round: 1, deps: [], title: "First?", body: "A.", options: [{ k: "A", text: "One" }, { k: "B", text: "Two" }], rec: { option: "A", why: "Because." }, status: "open", durable: false, updated: false },
      { id: "q2", round: 1, deps: [], title: "Second?", body: "B.", options: [{ k: "A", text: "One" }, { k: "B", text: "Two" }], rec: { option: "B", why: "Because." }, status: "open", durable: false, updated: false },
    ] }) }),
    reject: (d) => seed(d, { state: baseState({ questions: [{ id: "q1", round: 1, deps: [], title: "Only?", body: "A.", options: [{ k: "A", text: "One" }, { k: "B", text: "Two" }], rec: { option: "A", why: "Because." }, status: "open", durable: false, updated: false }] }), monitor: true }),
  },
  "start-grill": {
    accept: (d) => seed(d, { state: baseState({ questions: [
      { id: "q1", round: 1, deps: [], title: "Which store?", body: "A dotfile.", options: [{ k: "A", text: "Dotfile" }, { k: "B", text: "Env" }], rec: { option: "A", why: "Simple." }, status: "open", durable: false, updated: false },
    ] }) }),
    // The regression this task exists to catch: the removed setup question comes back.
    reject: (d) => seed(d, { state: baseState({ domainModeling: true, questions: [
      { id: "q-domain", round: 1, deps: [], title: "Also keep a glossary and ADRs?", body: "Opt in.", options: [{ k: "A", text: "Yes" }, { k: "B", text: "No" }], rec: { option: "A", why: "Context." }, status: "open", durable: false, updated: false },
    ] }) }),
  },
  "finish-design-doc": {
    accept: (d) => {
      seed(d, { state: baseState({ doc: "design-notes.md", finished: { doc: "design-notes.md", at: "2026-11-26T00:00:00.000Z" } }) });
      writeFileSync(join(d, "design-notes.md"), "# Design\n\nq1 Which store holds settings?\n");
    },
    // finished.doc points somewhere else, so the recorded path is wrong.
    reject: (d) => {
      seed(d, { state: baseState({ doc: "design-notes.md", finished: { doc: "other.md", at: "2026-11-26T00:00:00.000Z" } }) });
      writeFileSync(join(d, "design-notes.md"), "# Design\n\nq1 Which store holds settings?\n");
    },
  },
  "finish-domain-docs": {
    accept: (d) => seed(d, { state: baseState({ finished: FIN() }), adrs: { "0001-x.md": ADR_OK }, glossary: GLOSS }),
    // The removed section came back — exactly the 0.11.0 change.
    reject: (d) => seed(d, { state: baseState({ finished: FIN() }), adrs: { "0001-x.md": ADR_STALE }, glossary: GLOSS }),
  },
  "finish-no-adr-for-product-scope": {
    accept: (d) => seed(d, { state: baseState({ finished: FIN([], { durable: 2, decisions: 0, written: 0, skipped: 2 }) }), glossary: GLOSS }),
    // An ADR exists although every decision was product scope: the subject gate failed.
    reject: (d) => seed(d, { state: baseState({ finished: FIN(["docs/adr/0002-product.md"], { durable: 2, decisions: 1, written: 1, skipped: 1 }) }), adrs: { "0002-product.md": ADR_OK }, glossary: GLOSS }),
  },
  "patch-only-no-direct-write": {
    // The answer reached state through patch: q1 answered with option B.
    accept: (d) => seed(d, { state: baseState({ questions: [
      { id: "q1", round: 1, deps: [], title: "Which store?", body: "A.", options: [{ k: "A", text: "Dotfile" }, { k: "B", text: "Env" }], rec: { option: "A", why: "Simple." }, status: "answered", durable: false, updated: false, answer: { kind: "option", option: "B" } },
    ] }) }),
    // The answer was not applied through patch: q1 is still open.
    reject: (d) => seed(d, { state: baseState({ questions: [
      { id: "q1", round: 1, deps: [], title: "Which store?", body: "A.", options: [{ k: "A", text: "Dotfile" }, { k: "B", text: "Env" }], rec: { option: "A", why: "Simple." }, status: "open", durable: false, updated: false },
    ] }) }),
  },
  "negative-trigger": {
    // No session at all is the correct outcome; the reject fixture adds one.
    accept: (d) => { mkdirSync(join(d, ".github"), { recursive: true }); writeFileSync(join(d, ".github", "issue-tracker.json"), "{}"); },
    reject: (d) => seed(d, { state: baseState() }),
  },
  "resume-no-session": {
    accept: (d) => { mkdirSync(join(d, ".github"), { recursive: true }); writeFileSync(join(d, ".github", "issue-tracker.json"), "{}"); },
    reject: (d) => seed(d, { state: baseState() }),
  },
  "spec-verdict-blocked": {
    // Warranted route + no matching issue => "blocked".
    accept: (d) => seed(d, { state: baseState({ finished: FIN([], { durable: 2, decisions: 0, written: 0, skipped: 2 }) }), events: JSON.stringify({ type: "send", seq: 1, at: "x", note: "Spec: blocked — no issue matches this topic; tracker local-markdown (issues/). Create the issue, then derive the spec from it." }) + "\n" }),
    // The verdict claims a recommendation with no anchor.
    reject: (d) => seed(d, { state: baseState({ finished: FIN() }), events: JSON.stringify({ type: "send", seq: 1, at: "x", note: "Spec: recommended — route unsettled (S1); derived from issue #0042." }) + "\n" }),
  },
  "spec-verdict-not-warranted": {
    accept: (d) => seed(d, { state: baseState({ finished: FIN([], { durable: 1, decisions: 0, written: 0, skipped: 1 }) }), events: JSON.stringify({ type: "send", seq: 1, at: "x", note: "Spec: not warranted — single reversible change, obvious route (X1, X2)." }) + "\n" }),
    // Recommending a spec for a trivially reversible change.
    reject: (d) => seed(d, { state: baseState({ finished: FIN() }), events: JSON.stringify({ type: "send", seq: 1, at: "x", note: "Spec: recommended — route unsettled (S1)." }) + "\n" }),
  },
  "spec-verdict-recommended": {
    accept: (d) => seed(d, { state: baseState({ finished: FIN() }), events: JSON.stringify({ type: "send", seq: 1, at: "x", note: "Spec: recommended — route unsettled (S1,S2); derived from issue #0042 (local-markdown)." }) + "\n" }),
    // The route was settled, so no spec is warranted.
    reject: (d) => seed(d, { state: baseState({ finished: FIN() }), events: JSON.stringify({ type: "send", seq: 1, at: "x", note: "Spec: not warranted — obvious route (X3)." }) + "\n" }),
  },
};

let failures = 0, verified = 0, noops = 0, checked = 0;
for (const file of readdirSync(tasksDir).filter((n) => n.endsWith(".yaml")).sort()) {
  const text = readFileSync(join(tasksDir, file), "utf8");
  const id = (/^id:\s*(.+)$/m.exec(text) || [])[1]?.trim() || basename(file, ".yaml");
  const code = graderCode(text);
  if (!code) { console.log(`  -  ${file}  (no program grader)`); continue; }
  const fx = FIXTURES[id];
  if (!fx) { console.log(`SKIP ${file}: no fixtures registered for id ${id}`); failures++; continue; }
  checked++;

  const run = (build) => {
    const dir = mkdtempSync(join(tmpdir(), "eval-ws-"));
    const seeded = build(dir) || {};
    const script = join(dir, "_grader.cjs");
    writeFileSync(script, code);
    const r = spawnSync(process.execPath, [script], {
      cwd: dir, encoding: "utf8", timeout: 90_000,
      env: { ...process.env, WAZA_WORKSPACE_DIR: dir, GRILL_HOME: seeded.home || join(dir, ".home") },
    });
    rmSync(script, { force: true });
    rmSync(dir, { recursive: true, force: true });
    if (seeded.home) rmSync(seeded.home, { recursive: true, force: true });
    return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}`.trim() };
  };

  const a = run(fx.accept);
  const r = run(fx.reject);
  if (a.code !== 0) {
    failures++;
    console.log(`FAIL ${file}: rejected its accept fixture\n       ${(a.out.split("\n").find((l) => l.includes("FAIL")) || a.out.split("\n")[0] || "no output").slice(0, 140)}`);
  } else if (r.code === 0) {
    noops++;
    console.log(`NO-OP ${file}: passed the drifted fixture too — this check cannot fail`);
  } else {
    verified++;
    if (verbose) console.log(`ok   ${file}`);
  }
}

console.log(`\neval graders: ${verified}/${checked} verified (${noops} no-op, ${failures} broken)`);
if (failures || noops) process.exit(1);
