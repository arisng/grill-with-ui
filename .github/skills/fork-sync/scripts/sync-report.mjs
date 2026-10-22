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
import { join } from "node:path";

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
const forkFiles = new Set(lines(git(["diff", "--name-only", `${base}..HEAD`], { soft: true })));
const upstreamFiles = new Set(
  lines(git(["diff", "--name-only", `${base}..${upstreamTip}`], { soft: true })),
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
  const contract = files.filter((f) => CONTRACT_FILES.includes(f));
  const contractOverlap = contract.filter((f) => forkFiles.has(f));
  const otherOverlap = files.filter((f) => !CONTRACT_FILES.includes(f) && forkFiles.has(f));

  // Every contract file the commit touches is named, and the ones the fork
  // also changed are marked — a contract file the fork did NOT change still
  // needs porting, so hiding it behind the overlap would lose it.
  const contractList = contract
    .map((f) => (forkFiles.has(f) ? `${f} (also changed here)` : f))
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
    (f) => f === "server.mjs" || f === "page.html" || /^test\/.*\.mjs$/.test(f),
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
  const serverCode = code.filter((f) => f !== "server.mjs" ? false : true);
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

// Installed copy freshness. The lock records the commit that was installed, so
// the comparison is against the SOURCE's tip — not local HEAD. An install that
// is behind local HEAD but current with its source is not stale.
const lockPath = join(homedir(), ".agents", ".skill-lock.json");
let install = null;
if (existsSync(lockPath)) {
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    const entry = lock?.skills?.["grill-with-ui"];
    if (entry) {
      const installedCommit = entry.skillFolderHash || "";
      // The hash is a commit sha only for a git-sourced install. For a local or
      // content-addressed install it is a tree hash, and comparing it with a
      // commit would report a false "behind".
      const gitSourced = !entry.sourceType || entry.sourceType === "github" || entry.sourceType === "git";
      let sourceTip = null;
      if (gitSourced && entry.sourceUrl && entry.ref) {
        const res = tryRun("git", [
          "ls-remote",
          entry.sourceUrl,
          `refs/heads/${entry.ref}`,
        ]);
        if (res.ok) {
          const first = lines(res.stdout)[0];
          sourceTip = first ? first.split(/\s+/)[0] : null;
        }
      }
      // The relationship between the local checkout and the source tip decides
      // the advice. An inequality only says "they differ"; ancestry says which
      // side is ahead. `merge-base --is-ancestor` exits 1 for "not an
      // ancestor", which is an answer, not an error.
      const isAncestor = (ancestor, descendant) => {
        if (!ancestor || !descendant) return null;
        const res = tryRun("git", ["merge-base", "--is-ancestor", ancestor, descendant]);
        if (res.status === 0) return true;
        if (res.status === 1) return false;
        return null;
      };
      let localRelation = "differs";
      if (sourceTip && installedCommit) {
        if (isAncestor(head, sourceTip)) localRelation = "local-ahead";
        else if (isAncestor(sourceTip, head)) localRelation = "local-behind";
      }
      install = {
        source: entry.source,
        ref: entry.ref,
        sourceUrl: entry.sourceUrl,
        installedAt: entry.installedAt,
        updatedAt: entry.updatedAt,
        installedCommit,
        sourceTip,
        state: !sourceTip ? "unknown" : installedCommit === sourceTip ? "current" : "behind",
        localRelation,
        sourceType: entry.sourceType,
      };
    }
  } catch {
    install = { error: "could not parse .skill-lock.json" };
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

if (install) {
  if (install.error) {
    console.log(`Installed copy: ${install.error}`);
  } else {
    const stateText = {
      current: "current with its source",
      behind: "BEHIND its source",
      unknown: "unknown (could not reach the source)",
    }[install.state];
    console.log(
      `Installed copy (${install.source}@${install.ref}): ${stateText} — ` +
        `installed ${String(install.installedCommit).slice(0, 7)}` +
        (install.sourceTip ? `, source tip ${install.sourceTip.slice(0, 7)}` : ""),
    );
    if (install.state === "behind") console.log("  refresh with: npx skills update -g -y");
    if (install.state === "current" && install.localRelation === "local-ahead")
      console.log(
        "  note: local HEAD is ahead of the source tip — push the fork, then update again",
      );
    if (install.state === "current" && install.localRelation === "local-behind")
      console.log("  note: the source tip is ahead of local HEAD — pull the fork");
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
