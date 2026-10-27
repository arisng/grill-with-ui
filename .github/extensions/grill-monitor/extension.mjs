// Extension: grill-monitor
//
// Replaces grill-with-ui's agent-side `wait` polling loop. The agent attaches a
// grill session once (Start/Resume); from then on THIS process runs
// `server.mjs wait` as a child (pure file polling, zero LLM tokens) and each
// browser Send is delivered to the chat as exactly one turn via session.send.
// SKILL.md's "Extension monitor" listening mode is the behavioral contract.
//
// File ownership is unchanged from the skill: state.json is written only by
// the agent through `patch`, events.jsonl is appended only by the server.
// This extension only reads them; the one file it writes is its own lock,
// monitor.json, which keeps a single waiter per session across chats.
//
// No console.log anywhere: stdout is reserved for JSON-RPC in the extension
// host. Use session.log / session.send only.

import * as fs from "node:fs";
import * as path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const { joinSession } = await import("@github/copilot-sdk/extension");

/** @type {import("@github/copilot-sdk/extension") | null} joined session; tools run only after this is set */
let session = null;

/** @type {Map<string, any>} resolved session dir -> monitor */
const monitors = new Map();

const ACK_POLL_MS = 500;
const ERROR_WAKE_COOLDOWN_MS = 5 * 60_000;
// A wake turn normally acks within seconds; the grace keeps session.idle events
// that fire between send-enqueue and turn-start from producing a premature
// "never acknowledged" re-wake for a Send that is merely still queued.
const REWAKE_GRACE_MS = 20_000;

// ---- small helpers ---------------------------------------------------------

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e && e.code === "EPERM"; // exists but owned by someone else
  }
}

const lockFile = (dir) => path.join(dir, "monitor.json");

function readLock(dir) {
  try {
    const v = JSON.parse(fs.readFileSync(lockFile(dir), "utf8"));
    return v && Number.isInteger(v.pid) ? v : null;
  } catch {
    return null;
  }
}

function releaseLock(dir, force = false) {
  const l = readLock(dir);
  // Normal release only removes our own lock; detach forces, because a stale
  // lock with a recycled live pid must not trap the session (single agent
  // session per grill is a locked design decision, so nothing else holds it).
  if (l && (force || l.pid === process.pid)) {
    try {
      fs.unlinkSync(lockFile(dir));
    } catch { /* already gone */ }
  }
}

// Atomic claim: wx create closes the two-attach race (both see no lock, both
// arm). EEXIST -> live foreign pid refuses with a recovery hint; a stale lock
// (dead or recycled pid) is unlinked once and claimed on the retry.
function claimLock(dir) {
  const payload = JSON.stringify({ pid: process.pid, at: new Date().toISOString() });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(lockFile(dir), payload, { flag: "wx" });
      return { ok: true };
    } catch (e) {
      if (e.code !== "EEXIST") return { ok: false, error: `cannot write monitor lock: ${e.message}` };
      const holder = readLock(dir);
      if (holder && holder.pid !== process.pid && pidAlive(holder.pid)) {
        return {
          ok: false,
          error:
            `a monitor is already attached to this session (pid ${holder.pid}, since ${holder.at}) — ` +
            `if that is not a live grill monitor, delete ${lockFile(dir)} and attach again`,
        };
      }
      try {
        fs.unlinkSync(lockFile(dir));
      } catch { /* another claimant moved it; retry */ }
    }
  }
  return { ok: false, error: "monitor lock contention — attach again" };
}

function readState(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf8"));
  } catch {
    return null;
  }
}

// agent.handled: absent (fresh grill from `new`) -> 0; present but not a
// non-negative integer -> hard error, never coerced (coercing a corrupt value
// to 0 would replay the whole history as one wake per turn).
function readHandled(dir) {
  const st = readState(dir);
  if (!st) {
    const e = new Error(`unreadable state.json in ${dir}`);
    e.code = "bad-state";
    throw e;
  }
  const h = st.agent ? st.agent.handled : undefined;
  if (h === undefined || h === null) return 0;
  if (typeof h !== "number" || !Number.isInteger(h) || h < 0) {
    const e = new Error(`agent.handled is not a non-negative integer: ${JSON.stringify(h)}`);
    e.code = "bad-handled";
    throw e;
  }
  return h;
}

function safeReadHandled(dir) {
  try {
    return readHandled(dir);
  } catch {
    return -1; // unreadable mid-write: keep the previous after value
  }
}

function readUrl(dir) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(dir, "server.json"), "utf8"));
    if (s && s.url && (!s.pid || pidAlive(Number(s.pid)))) return s.url;
  } catch { /* no server */ }
  return null;
}

// ---- monitor lifecycle -----------------------------------------------------

function stopMonitor(m) {
  m.stopped = true;
  if (m.pollTimer) {
    clearInterval(m.pollTimer);
    m.pollTimer = null;
  }
  if (m.rewakeTimer) {
    clearTimeout(m.rewakeTimer);
    m.rewakeTimer = null;
  }
  if (m.child) {
    const c = m.child;
    m.child = null;
    try {
      c.kill();
    } catch { /* already exited */ }
  }
}

function stopAll() {
  for (const m of [...monitors.values()]) {
    stopMonitor(m);
    releaseLock(m.dir);
    monitors.delete(m.dir);
  }
}

// Single-flight: m.child non-null means a waiter is running; arm() is the only
// spawn site. Its callers are attach, deliver, the exit-3 close handler, and
// watchAck — session.idle's handler only re-wakes and never arms — so no code
// path can ever produce two waiters for one session.
function arm(m) {
  if (m.stopped || m.child) return;
  const after = Math.max(m.lastDelivered, safeReadHandled(m.dir));
  const child = spawn(
    process.execPath,
    [m.server, "wait", "--session", m.dir, "--after", String(after), "--timeout", "600"],
    { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  m.child = child;
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => {
    out += d;
  });
  child.stderr.on("data", (d) => {
    err += d;
  });
  child.on("error", (e) => {
    if (m.child !== child) return;
    m.child = null;
    onWaitFailure(m, `spawn failed: ${e.message}`);
  });
  child.on("close", (code) => {
    if (m.child !== child) return; // stopped or replaced meanwhile
    m.child = null;
    if (m.stopped) return;
    if (code === 0) {
      deliver(m, out);
      return;
    }
    if (code === 3) {
      arm(m); // idle timeout: re-arm silently
      return;
    }
    const tail = String(err).trim().split("\n").filter(Boolean).pop() || "unknown";
    onWaitFailure(m, `wait exited with code ${code}: ${tail}`);
  });
}

// A Send landed: deliver it, then watch for the agent's agent.handled ack
// before re-arming. Serialized by construction — the next wait starts only
// after the previous Send is acknowledged, which is what drains bursts in
// order without ever delivering one twice.
function deliver(m, out) {
  const line = String(out)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .pop();
  let ev;
  try {
    ev = JSON.parse(line);
  } catch {
    onWaitFailure(m, "wait produced an unparseable event line");
    return;
  }
  const seq = Number(ev.seq) || 0;
  if (seq <= m.lastDelivered) {
    arm(m); // defensive: never re-deliver a delivered Send
    return;
  }
  m.lastDelivered = seq;
  m.wakeAt = Date.now();
  void sendPrompt(wakeText(m, ev, line));
  watchAck(m);
}

function watchAck(m) {
  if (m.pollTimer) return;
  m.pollTimer = setInterval(() => {
    if (m.stopped) {
      clearInterval(m.pollTimer);
      m.pollTimer = null;
      return;
    }
    const h = safeReadHandled(m.dir);
    if (h >= 0 && h >= m.lastDelivered) {
      clearInterval(m.pollTimer);
      m.pollTimer = null;
      arm(m); // acked: next waiter, after = max(lastDelivered, handled)
    }
  }, ACK_POLL_MS);
}

async function sendPrompt(prompt) {
  if (!session) return false;
  try {
    await session.send({ prompt });
    return true;
  } catch (e) {
    try {
      await session.log(`grill-monitor: session.send failed: ${e && e.message}`, { level: "error" });
    } catch { /* log is best-effort */ }
    return false;
  }
}

function onWaitFailure(m, reason) {
  m.failed = reason;
  try {
    void session.log(`grill-monitor: waiter for ${m.dir} stopped: ${reason}`, { level: "error" });
  } catch { /* best-effort */ }
  const now = Date.now();
  if (now - m.lastErrorWakeAt < ERROR_WAKE_COOLDOWN_MS) return;
  m.lastErrorWakeAt = now;
  void sendPrompt(errorText(m, reason));
  // No auto re-arm: a non-{0,3} exit means the session/server itself is broken.
  // The agent recovers (verify serve via `url`, re-attach).
}

// ---- messages --------------------------------------------------------------
// Wording follows SKILL.md's event rule and "Handling a send": one Send, one
// patch of agent.handled, end of turn. The "not a resume" line exists because
// wait-mode step 1 trains the opposite reflex (drain `pending` on every entry).

function wakeText(m, ev, line) {
  return (
    `[grill-monitor] Send #${ev.seq} arrived for grill session ${m.dir} — the user pressed Send on the grill page.\n` +
    `Raw event: ${line}\n` +
    `Handle it per SKILL.md "Handling a send". This was delivered by the monitor — it is NOT a resume: ` +
    `do NOT run \`pending\`. Handle this Send only, patch agent.handled=${ev.seq}, then end your turn. ` +
    `Do NOT run \`server.mjs wait\` — the monitor is listening.`
  );
}

function reWakeText(m) {
  let handled = null;
  try {
    handled = readHandled(m.dir);
  } catch { /* keep null */ }
  return (
    `[grill-monitor] Send #${m.lastDelivered} for grill session ${m.dir} was delivered but never acknowledged ` +
    `(agent.handled is ${handled}). Re-handle that Send if it was not applied, or patch agent.handled=${m.lastDelivered} ` +
    `if it was. Do NOT run \`pending\`, do NOT run \`wait\`, then end your turn.`
  );
}

function errorText(m, reason) {
  return (
    `[grill-monitor] The grill monitor for session ${m.dir} stopped: ${reason}\n` +
    `The listener is inactive; browser Sends stay queued on disk until re-attached. ` +
    `Verify the server with \`node <server> url --session ${m.dir}\` (restart it if needed), ` +
    `then call grill_attach again. Do NOT switch to the wait loop unless re-attaching keeps failing.`
  );
}

// ---- tools -----------------------------------------------------------------

const attachTool = {
  name: "grill_attach",
  description:
    "Attach the grill-with-ui session monitor (SKILL.md \"Extension monitor\" mode): this extension runs `server.mjs wait` itself and delivers every browser Send to this chat as one turn, so you never run `wait` or poll. Call once at Start after `serve` is verified, and again on Resume after draining `pending`. Detach at Finish with grill_detach. Arguments: `session` = absolute grill session folder; `server` = absolute path to the skill's server.mjs.",
  skipPermission: true,
  defer: "never",
  parameters: {
    type: "object",
    properties: {
      session: { type: "string", description: "Absolute path to the grill session folder (from `new` or `sessions`)." },
      server: { type: "string", description: "Absolute path to the skill's server.mjs ($SKILL/server.mjs)." },
    },
    required: ["session", "server"],
  },
  handler: async (args) => {
    try {
      const dir = typeof args.session === "string" && path.isAbsolute(args.session) ? path.resolve(args.session) : null;
      if (!dir) return JSON.stringify({ ok: false, error: "`session` must be an absolute path" });
      if (!fs.existsSync(path.join(dir, "state.json"))) {
        return JSON.stringify({ ok: false, error: `no state.json in ${dir} — is that a grill session folder?` });
      }
      const server = typeof args.server === "string" && path.isAbsolute(args.server) ? path.resolve(args.server) : null;
      if (!server || !fs.existsSync(server)) {
        return JSON.stringify({ ok: false, error: "`server` must be an absolute path to an existing server.mjs" });
      }
      const handled = readHandled(dir); // throws on corrupt agent.handled

      // Claim the lock BEFORE touching any existing monitor: a refused
      // re-attach (foreign live holder) must leave the incumbent untouched.
      const claim = claimLock(dir);
      if (!claim.ok) return JSON.stringify({ ok: false, error: claim.error });

      const existing = monitors.get(dir);
      if (existing) stopMonitor(existing); // re-attach (Resume) replaces ours
      // Carry the delivered watermark across re-attach so an in-flight unacked
      // Send is never re-delivered by the new waiter.
      const m = {
        dir,
        server,
        child: null,
        pollTimer: null,
        rewakeTimer: null,
        stopped: false,
        lastDelivered: existing ? existing.lastDelivered : 0,
        wakeAt: existing ? existing.wakeAt : 0,
        reWoken: existing ? existing.reWoken : new Set(),
        lastErrorWakeAt: 0,
        failed: null,
      };
      monitors.set(dir, m);
      arm(m);
      return JSON.stringify({ ok: true, handled, url: readUrl(dir), reattached: Boolean(existing) });
    } catch (e) {
      return JSON.stringify({ ok: false, error: e && e.message ? e.message : String(e) });
    }
  },
};

const detachTool = {
  name: "grill_detach",
  description:
    "Detach the grill-with-ui session monitor: kills the waiter and releases the lock so no further Sends wake the chat. Call at Finish (after the docs are saved) or whenever the interview stops.",
  skipPermission: true,
  defer: "never",
  parameters: {
    type: "object",
    properties: {
      session: { type: "string", description: "Absolute path to the grill session folder." },
    },
    required: ["session"],
  },
  handler: async (args) => {
    const dir = typeof args.session === "string" && path.isAbsolute(args.session) ? path.resolve(args.session) : null;
    if (!dir) return JSON.stringify({ ok: false, error: "`session` must be an absolute path" });
    const m = monitors.get(dir);
    if (!m) {
      releaseLock(dir, true);
      return JSON.stringify({ ok: true, stopped: false });
    }
    stopMonitor(m);
    monitors.delete(dir);
    releaseLock(dir, true);
    return JSON.stringify({ ok: true, stopped: true });
  },
};

const statusTool = {
  name: "grill_status",
  description:
    "Report grill-monitor state for one attached session (or all): waiter alive, last delivered Send seq, agent.handled, server url, and any monitor failure. Read-only.",
  skipPermission: true,
  defer: "never",
  parameters: {
    type: "object",
    properties: {
      session: { type: "string", description: "Absolute session folder; omit to list every attached session." },
    },
    required: [],
  },
  handler: async (args) => {
    const only = args && typeof args.session === "string" && path.isAbsolute(args.session) ? path.resolve(args.session) : null;
    const rows = [];
    for (const [dir, m] of monitors) {
      if (only && dir !== only) continue;
      let handled = null;
      let stateError = null;
      try {
        handled = readHandled(dir);
      } catch (e) {
        stateError = e && e.message ? e.message : String(e);
      }
      rows.push({
        session: dir,
        waiterAlive: Boolean(m.child),
        lastDelivered: m.lastDelivered,
        handled,
        stateError,
        url: readUrl(dir),
        failed: m.failed,
        lock: readLock(dir),
      });
    }
    return JSON.stringify({ ok: true, monitors: rows });
  },
};

// ---- session wiring --------------------------------------------------------

// A second copy of this extension can load in the same session (personal install
// + this repo's .github/extensions while the repo is open as the workspace). The
// host registers one connection's tools and rejects the other with a name clash;
// the loser exits quietly and the winner serves the session.
let joined;
try {
  joined = await joinSession({
    tools: [attachTool, detachTool, statusTool],
    hooks: {
      // Covers extension reload, /clear, chat close: never leave an orphaned
      // waiter or a stale lock behind. (A hard kill is bounded by wait's own
      // --timeout 600 and detected as a dead pid by the next attach.)
      onSessionEnd: async () => {
        stopAll();
      },
    },
    extensionInfo: {
      name: "grill-monitor",
      source: fileURLToPath(import.meta.url).startsWith(path.join(os.homedir(), ".copilot", "extensions"))
        ? "personal"
        : "project",
    },
  });
} catch (e) {
  if (e && /already registered|name clash/i.test(String(e.message || e))) process.exit(0);
  throw e;
}
session = joined;

// R5 unacked-Send recovery: the wake turn was stopped before patching
// agent.handled. One bounded re-wake per seq, then silence — a loop here
// would nag forever when the user cancels a turn on purpose. The grace period
// absorbs session.idle events that fire while the wake is still queued; the
// check runs again when the grace expires even if no further idle arrives.
function maybeRewake(m) {
  if (m.stopped || m.lastDelivered <= 0 || m.reWoken.has(m.lastDelivered)) return;
  const fire = () => {
    m.rewakeTimer = null;
    if (m.stopped || m.reWoken.has(m.lastDelivered)) return;
    const h = safeReadHandled(m.dir);
    if (h >= 0 && h < m.lastDelivered) {
      m.reWoken.add(m.lastDelivered);
      void sendPrompt(reWakeText(m));
    }
  };
  const wait = m.wakeAt + REWAKE_GRACE_MS - Date.now();
  if (wait <= 0) {
    fire();
    return;
  }
  if (m.rewakeTimer) clearTimeout(m.rewakeTimer);
  m.rewakeTimer = setTimeout(fire, wait);
}
session.on("session.idle", () => {
  for (const m of monitors.values()) maybeRewake(m);
});

// Test seam: lets the committed unit tests observe monitor state without
// reaching into the closure. Harmless at runtime.
export const __test = { monitors, stopAll, readHandled, arm, stopMonitor };
