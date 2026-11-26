// Local CI — the whole gate, on this machine, with no cloud service.
//
// The repo has no `.github/workflows/` on purpose: every check is local and deterministic.
// This runs them in cost order (cheap first, so a typo fails in a second), and each step's
// own exit code is the verdict. It is the command a pre-push hook runs and the command CI
// would run if one were ever added.
//
//   node scripts/ci.mjs               the whole gate
//   node scripts/ci.mjs --fast        skip the browser suites (no Playwright needed)
//   node scripts/ci.mjs --list        print the steps and exit
//
// Steps marked `needs: playwright` are skipped with a notice when PLAYWRIGHT_PKG is unset,
// so a machine without browsers still runs everything else instead of failing on setup.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const fast = argv.includes("--fast");

const STEPS = [
  { name: "version + contract", run: ["node", "scripts/check-contract.mjs", "--verbose"] },
  { name: "issue store", run: ["node", "scripts/check-issues.mjs"] },
  { name: "eval graders (offline)", run: ["node", "scripts/check-evals.mjs"] },
  { name: "taste (sound cues)", run: ["node", "taste.mjs", "--check"] },
  { name: "unit tests", run: ["node", "--test", ...skipArgs(), "--test-force-exit", "--test-timeout=10000", "test/server.test.mjs"] },
  { name: "extension tests", run: ["node", "--import", "./test/register-sdk-stub.mjs", "--test", "test/extension.test.mjs"], cwd: ".github/extensions/grill-monitor" },
  { name: "page e2e", run: ["node", "test/page.e2e.mjs"], needs: "playwright" },
  { name: "page sound e2e", run: ["node", "test/page-sound.e2e.mjs"], needs: "playwright" },
  { name: "manual visual e2e", run: ["node", "test/manual-visual.e2e.mjs"], needs: "playwright" },
];

// The same skip list Taskfile.yml uses. Kept here as data so the two cannot drift: the
// contract check asserts this array and the Taskfile's var name the same three tests.
function skipArgs() {
  const skip = [
    "outside\\s+git\\s+the\\s+key\\s+comes\\s+from\\s+the\\s+cwd",
    "ready\\s+line\\s+\\+\\s+server\\.json",
    "reuses\\s+the\\s+last\\s+port\\s+from\\s+server\\.json",
  ];
  return ["--test-skip-pattern", skip.join("|")];
}

if (argv.includes("--list")) {
  for (const s of STEPS) console.log(`${s.needs ? `[${s.needs}] ` : ""}${s.name}`);
  process.exit(0);
}

const hasPlaywright = Boolean(process.env.PLAYWRIGHT_PKG);
let failed = 0, skipped = 0;

for (const step of STEPS) {
  if (step.needs === "playwright" && (!hasPlaywright || fast)) {
    console.log(`skip  ${step.name}${fast ? " (--fast)" : " (set PLAYWRIGHT_PKG to run it)"}`);
    skipped++;
    continue;
  }
  const cwd = step.cwd ? join(root, step.cwd) : root;
  if (step.cwd && !existsSync(cwd)) {
    console.log(`skip  ${step.name} (no such folder: ${step.cwd})`);
    skipped++;
    continue;
  }
  const t0 = Date.now();
  const r = spawnSync(step.run[0], step.run.slice(1), { cwd, stdio: "inherit", env: process.env, shell: false });
  const ms = Date.now() - t0;
  if (r.status !== 0) {
    console.log(`FAIL  ${step.name} (${ms} ms)`);
    failed++;
  } else {
    console.log(`ok    ${step.name} (${ms} ms)`);
  }
}

console.log(`\nlocal CI: ${STEPS.length - skipped - failed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
