// grill-monitor extension tests — exercise the real extension.mjs (monitor
// loop, lock, ack handshake) against the real server.mjs wait CLI, with the
// Copilot SDK replaced by test/stubs/copilot-sdk-extension.mjs.
//
// Run (from .github/extensions/grill-monitor):
//   node --import ./test/register-sdk-stub.mjs --test test/extension.test.mjs
//
// GRILL_HOME is a temp folder whose path contains a SPACE, so every CLI call
// and spawned waiter in this suite also covers Windows spaced-path handling.

import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(HERE, "..", "..", "..", "..", "skills", "grill-with-ui", "server.mjs");
const REPO = path.resolve(HERE, "..", "..", "..", "..");

const HOME = path.join(os.tmpdir(), `grill monitor ${Date.now()}`);
process.env.GRILL_HOME = HOME;

// Import the real extension under the SDK stub; joinSession's config and
// session call record land on globalThis.__grillMonitorTest.
await import("../extension.mjs");
const rec = globalThis.__grillMonitorTest;
const { __test } = await import("../extension.mjs");
const tools = rec.config.tools || [];
const tool = (name) => {
  const t = tools.find((x) => x.name === name);
  assert.ok(t, `tool ${name} registered`);
  return t;
};
const toolCall = async (name, args) => JSON.parse(await tool(name).handler(args));

function newSession(topic) {
  const out = execFileSync(process.execPath, [SERVER, "new", "--topic", topic], {
    cwd: REPO,
    env: { ...process.env, GRILL_HOME: HOME },
    encoding: "utf8",
  });
  return JSON.parse(out.trim().split("\n").pop()).session;
}

function appendSend(dir, seq) {
  const line = JSON.stringify({
    type: "send",
    seq,
    at: new Date().toISOString(),
    session: dir,
    actions: [{ type: "answer", id: "q1", value: `answer-${seq}` }],
  });
  fs.appendFileSync(path.join(dir, "events.jsonl"), line + "\n");
}

function patchHandled(dir, n) {
  const p = path.join(dir, "state.json");
  const st = JSON.parse(fs.readFileSync(p, "utf8"));
  st.agent = { ...(st.agent || {}), handled: n };
  fs.writeFileSync(p, JSON.stringify(st));
}

const sends = () => rec.sends.length;
const wakeSeqs = () =>
  rec.sends
    .map((s) => {
      const m = /Send #(\d+)/.exec(s.prompt || "");
      return m ? Number(m[1]) : null;
    })
    .filter((x) => x !== null);

async function waitFor(cond, label, ms = 8000) {
  const t0 = Date.now();
  for (;;) {
    let v = false;
    try {
      v = await cond();
    } catch {
      v = false; // transient read errors are just "not yet"
    }
    if (v) return;
    if (Date.now() - t0 > ms) throw new Error(`timeout waiting for: ${label}`);
    await new Promise((r) => setTimeout(r, 60));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const monitorOf = (dir) => __test.monitors.get(path.resolve(dir));

after(() => {
  __test.stopAll();
  try {
    fs.rmSync(HOME, { recursive: true, force: true });
  } catch { /* best effort */ }
});

// ---- registration ----------------------------------------------------------

test("joinSession registers exactly the 3 grill tools, no canvas, and onSessionEnd", () => {
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["grill_attach", "grill_detach", "grill_status"]);
  for (const t of tools) {
    assert.equal(typeof t.handler, "function", `${t.name} has a handler`);
    assert.ok(t.description && t.description.length > 40, `${t.name} has a real description`);
    assert.equal(t.skipPermission, true);
  }
  assert.equal(rec.config.canvases, undefined, "no canvas — the web page stays the UI");
  assert.equal(typeof rec.config.hooks?.onSessionEnd, "function");
  assert.equal(rec.config.extensionInfo?.name, "grill-monitor");
});

// ---- attach validation -----------------------------------------------------

test("attach rejects bad arguments and corrupt agent.handled", async () => {
  const dir = newSession("validation");
  assert.ok(dir.includes(" "), "suite runs under a spaced GRILL_HOME");

  let r = await toolCall("grill_attach", { session: "relative/path", server: SERVER });
  assert.equal(r.ok, false);
  assert.match(r.error, /absolute/);

  r = await toolCall("grill_attach", { session: path.join(HOME, "nope"), server: SERVER });
  assert.equal(r.ok, false);
  assert.match(r.error, /state\.json/);

  r = await toolCall("grill_attach", { session: dir, server: path.join(HOME, "missing-server.mjs") });
  assert.equal(r.ok, false);
  assert.match(r.error, /server/);

  r = await toolCall("grill_attach", { session: dir, server: SERVER });
  assert.equal(r.ok, true, `attach should succeed: ${r.error || ""}`);
  assert.equal(r.handled, 0, "fresh `new` state has no handled -> 0");
  await toolCall("grill_detach", { session: dir });

  const p = path.join(dir, "state.json");
  const st = JSON.parse(fs.readFileSync(p, "utf8"));
  st.agent.handled = "yes";
  fs.writeFileSync(p, JSON.stringify(st));
  r = await toolCall("grill_attach", { session: dir, server: SERVER });
  assert.equal(r.ok, false, "corrupt handled must hard-fail, never coerce to 0");
  assert.match(r.error, /agent\.handled/);
  assert.equal(sends(), 0, "no wake storm from a rejected attach");
});

// ---- the core loop ---------------------------------------------------------

test("first Send wakes exactly once; ack re-arms; no redelivery before ack; burst drains in order", async () => {
  const dir = newSession("wake-loop");
  const before = sends();

  const r = await toolCall("grill_attach", { session: dir, server: SERVER });
  assert.equal(r.ok, true, r.error || "");
  const m = monitorOf(dir);
  assert.ok(m && m.child, "waiter armed at attach");

  appendSend(dir, 1);
  await waitFor(() => sends() === before + 1, "wake for Send #1");
  const wake1 = rec.sends[sends() - 1].prompt;
  assert.match(wake1, /Send #1 arrived for grill session/);
  assert.ok(wake1.includes(dir), "wake carries the session dir");
  assert.ok(wake1.includes('"type":"send"'), "wake carries the raw event line");
  assert.match(wake1, /NOT a resume/, "wake suppresses the pending-drain reflex");
  assert.match(wake1, /patch agent\.handled=1/);

  // Burst lands while Send #1 is unacknowledged: nothing may be delivered yet.
  appendSend(dir, 2);
  await sleep(1300); // > 2 ack-poll cycles
  assert.equal(sends(), before + 1, "no delivery before agent.handled ack");
  assert.equal(m.child, null, "single-flight: no second waiter while unacked");

  // Ack Send #1 -> serialized re-arm delivers Send #2 exactly once.
  patchHandled(dir, 1);
  await waitFor(() => sends() === before + 2, "wake for Send #2");
  assert.deepEqual(wakeSeqs().slice(-2), [1, 2], "ordered, one wake per Send");

  patchHandled(dir, 2);
  await waitFor(() => Boolean(m.child), "waiter re-armed after final ack");
  await sleep(900);
  assert.equal(sends(), before + 2, "no re-delivery of acknowledged Sends");

  await toolCall("grill_detach", { session: dir });
});

// ---- unacked-Send recovery (R5) --------------------------------------------

test("idle after a wake is held by the grace period; an aged unacked Send re-wakes exactly once", async () => {
  const dir = newSession("unacked");
  const before = sends();

  await toolCall("grill_attach", { session: dir, server: SERVER });
  const idle = () => rec.idleHandlers.forEach((h) => h());

  idle(); // idle before any Send must not wake anything
  await sleep(300);
  assert.equal(sends(), before, "idle with nothing delivered wakes nothing");

  appendSend(dir, 1);
  await waitFor(() => sends() === before + 1, "wake for Send #1");
  const m = monitorOf(dir);
  assert.equal(m.child, null, "waiting for ack");

  idle(); // idle lands while the wake is still queued: inside the grace window
  await sleep(600);
  assert.equal(sends(), before + 1, "grace period suppresses a premature re-wake");

  m.wakeAt = Date.now() - 21000; // age past REWAKE_GRACE_MS (test seam)
  idle();
  await waitFor(() => sends() === before + 2, "one bounded re-wake after grace");
  assert.match(rec.sends[sends() - 1].prompt, /never acknowledged/);

  idle(); // and never again for the same seq
  await sleep(400);
  assert.equal(sends(), before + 2, "re-wake fires once per seq");

  patchHandled(dir, 1);
  await sleep(700);
  await toolCall("grill_detach", { session: dir });
});

// ---- single-waiter lock ----------------------------------------------------

test("a live foreign lock refuses attach; a dead lock is taken over", async () => {
  const dir = newSession("locked");
  const holder = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { windowsHide: true });
  fs.writeFileSync(path.join(dir, "monitor.json"), JSON.stringify({ pid: holder.pid, at: new Date().toISOString() }));

  let r = await toolCall("grill_attach", { session: dir, server: SERVER });
  assert.equal(r.ok, false, "second chat must not start a waiter for the same session");
  assert.match(r.error, new RegExp(String(holder.pid)));

  holder.kill();
  await waitFor(
    () => {
      try {
        process.kill(holder.pid, 0);
        return false;
      } catch (e) {
        return e.code !== "EPERM";
      }
    },
    "foreign holder exits",
  );

  r = await toolCall("grill_attach", { session: dir, server: SERVER });
  assert.equal(r.ok, true, `dead lock is stale and must be taken over: ${r.error || ""}`);
  await toolCall("grill_detach", { session: dir });
  assert.ok(!fs.existsSync(path.join(dir, "monitor.json")), "detach releases the lock");
});

// ---- detach / teardown -----------------------------------------------------

test("detach kills the waiter child; onSessionEnd stops everything", async () => {
  const dir = newSession("detach");
  await toolCall("grill_attach", { session: dir, server: SERVER });
  const m = monitorOf(dir);
  assert.ok(m && m.child);
  const childPid = m.child.pid;

  let r = await toolCall("grill_detach", { session: dir });
  assert.deepEqual(r, { ok: true, stopped: true });
  assert.equal(monitorOf(dir), undefined, "monitor removed");

  await waitFor(
    () => {
      try {
        process.kill(childPid, 0);
        return false;
      } catch (e) {
        return e.code !== "EPERM";
      }
    },
    "waiter child is dead",
  );
  r = await toolCall("grill_status", { session: dir });
  assert.deepEqual(r.monitors, []);

  // onSessionEnd path (extension reload / chat close)
  await toolCall("grill_attach", { session: dir, server: SERVER });
  assert.ok(monitorOf(dir).child);
  await rec.config.hooks.onSessionEnd();
  assert.equal(__test.monitors.size, 0, "hook stops all monitors");
  assert.ok(!fs.existsSync(path.join(dir, "monitor.json")), "hook releases locks");
});

// ---- waiter failure --------------------------------------------------------

test("a failing waiter logs, wakes the agent once with recovery steps, and does not auto re-arm", async () => {
  const dir = newSession("failure");
  const fake = path.join(HOME, "fake-server.mjs");
  fs.writeFileSync(fake, "process.exit(7);\n");

  const before = sends();
  const r = await toolCall("grill_attach", { session: dir, server: fake });
  assert.equal(r.ok, true, r.error || "");

  await waitFor(() => sends() === before + 1, "one error wake");
  assert.match(rec.sends[sends() - 1].prompt, /monitor for session .* stopped: wait exited with code 7/);
  assert.match(rec.sends[sends() - 1].prompt, /listener is inactive/);

  await sleep(900);
  assert.equal(sends(), before + 1, "no re-arm, no wake loop after failure");
  const m = monitorOf(dir);
  assert.ok(m, "monitor still tracked (status must show the failure)");
  assert.equal(m.child, null);
  assert.match(m.failed, /exited with code 7/);
  assert.ok(
    rec.logs.some((l) => l.options && l.options.level === "error" && /grill-monitor/.test(l.message)),
    "failure reaches session.log",
  );

  const s = await toolCall("grill_status", { session: dir });
  assert.equal(s.monitors.length, 1);
  assert.equal(s.monitors[0].waiterAlive, false);
  assert.match(s.monitors[0].failed, /code 7/);
  assert.ok(s.monitors[0].lock && s.monitors[0].lock.pid === process.pid, "status reports the lock holder");

  await toolCall("grill_detach", { session: dir });
});

// ---- the audit's missing cheap scenarios (I5) ------------------------------

test("an exit-3 waiter re-arms silently without any wake", async () => {
  const dir = newSession("timeout-reenarm");
  const fake = path.join(HOME, "fake-timeout-server.mjs");
  fs.writeFileSync(fake, "setTimeout(() => process.exit(3), 250);\n");
  const before = sends();

  const r = await toolCall("grill_attach", { session: dir, server: fake });
  assert.equal(r.ok, true, r.error || "");
  const m = monitorOf(dir);
  const firstPid = m.child && m.child.pid;
  assert.ok(firstPid, "first waiter armed");

  await waitFor(() => m.child && m.child.pid !== firstPid, "exit 3 re-arms a fresh waiter");
  assert.equal(sends(), before, "idle timeout is silent — no wake");
  await toolCall("grill_detach", { session: dir });
});

test("nothing wakes the chat after detach", async () => {
  const dir = newSession("post-detach");
  const before = sends();
  await toolCall("grill_attach", { session: dir, server: SERVER });
  await toolCall("grill_detach", { session: dir });
  appendSend(dir, 1);
  await sleep(900);
  assert.equal(sends(), before, "detached monitor delivers nothing");
});

test("re-attach during an in-flight unacked Send does not re-deliver it", async () => {
  const dir = newSession("reattach-flight");
  const before = sends();
  await toolCall("grill_attach", { session: dir, server: SERVER });
  appendSend(dir, 1);
  await waitFor(() => sends() === before + 1, "wake for Send #1");
  assert.equal(monitorOf(dir).child, null, "unacked: no waiter");

  const r = await toolCall("grill_attach", { session: dir, server: SERVER }); // resume-style re-attach
  assert.equal(r.ok, true, r.error || "");
  assert.equal(monitorOf(dir).lastDelivered, 1, "delivered watermark carries across re-attach");

  await sleep(1300);
  assert.equal(sends(), before + 1, "the unacked Send is never re-delivered");
  patchHandled(dir, 1);
  await sleep(600);
  await toolCall("grill_detach", { session: dir });
});

test("an externally killed waiter takes the failure path: one error wake, no re-arm", async () => {
  const dir = newSession("killed-waiter");
  const before = sends();
  await toolCall("grill_attach", { session: dir, server: SERVER });
  const m = monitorOf(dir);
  const childPid = m.child && m.child.pid;
  assert.ok(childPid);

  process.kill(childPid); // external death, not our stopMonitor path
  await waitFor(() => sends() === before + 1, "one error wake");
  assert.match(rec.sends[sends() - 1].prompt, /listener is inactive/);
  await sleep(700);
  assert.equal(sends(), before + 1, "no wake loop after an external kill");
  assert.ok(m.failed, "failure recorded for grill_status");
  await toolCall("grill_detach", { session: dir });
});
