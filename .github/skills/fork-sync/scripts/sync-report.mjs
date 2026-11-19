#!/usr/bin/env node
// fork-sync: divergence report for the grill-with-ui fork.
//
// Reports only. It does not merge, cherry-pick, or write to the working tree.
//
// What it does write, and why:
//   - `.git/FETCH_HEAD`, when it fetches the `upstream` remote (as any fetch does).
//   - the upstream remote's objects, when it fetches. A named `--upstream` repo
//     is fetched BY SHA, so no ref is created for it and no tags are imported;
//     a repo-keyed ref would collide between repos and is not reliably
//     re-writable on every git build.
//
//   node sync-report.mjs                 # fetch + report
//   node sync-report.mjs --no-fetch      # report only, no network
//   node sync-report.mjs --json          # machine-readable output
//   node sync-report.mjs --upstream owner/repo --branch main
//
// Tiers, in the order the workflow applies them:
//   MERGE  a merge commit — no diff of its own; take the commits it merged
//   REWORK a contract file the fork also changed — port the intent
//   ADAPT  a contract file the fork did not change — port the intent
//   ADOPT  no contract file — cherry-pick, resolving any overlap by hand
// DEFER is a decision the agent makes, not a tier this script emits.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KNOWN_FLAGS = new Set(["--json", "--no-fetch", "--upstream", "--branch", "--help"]);
const argv = process.argv.slice(2);

if (argv.includes("--help")) {
  console.log(
    "usage: sync-report.mjs [--json] [--no-fetch] [--upstream OWNER/REPO] [--branch NAME]",
  );
  process.exit(0);
}

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (!KNOWN_FLAGS.has(arg)) {
    console.error(`unknown option: ${arg}`);
    console.error(
      "usage: sync-report.mjs [--json] [--no-fetch] [--upstream OWNER/REPO] [--branch NAME]",
    );
    process.exit(2);
  }
  if (arg === "--upstream" || arg === "--branch") {
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      console.error(`${arg} needs a value`);
      process.exit(2);
    }
    i++; // the value is not an option — skip it
  }
}

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
// every other file in the list, so it is never a blind cherry-pick. Test files
// are deliberately NOT here: a test change follows its subject change, it does
// not define the contract.
//
// Paths are in upstream's root-space. The fork keeps the skill under
// skills/grill-with-ui/, so fork paths are normalized before comparison (see
// SKILL_PREFIX below). sound-sampler.html, .mcp.json, and plugin.json are
// fork-only today: they cannot match an upstream commit yet, and they are
// listed so a future one ripples correctly.
const CONTRACT_FILES = [
  "SKILL.md",
  "server.mjs",
  "page.html",
  "visual-brief.md",
  "sound-sampler.html",
  "domain-brief.md",
  "writing-clarity.md",
  "adr-template.md",
  "README.md",
  "docs/design.md",
  "docs/visualize-design.md",
  ".github/copilot-instructions.md",
  ".mcp.json",
  "plugin.json",
];

// Since the plugin restructure the fork's copies of these files live under
// skills/grill-with-ui/, while upstream is still flat. Classification and
// overlap run in root-space: strip the prefix so the fork's
// skills/grill-with-ui/SKILL.md and upstream's SKILL.md compare as one file.
const SKILL_PREFIX = "skills/grill-with-ui/";
const normalize = (f) => (f.startsWith(SKILL_PREFIX) ? f.slice(SKILL_PREFIX.length) : f);

// A commit is security-relevant when it adds a security CONTROL to the server,
// or when it adds a test that asserts a protected endpoint is REFUSED.
//
// The control patterns name specific mechanisms. A loose word match would flag
// any commit that mentions "sandbox" — including the `vm.createContext(sandbox)`
// idiom that has nothing to do with HTTP isolation.
const SECURITY_CONTROLS = [
  /content-security-policy/i,
  /\bMAX_BODY\b|\bTOO_LARGE\b|request body too large/i,
  /selfHosts|selfOrigins|host header|foreign host/i,
  /originOk|cross-origin|headers\.origin/i,
  /authorization|\bbearer\b|auth token|token-auth/i,
  /sandbox allow-scripts/i,
];

// A denial assertion against a protected surface: the endpoint must NOT answer.
const SECURITY_TESTS = [
  /(notEqual|notStrictEqual|rejects|throws|not\.ok)\b[^\n]*(\/state|\/send|\/events|\bhost\b|\borigin\b|sandbox|cannot (send|read))/i,
  /(\/state|\/send|\/events|\bhost\b|\borigin\b|sandbox|cannot (send|read))[^\n]*(notEqual|notStrictEqual|rejects|throws|not\.ok)\b/i,
];

const git = (args, opts = {}) => {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
      ...opts,
    }).trim();
  } catch (err) {
    if (opts.soft) return "";
    throw new Error(`git ${args.join(" ")} failed: ${err.message}`);
  }
};

const lines = (out) => (out ? out.split("\n").map((l) => l.trim()).filter(Boolean) : []);

// Run a command, returning its stdout, its exit status, and whether it
// succeeded. Never throws. The status matters for commands whose "failure" is
// a legitimate answer, such as `git merge-base --is-ancestor`.
const tryRun = (cmd, args) => {
  try {
    const stdout = execFileSync(cmd, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
    return { ok: true, status: 0, stdout };
  } catch (err) {
    return {
      ok: false,
      status: typeof err.status === "number" ? err.status : null,
      stdout: "",
      error: String(err.message || err),
    };
  }
};

const die = (message) => {
  console.error(message);
  process.exit(1);
};

// ---------------------------------------------------------------- collect ----

const root = git(["rev-parse", "--show-toplevel"], { soft: true });
if (!root) die("not a git repository — run this inside the fork");

const head = git(["rev-parse", "--verify", "--quiet", "HEAD"], { soft: true });
if (!head) die("this repository has no commits yet");

let branch = git(["rev-parse", "--abbrev-ref", "HEAD"], { soft: true });
if (!branch || branch === "HEAD") branch = "(detached)";

const remotes = lines(git(["remote"], { soft: true }));
const upstreamUrl = `https://github.com/${UPSTREAM_REPO}.git`;
const explicitUpstream = argv.includes("--upstream");

// Resolve the upstream tip.
//
// The default path uses the configured `upstream` remote and its normal
// remote-tracking ref — git manages it, prunes it, and never collides.
//
// `--upstream` names a different repo. That repo gets NO persistent ref: a
// branch-keyed namespace would collide between repos, and a non-standard
// namespace is not reliably re-writable on every git build. Instead the tip
// sha is read with `ls-remote` and the objects are fetched by sha, which
// creates no ref, imports no tags, and is idempotent.
let upstreamRef = null;
let upstreamTip = null;
let upstreamFetch = { ok: true };

if (!explicitUpstream && remotes.includes("upstream")) {
  upstreamRef = `upstream/${UPSTREAM_BRANCH}`;
  if (DO_FETCH)
    upstreamFetch = tryRun("git", ["fetch", "--no-tags", "upstream", UPSTREAM_BRANCH]);
  upstreamTip = git(["rev-parse", "--verify", "--quiet", upstreamRef], { soft: true });
  if (!upstreamTip && upstreamFetch.ok) {
    die(
      `the 'upstream' remote has no '${UPSTREAM_BRANCH}' branch.\n` +
        `check the branch name, or list the remote's branches:\n` +
        `  git ls-remote --heads upstream`,
    );
  }
} else {
  // Read the tip sha straight from the remote.
  const ls = tryRun("git", ["ls-remote", upstreamUrl, `refs/heads/${UPSTREAM_BRANCH}`]);
  if (!ls.ok) {
    die(
      `could not reach ${UPSTREAM_REPO}@${UPSTREAM_BRANCH}.\n` +
        `check the repo and branch name:\n` +
        `  git ls-remote --heads ${upstreamUrl}`,
    );
  }
  const first = lines(ls.stdout)[0];
  upstreamTip = first ? first.split(/\s+/)[0] : null;
  if (!upstreamTip) {
    die(
      `${UPSTREAM_REPO} has no branch '${UPSTREAM_BRANCH}'.\n` +
        `list its branches:\n` +
        `  git ls-remote --heads ${upstreamUrl}`,
    );
  }
  // Fetch the objects by sha: no ref is created, no tags are imported, and
  // running it twice is a no-op.
  if (DO_FETCH)
    upstreamFetch = tryRun("git", [
      "fetch",
      "--no-tags",
      "--no-write-fetch-head",
      upstreamUrl,
      upstreamTip,
    ]);
  // `cat-file -e` exits 0 when the object is present and prints nothing, so the
  // exit status is the signal, not the output.
  if (upstreamFetch.ok && tryRun("git", ["cat-file", "-e", upstreamTip]).status !== 0) {
    upstreamFetch = { ok: false, status: 1, stdout: "", error: "fetched objects are not present" };
  }
}

if (!upstreamTip) {
  die(
    `could not resolve ${UPSTREAM_REPO}@${UPSTREAM_BRANCH}.\n` +
      `list its branches:\n` +
      `  git ls-remote --heads ${upstreamUrl}`,
  );
}

// Without a merge base the two histories are unrelated: every "incoming" commit
// is meaningless to cherry-pick, and a diff against the empty base reports no
// overlap at all — the most dangerous possible output.
const base = git(["merge-base", "HEAD", upstreamTip], { soft: true });
if (!base) {
  die(
    `no merge base between HEAD and ${UPSTREAM_REPO}@${UPSTREAM_BRANCH}.\n` +
      `The histories are unrelated (a shallow clone, a rewritten fork, or the wrong repo).\n` +
      `Fetch the full history first:  git fetch --unshallow  (or --depth=1000 for a partial fetch)`,
  );
}

const behind = Number(git(["rev-list", "--count", `HEAD..${upstreamTip}`], { soft: true }) || 0);
const ahead = Number(git(["rev-list", "--count", `${upstreamTip}..HEAD`], { soft: true }) || 0);

// Files each side touched since the merge base.
// Both sides are normalized to root-space (see SKILL_PREFIX): the fork's
// copies of the skill files live under skills/grill-with-ui/, upstream's do not.
const forkFiles = new Set(
  lines(git(["diff", "--name-only", `${base}..HEAD`], { soft: true })).map(normalize),
);
const upstreamFiles = new Set(
  lines(git(["diff", "--name-only", `${base}..${upstreamTip}`], { soft: true })).map(normalize),
);
const contested = [...upstreamFiles].filter((f) => forkFiles.has(f)).sort();

// Incoming commits with their touched files, renames included, and their
// parent count so a merge is detected by shape rather than by its subject.
const raw = git(
  [
    "log",
    `--format=%x1e%h%x1f%P%x1f%ad%x1f%s`,
    "--date=short",
    "--name-status",
    "-M",
    `${base}..${upstreamTip}`,
  ],
  { soft: true },
);

const commits = [];
for (const chunk of raw.split("\x1e")) {
  if (!chunk.trim()) continue;
  const chunkLines = chunk.split("\n");
  const [sha, parents, date, subject] = (chunkLines.shift() || "").split("\x1f");
  if (!sha) continue;
  const files = new Set();
  for (const line of chunkLines) {
    // --name-status rows are "STATUS<tab>path" or "R100<tab>old<tab>new".
    if (!/^[A-Z]\d*\t/.test(line)) continue;
    for (const p of line.split("\t").slice(1)) if (p) files.add(p);
  }
  const parentList = (parents || "").trim().split(/\s+/).filter(Boolean);
  commits.push({
    sha,
    date,
    subject: subject || "",
    files: [...files].sort(),
    parentCount: parentList.length,
    isMerge: parentList.length > 1,
  });
}

// Classify each incoming commit.
//
// Two independent questions:
//   - does it touch a contract file?  (the change ripples into the whole repo)
//   - did the fork also change THAT file? (git will conflict)
// REWORK needs both on the same file. A commit that touches a contract file the
// fork did not change is ADAPT, even if some other file in it collides.
const tierOf = (files) => {
  const contract = files.filter((f) => CONTRACT_FILES.includes(normalize(f)));
  const contractOverlap = contract.filter((f) => forkFiles.has(normalize(f)));
  const otherOverlap = files.filter(
    (f) => !CONTRACT_FILES.includes(normalize(f)) && forkFiles.has(normalize(f)),
  );

  // Every contract file the commit touches is named, and the ones the fork
  // also changed are marked — a contract file the fork did NOT change still
  // needs porting, so hiding it behind the overlap would lose it.
  const contractList = contract
    .map((f) => (forkFiles.has(normalize(f)) ? `${f} (also changed here)` : f))
    .join(", ");

  if (contractOverlap.length)
    return {
      tier: "REWORK",
      contract: contract,
      contractOverlap,
      reason:
        `contract file also changed by the fork: ${contractOverlap.join(", ")}` +
        (contract.length > contractOverlap.length
          ? ` — other contract files in this commit: ${contractList}`
          : "") +
        (otherOverlap.length ? ` (also ${otherOverlap.join(", ")})` : "") +
        " — port the intent, do not take the diff",
    };
  if (contract.length)
    return {
      tier: "ADAPT",
      contract,
      contractOverlap,
      reason:
        `contract file: ${contractList}` +
        (otherOverlap.length ? ` (also collides on ${otherOverlap.join(", ")})` : "") +
        " — apply the ripple checklist",
    };
  if (otherOverlap.length)
    return {
      tier: "ADOPT",
      contract: [],
      contractOverlap,
      reason: `touches ${otherOverlap.join(", ")}, which the fork also changed — cherry-pick and resolve by hand`,
    };
  return {
    tier: "ADOPT",
    contract: [],
    contractOverlap,
    reason: "no contract file, no overlap — cherry-pick as-is",
  };
};

// Flag a commit that adds a security control to the server, or a test that
// asserts a protected endpoint is refused. The subject line is not consulted:
// upstream files a hardening commit under a documentation or review name.
//
// Only code is scanned. A design doc that *discusses* the security gap is not
// a security change, and matching prose would flag every document that
// mentions a Content-Security-Policy.
const isSecurityChange = (c) => {
  const code = c.files.filter(
    (f) =>
      normalize(f) === "server.mjs" ||
      normalize(f) === "page.html" ||
      /^test\/.*\.mjs$/.test(f),
  );
  if (!code.length) return false;

  const addedFor = (files) => {
    const patch = git(["show", "--format=", c.sha, "--", ...files], { soft: true });
    if (!patch) return "";
    return patch
      .split("\n")
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
      .join("\n");
  };

  // A control in the server (or the page) is a security change.
  const serverCode = code.filter((f) => normalize(f) === "server.mjs");
  const controlAdded = addedFor(serverCode.length ? serverCode : code);
  if (SECURITY_CONTROLS.some((re) => re.test(controlAdded))) return true;

  // A test that asserts a protected endpoint is refused is a security change.
  const testCode = code.filter((f) => /^test\/.*\.mjs$/.test(f));
  if (!testCode.length) return false;
  const testAdded = addedFor(testCode);
  return SECURITY_TESTS.some((re) => re.test(testAdded));
};

for (const c of commits) {
  if (c.isMerge) {
    c.tier = "MERGE";
    c.reason = "merge commit — no diff of its own; take the commits it merged";
    c.contract = [];
    c.security = false;
  } else {
    Object.assign(c, tierOf(c.files));
    c.security = isSecurityChange(c);
  }
}

// Install freshness. There are two running copies since the plugin restructure,
// and neither is commit-tracked:
//   - the grill-with-ui PLUGIN at
//     ~/.copilot/installed-plugins/grill-with-ui/grill-with-ui — a plain copy
//     with no git metadata, so freshness is its plugin.json version against
//     the repo's.
//   - the fork-sync SKILL at ~/.agents/skills/fork-sync — a manual copy,
//     compared through SKILL.md's metadata.version the same way.
// grill-with-ui left ~/.agents/.skill-lock.json when it became a plugin, so
// the lock is not consulted: equal versions are the signal that the agent runs
// what the repo ships. A hash would move on README-only commits, which need no
// reinstall; the version tracks the contract, which is what a stale install
// would be missing.
const parseSkillVersion = (text) => {
  const m = (text || "").match(/^\s*version:\s*["']?([0-9][0-9.]*)/m);
  return m ? m[1] : null;
};

const compareVersions = (a, b) => {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
};

const here = dirname(fileURLToPath(import.meta.url));
const installTargets = [
  {
    name: "plugin grill-with-ui",
    kind: "json",
    repoFile: join(root, "plugin.json"),
    instFile: join(
      homedir(),
      ".copilot",
      "installed-plugins",
      "grill-with-ui",
      "grill-with-ui",
      "plugin.json",
    ),
    remedy:
      "copilot plugin marketplace update grill-with-ui && copilot plugin update grill-with-ui",
  },
  {
    name: "skill fork-sync",
    kind: "skill",
    repoFile: join(here, "..", "SKILL.md"),
    instFile: join(homedir(), ".agents", "skills", "fork-sync", "SKILL.md"),
    remedy: "copy .github/skills/fork-sync/ over ~/.agents/skills/fork-sync/",
  },
];

const installs = installTargets.map((t) => {
  const readV = (file) => {
    try {
      const text = readFileSync(file, "utf8");
      return t.kind === "json" ? (JSON.parse(text).version ?? null) : parseSkillVersion(text);
    } catch {
      return null;
    }
  };
  const repoVersion = readV(t.repoFile);
  const installedExists = existsSync(t.instFile);
  const installedVersion = installedExists ? readV(t.instFile) : null;
  let state;
  if (!repoVersion) state = "unknown";
  else if (!installedExists) state = "missing";
  else if (installedVersion === null) state = "unknown";
  else if (installedVersion === repoVersion) state = "current";
  else state = compareVersions(installedVersion, repoVersion) < 0 ? "behind" : "ahead";
  return { name: t.name, state, installedVersion, repoVersion, remedy: t.remedy };
});

// Method-lineage drift. mattpocock/skills has no merge base with the fork, so
// freshness is pinned: lineage.json records each dependency's last AUDITED
// commit and a snapshot of every skill path in the repo. The live tree is
// compared with both — a moved pin means unaudited drift to reconcile, and a
// path outside the snapshot is a new skill to audit for dependency relevance
// (the keyword screen only narrows the list; relevance stays a human call).
// A pin is an audit date, not a port date: the reconciliation backlog lives in
// issues/. gh is required; without it, or under --no-fetch, the section says
// why it is missing instead of implying the lineage is clean.
const lineageFile = join(here, "..", "lineage.json");
let lineage = null;
if (existsSync(lineageFile)) {
  if (!DO_FETCH) {
    lineage = { skipped: "--no-fetch" };
  } else if (!tryRun("gh", ["--version"]).ok) {
    lineage = { skipped: "gh not available" };
  } else {
    let pins = null;
    try {
      pins = JSON.parse(readFileSync(lineageFile, "utf8"));
    } catch {
      lineage = { error: "lineage.json could not be parsed" };
    }
    if (pins) {
      const deps = [];
      let failed = false;
      for (const d of pins.dependencies || []) {
        const res = tryRun("gh", [
          "api",
          `repos/${pins.repo}/commits?path=${encodeURIComponent(d.path)}&per_page=1`,
        ]);
        let live = null;
        if (res.ok) {
          try {
            const first = JSON.parse(res.stdout)[0];
            if (first?.sha) {
              live = {
                sha: first.sha,
                date: String(first.commit?.committer?.date || "").slice(0, 10),
              };
            }
          } catch {
            live = null;
          }
        }
        if (!live) {
          failed = true;
          break;
        }
        deps.push({
          path: d.path,
          role: d.role || "",
          pinnedCommit: d.pinnedCommit,
          pinnedDate: d.pinnedDate,
          liveSha: live.sha,
          liveDate: live.date,
          state: live.sha === d.pinnedCommit ? "stable" : "drifted",
        });
      }
      let newSkills = [];
      let removedSkills = [];
      if (!failed) {
        const tree = tryRun("gh", ["api", `repos/${pins.repo}/git/trees/${pins.ref}?recursive=1`]);
        if (!tree.ok) {
          failed = true;
        } else {
          try {
            const entries = JSON.parse(tree.stdout).tree.map((e) => e.path);
            const liveSet = new Set(
              entries
                .filter((p) => p.endsWith("/SKILL.md"))
                .map((p) => p.slice(0, -"/SKILL.md".length)),
            );
            const known = new Set(pins.knownSkills || []);
            newSkills = [...liveSet].filter((p) => !known.has(p)).sort();
            removedSkills = [...known].filter((p) => !liveSet.has(p)).sort();
          } catch {
            failed = true;
          }
        }
      }
      lineage = failed
        ? { error: `could not read ${pins.repo} via gh api` }
        : {
            repo: pins.repo,
            ref: pins.ref,
            auditedAt: pins.auditedAt,
            deps,
            newSkills,
            removedSkills,
            candidates: newSkills.filter((p) =>
              (pins.relevanceKeywords || []).some((k) => p.toLowerCase().includes(k.toLowerCase())),
            ),
          };
    }
  }
}

// Open upstream pull requests, when gh is available.
let prs = null;
if (tryRun("gh", ["--version"]).ok) {
  const res = tryRun("gh", [
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
  if (res.ok) {
    try {
      prs = JSON.parse(res.stdout);
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
        upstream: {
          repo: UPSTREAM_REPO,
          branch: UPSTREAM_BRANCH,
          // The ref the tip was read from, when the `upstream` remote was used.
          // A named --upstream repo is read by sha, so it has no ref.
          ref: upstreamRef,
          tip: upstreamTip,
        },
        fetchOk: upstreamFetch.ok,
        mergeBase: base,
        ahead,
        behind,
        contestedFiles: contested,
        commits,
        installs,
        lineage,
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
  `vs ${UPSTREAM_REPO}@${UPSTREAM_BRANCH}: ${behind} behind, ${ahead} ahead` +
    `   (merge base ${base.slice(0, 7)})`,
);
if (!upstreamFetch.ok)
  console.log("WARNING: fetch failed — the upstream data below may be stale.");
console.log("");

if (!commits.length) console.log("No incoming commits — already up to date.\n");

if (commits.length) {
  const counts = commits.reduce((acc, c) => ({ ...acc, [c.tier]: (acc[c.tier] || 0) + 1 }), {});
  const sec = commits.filter((c) => c.security).length;
  console.log(
    `Incoming: ${commits.length} commits  ` +
      `[REWORK ${counts.REWORK || 0} | ADAPT ${counts.ADAPT || 0} | ADOPT ${counts.ADOPT || 0}` +
      `${counts.MERGE ? ` | MERGE ${counts.MERGE}` : ""}]` +
      `${sec ? `   ${sec} security-relevant` : ""}`,
  );
  console.log("");
  for (const c of commits) {
    const flag = c.security ? "  [security]" : "";
    console.log(`  ${c.tier.padEnd(8)} ${c.sha} ${c.date}  ${c.subject}${flag}`);
    console.log(`           ${c.reason}`);
    if (c.tier !== "ADOPT" && c.files.length) console.log(`           files: ${c.files.join(", ")}`);
  }
  console.log("");
}

if (contested.length) {
  console.log(`Contested files (both sides changed since ${base.slice(0, 7)}):`);
  for (const f of contested) console.log(`  ${f}`);
  console.log("");
}

for (const i of installs) {
  const label = {
    current: `current — v${i.repoVersion}`,
    behind: `BEHIND — installed v${i.installedVersion}, repo v${i.repoVersion}`,
    ahead: `AHEAD — installed v${i.installedVersion}, repo v${i.repoVersion} (a different branch?)`,
    missing: `NOT INSTALLED — repo is v${i.repoVersion}`,
    unknown: "unknown (could not read a version)",
  }[i.state];
  console.log(`Install (${i.name}): ${label}`);
  if (i.state === "behind" || i.state === "missing") console.log(`  refresh: ${i.remedy}`);
}
console.log("");

if (lineage) {
  if (lineage.skipped) {
    console.log(`Lineage: skipped — ${lineage.skipped}`);
  } else if (lineage.error) {
    console.log(`Lineage: ${lineage.error}`);
  } else {
    console.log(
      `Lineage (${lineage.repo}@${lineage.ref}, pins audited ${lineage.auditedAt}):`,
    );
    for (const d of lineage.deps) {
      const flag = d.state === "drifted" ? "DRIFTED" : "stable ";
      console.log(
        `  ${flag} ${d.path} — pin ${d.pinnedDate} (${d.pinnedCommit.slice(0, 7)}),` +
          ` live ${d.liveDate} (${d.liveSha.slice(0, 7)})`,
      );
      if (d.state === "drifted")
        console.log(
          "           read the new commits, reconcile through the ripple checklist, then update the pin",
        );
    }
    if (lineage.newSkills.length) {
      console.log(
        `  new skills since the pin audit: ${lineage.newSkills.join(", ")}` +
          (lineage.candidates.length
            ? `   relevance candidates: ${lineage.candidates.join(", ")}`
            : ""),
      );
    } else {
      console.log("  no new skills since the pin audit");
    }
    if (lineage.removedSkills.length)
      console.log(
        `  gone since the pin audit (renamed or removed): ${lineage.removedSkills.join(", ")}`,
      );
  }
  console.log("");
}

if (prs && prs.length) {
  console.log(
    `Open upstream PRs (${prs.length}) — merge before adopting, or cherry-pick the branch:`,
  );
  for (const p of prs) {
    console.log(`  #${p.number} ${p.createdAt.slice(0, 10)} ${p.headRefName} — ${p.title}`);
  }
  console.log("");
}
