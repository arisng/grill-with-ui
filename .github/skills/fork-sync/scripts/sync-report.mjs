#!/usr/bin/env node
// fork-sync: divergence report for the grill-with-ui fork.
//
// Read-only. Fetches upstream, computes the merge base, and classifies every
// incoming commit as ADOPT (take as-is), ADAPT (port the intent, rewrite to
// fit this fork's contract), or CONTEST (both sides changed the same file —
// resolve by hand). It never merges, cherry-picks, or writes a file.
//
//   node sync-report.mjs                 # fetch + report
//   node sync-report.mjs --no-fetch      # report only, no network
//   node sync-report.mjs --json          # machine-readable output
//   node sync-report.mjs --upstream jasonku09/grill-with-ui --branch main

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const hasFlag = (f) => argv.includes(f);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const UPSTREAM_REPO = opt("--upstream", "jasonku09/grill-with-ui");
const UPSTREAM_BRANCH = opt("--branch", "main");
const AS_JSON = hasFlag("--json");
const DO_FETCH = !hasFlag("--no-fetch");

// Files whose contents ARE the contract. A change to one of these ripples into
// every other file in the list, so it is never a blind cherry-pick.
const CONTRACT_FILES = [
  "SKILL.md",
  "server.mjs",
  "page.html",
  "visual-brief.md",
  "domain-brief.md",
  "writing-clarity.md",
  "adr-template.md",
  "README.md",
  "docs/design.md",
  "docs/visualize-design.md",
  ".github/copilot-instructions.md",
];

const git = (args, opts = {}) => {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
      ...opts,
    }).trim();
  } catch (err) {
    if (opts.soft) return "";
    throw new Error(`git ${args.join(" ")} failed: ${err.message}`);
  }
};

const lines = (out) => (out ? out.split("\n").map((l) => l.trim()).filter(Boolean) : []);
const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------- collect ----

const root = git(["rev-parse", "--show-toplevel"], { soft: true });
if (!root) {
  console.error("not a git repository — run this inside the fork");
  process.exit(1);
}

const remotes = lines(git(["remote"], { soft: true }));
const hasRemote = (name) => remotes.includes(name);
const upstreamRemote = hasRemote("upstream") ? "upstream" : UPSTREAM_REPO;
const upstreamRef = `${upstreamRemote}/${UPSTREAM_BRANCH}`;

if (DO_FETCH) {
  const target = hasRemote("upstream") ? "upstream" : UPSTREAM_REPO;
  run("git", ["fetch", "--prune", target, UPSTREAM_BRANCH]);
}

if (!git(["rev-parse", "--verify", "--quiet", upstreamRef], { soft: true })) {
  const advice = hasRemote("upstream")
    ? `the ${upstreamRemote} remote has no '${UPSTREAM_BRANCH}' branch yet.\n` +
      `fetch it:  git fetch upstream ${UPSTREAM_BRANCH}`
    : `no 'upstream' remote is configured.\n` +
      `add it:   git remote add upstream https://github.com/${UPSTREAM_REPO}.git`;
  console.error(`no local ref for ${upstreamRef}.\n${advice}`);
  process.exit(1);
}

const head = git(["rev-parse", "HEAD"]);
const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
const base = git(["merge-base", "HEAD", upstreamRef], { soft: true });
const behind = Number(git(["rev-list", "--count", `HEAD..${upstreamRef}`], { soft: true }) || 0);
const ahead = Number(git(["rev-list", "--count", `${upstreamRef}..HEAD`], { soft: true }) || 0);

// Files each side touched since the merge base.
const forkFiles = new Set(lines(git(["diff", "--name-only", `${base}..HEAD`], { soft: true })));
const upstreamFiles = new Set(
  lines(git(["diff", "--name-only", `${base}..${upstreamRef}`], { soft: true })),
);
const contested = [...upstreamFiles].filter((f) => forkFiles.has(f)).sort();

// Incoming commits with their touched files.
const raw = git(
  ["log", `--format=%x1e%h%x1f%ad%x1f%s`, "--date=short", "--name-only", `${base}..${upstreamRef}`],
  { soft: true },
);

const commits = [];
for (const chunk of raw.split("\x1e")) {
  if (!chunk.trim()) continue;
  const [headPart, ...rest] = chunk.split("\n");
  const [sha, date, subject] = headPart.split("\x1f");
  if (!sha) continue;
  const files = rest
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("Merge "));
  // A merge commit carries no diff of its own; the work is in the commits it
  // merged, which are listed separately. Cherry-picking a merge is wrong.
  const isMerge = /^Merge /.test(subject || "");
  commits.push({ sha, date, subject, files, isMerge });
}

// Classify each incoming commit. Two independent questions, not one ladder:
//   - does it touch a contract file?  (the change ripples into the whole repo)
//   - did the fork also change that file? (git will conflict)
// REWORK (contract + overlap) outranks ADAPT (contract, no overlap), which
// outranks ADOPT (no contract file: take it as-is).
const tierOf = (files) => {
  const contract = files.filter((f) => CONTRACT_FILES.includes(f));
  const overlap = files.filter((f) => forkFiles.has(f));
  if (contract.length && overlap.length)
    return {
      tier: "REWORK",
      reason: `contract file also changed here (${overlap.join(", ")}) — port the intent, do not take the diff`,
    };
  if (contract.length)
    return {
      tier: "ADAPT",
      reason: `contract file (${contract.join(", ")}) — apply the ripple checklist`,
    };
  if (overlap.length)
    return { tier: "ADOPT", reason: `touches ${overlap.join(", ")} — cherry-pick, expect a conflict` };
  return { tier: "ADOPT", reason: "no contract file, no overlap — cherry-pick as-is" };
};

for (const c of commits) {
  if (c.isMerge) {
    // Nothing to cherry-pick; the merged commits carry the work.
    c.tier = "MERGE";
    c.reason = "merge commit — no diff of its own; take the commits it merged";
  } else {
    Object.assign(c, tierOf(c.files));
  }
}

// Installed copy staleness: the skills lock records the commit that was installed.
const lockPath = join(homedir(), ".agents", ".skill-lock.json");
let install = null;
if (existsSync(lockPath)) {
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    const entry = lock?.skills?.["grill-with-ui"];
    if (entry) {
      install = {
        source: entry.source,
        ref: entry.ref,
        installedAt: entry.installedAt,
        updatedAt: entry.updatedAt,
        installedCommit: entry.skillFolderHash,
        stale: entry.skillFolderHash !== head,
      };
    }
  } catch {
    install = { error: "could not parse .skill-lock.json" };
  }
}

// Open upstream pull requests, when gh is available.
let prs = null;
if (run("gh", ["--version"])) {
  const out = run("gh", [
    "pr",
    "list",
    "--repo",
    UPSTREAM_REPO,
    "--state",
    "open",
    "--limit",
    "20",
    "--json",
    "number,title,headRefName,createdAt",
  ]);
  if (out) {
    try {
      prs = JSON.parse(out);
    } catch {
      prs = null;
    }
  }
}

// ----------------------------------------------------------------- report ----

if (AS_JSON) {
  console.log(
    JSON.stringify(
      {
        root,
        branch,
        head,
        upstream: { repo: UPSTREAM_REPO, branch: UPSTREAM_BRANCH, ref: upstreamRef },
        mergeBase: base,
        ahead,
        behind,
        contestedFiles: contested,
        commits,
        install,
        openPRs: prs,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const tierOrder = { REWORK: 0, ADAPT: 1, ADOPT: 2, MERGE: 3 };
commits.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier] || a.date.localeCompare(b.date));

console.log(`\nfork-sync report — ${root}`);
console.log(`branch ${branch} @ ${head.slice(0, 7)}`);
console.log(
  `vs ${upstreamRef}: ${behind} behind, ${ahead} ahead   (merge base ${base.slice(0, 7)})`,
);
console.log("");

if (!commits.length) console.log("No incoming commits — already up to date.\n");

if (commits.length) {
  const counts = commits.reduce((acc, c) => ({ ...acc, [c.tier]: (acc[c.tier] || 0) + 1 }), {});
  console.log(
    `Incoming: ${commits.length} commits  ` +
      `[REWORK ${counts.REWORK || 0} | ADAPT ${counts.ADAPT || 0} | ADOPT ${counts.ADOPT || 0}` +
      `${counts.MERGE ? ` | MERGE ${counts.MERGE}` : ""}]`,
  );
  console.log("");
  for (const c of commits) {
    console.log(`  ${c.tier.padEnd(8)} ${c.sha} ${c.date}  ${c.subject}`);
    console.log(`           ${c.reason}`);
    if (c.tier !== "ADOPT") console.log(`           files: ${c.files.join(", ")}`);
  }
  console.log("");
}

if (contested.length) {
  console.log(`Contested files (both sides changed since ${base.slice(0, 7)}):`);
  for (const f of contested) console.log(`  ${f}`);
  console.log("");
}

if (install) {
  if (install.error) {
    console.log(`Installed copy: ${install.error}`);
  } else {
    console.log(
      `Installed copy (${install.source}@${install.ref}): ` +
        `${install.stale ? "STALE" : "current"} — ` +
        `installed ${String(install.installedCommit || "").slice(0, 7)}, HEAD is ${head.slice(0, 7)}`,
    );
    if (install.stale) console.log("  refresh with: npx skills update -g -y");
  }
  console.log("");
}

if (prs && prs.length) {
  console.log(`Open upstream PRs (${prs.length}) — merge before adopting, or cherry-pick the branch:`);
  for (const p of prs) {
    console.log(`  #${p.number} ${p.createdAt.slice(0, 10)} ${p.headRefName} — ${p.title}`);
  }
  console.log("");
}
