// Sound-cue contract for page.html, against a real `serve` (same harness shape as page.e2e.mjs):
//   node test/page-sound.e2e.mjs        (needs @playwright/test reachable, or PLAYWRIGHT_PKG)
// Every trigger plays exactly its cue, guards stay silent, precedence holds, mute persists.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_PKG || "@playwright/test");
const here = dirname(fileURLToPath(import.meta.url));
const SERVER = join(here, "..", "skills", "grill-with-ui", "server.mjs");
const home = mkdtempSync(join(tmpdir(), "grill-sound-home-"));
const env = { ...process.env, GRILL_HOME: home };

const { session } = JSON.parse(execFileSync(process.execPath, [SERVER, "new", "--topic", "Sound topic", "--doc", "docs/sound-design.md"], { encoding: "utf8", env, cwd: mkdtempSync(join(tmpdir(), "grill-sound-proj-")) }));
const stateFile = join(session, "state.json");
const base = JSON.parse(readFileSync(stateFile, "utf8"));
const now = new Date().toISOString();
// A session with history: an answered question carrying a thread (must stay silent on load),
// one open question to stage from, and a visual already at v2 (a later bump must cue).
const fixture = () => ({
  ...base,
  agent: { status: "waiting", since: now, handled: 0 },
  questions: [
    { id: "q1", round: 1, deps: [], title: "History question", body: "Already answered.", options: [{ k: "A", text: "First" }], rec: { option: "A", why: "Because." }, status: "answered", durable: false, updated: false, answer: { kind: "option", option: "A" }, thread: [{ who: "user", text: "Why A?", at: now }, { who: "agent", text: "A holds up.", at: now }] },
    { id: "q2", round: 1, deps: [], title: "Open question", body: "Pick one.", options: [{ k: "A", text: "Alpha" }, { k: "B", text: "Beta" }], rec: { option: "A", why: "Alpha." }, status: "open", durable: false, updated: false, thread: [] },
  ],
  visual: { kind: "diagram", version: 2, at: now, note: "v2: as it stands", stale: false, thread: [{ who: "user", text: "Old note", at: now }, { who: "agent", text: "Redrawn.", at: now }] },
});
const writeState = (s) => writeFileSync(stateFile, JSON.stringify(s, null, 2));
writeState(fixture());

const child = spawn(process.execPath, [SERVER, "serve", "--session", session], { env, stdio: ["ignore", "pipe", "inherit"] });
let buf = ""; const lines = []; const waiters = [];
child.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { lines.push(buf.slice(0, i)); buf = buf.slice(i + 1); waiters.splice(0).forEach((w) => w()); } });
const nth = (n) => new Promise((res) => { const c = () => (lines.length >= n ? res(lines[n - 1]) : waiters.push(c)); c(); });
const stop = () => new Promise((res) => { if (child.exitCode !== null) return res(); child.on("exit", res); child.kill(); });

const url = JSON.parse(await nth(1)).url;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const notFound = []; // 404 URLs: /context is the page's deliberate "is there a glossary?" probe and 404s by design
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("response", (r) => { if (r.status() === 404) notFound.push(r.url()); });
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok, extra }); if (!ok) console.log("FAIL", name, extra); };
const cues = () => page.evaluate(() => window.__grillSound.state().cues);
const soundState = () => page.evaluate(() => window.__grillSound.state());
// wait for n cues; on timeout dump the sound + session snapshot instead of throwing blind
const waitForCues = async (n, what) => {
  try { await page.waitForFunction((k) => window.__grillSound.state().cues.length === k, n); return true; }
  catch {
    const diag = { sound: await soundState(), state: await page.evaluate(() => fetch("/state").then((r) => r.json())) };
    console.log("TIMEOUT waiting for", what, JSON.stringify({ sound: diag.sound, finished: !!diag.state.finished, agent: diag.state.agent, errors }));
    return false;
  }
};
const pendingCount = () => page.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => x.startsWith("grill:"));
  if (!k) return -1;
  return (JSON.parse(localStorage.getItem(k)).pending || []).length;
});
const settle = () => page.waitForTimeout(2300); // >2 poll cycles: prove silence, not just lag

try {
  await page.goto(url);
  await page.locator(".item").first().waitFor();

  // 1. First observation baselines history: nothing on load, however rich the thread/visual.
  await settle();
  check("load is silent despite existing thread history and visual v2", (await cues()).length === 0, JSON.stringify(await cues()));
  check("mute starts off and the header button says so", (await soundState()).muted === false && (await page.locator("#sound-toggle").getAttribute("aria-pressed")) === "false");

  // 2. A send whose handling lands as ONE patch (thread reply + handled bump) — precedence
  //    picks thread-reply over send-ack; exactly one cue.
  await page.locator(".opt.rec").first().click();
  await page.locator("#send").click();
  await page.waitForFunction(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("grill:")); return k && (JSON.parse(localStorage.getItem(k)).pending || []).length === 1; });
  const afterSend = fixture();
  afterSend.agent = { status: "waiting", since: now, handled: 1 };
  afterSend.questions[1].thread = [{ who: "user", text: "Why alpha?", at: now }, { who: "agent", text: "Alpha balances both.", at: now }];
  writeState(afterSend);
  await waitForCues(1, "thread-reply cue");
  check("combined ack+thread patch plays exactly the thread-reply cue", (await cues())[0] === "thread-reply", JSON.stringify(await cues()));

  // 3. A bare visual version bump (draw landed with no handled change) plays visual-landed.
  const visualBump = fixture();
  visualBump.agent = { status: "waiting", since: now, handled: 1 };
  visualBump.questions[1].thread = afterSend.questions[1].thread;
  visualBump.visual = { ...visualBump.visual, version: 3, at: now, note: "v3: redrawn" };
  writeState(visualBump);
  await waitForCues(2, "visual-landed cue");
  check("visual version bump plays the visual-landed cue", (await cues())[1] === "visual-landed", JSON.stringify(await cues()));

  // 4. Muted: a real send + ack plays nothing; the toggle persists across reload.
  await page.locator("#sound-toggle").click();
  check("mute toggle flips aria-pressed", (await page.locator("#sound-toggle").getAttribute("aria-pressed")) === "true");
  await page.locator(".opt.rec").first().click();
  await page.locator("#send").click();
  await page.waitForFunction(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("grill:")); return k && (JSON.parse(localStorage.getItem(k)).pending || []).length === 1; });
  const mutedAck = { ...visualBump, agent: { status: "waiting", since: now, handled: 2 } };
  writeState(mutedAck);
  await settle();
  check("muted send+ack stays silent", (await cues()).length === 2, JSON.stringify(await cues()));
  await page.reload();
  await page.locator(".item").first().waitFor();
  check("mute survives a reload (global key)", (await soundState()).muted === true && (await page.locator("#sound-toggle").getAttribute("aria-pressed")) === "true");
  await page.locator("#sound-toggle").click(); // unmute for the finish
  check("unmuting restores sound", (await soundState()).muted === false);

  // 5. The finish edge plays grill-finished once — and a later state change does not repeat
  //    it. The cue log is in-memory, so the reload above reset it: post-reload the finish is
  //    cue #1 of this page's life.
  const finished = { ...mutedAck, finished: { doc: "docs/sound-design.md", at: now } };
  writeState(finished);
  await waitForCues(1, "grill-finished cue");
  check("finish plays the grill-finished cue", (await cues())[0] === "grill-finished", JSON.stringify(await cues()));
  const finishedAgain = { ...finished, note: "every branch is settled; Finish is the next step." };
  writeState(finishedAgain);
  await settle();
  check("state changes after finish never repeat the cue", (await cues()).length === 1, JSON.stringify(await cues()));

  // The fixture declares a visual without a visual.html on disk — /visual 404s by design,
  // exactly like the glossary probe; any other missing asset still fails with its address.
  const isProbe = (u) => { try { return ["/context", "/visual"].includes(new URL(u).pathname); } catch { return false; } };
  const real = errors
    .filter((e) => !e.includes("404 (Not Found)"))
    .concat(notFound.filter((u) => !isProbe(u)).map((u) => `404 ${u}`));
  check("no console errors (besides the deliberate glossary probe)", real.length === 0, real.join(" | "));
} finally {
  await browser.close();
  await stop();
}

const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} sound checks passed`);
if (failed.length) { console.error(failed.map((f) => `FAIL ${f.name} ${f.extra}`).join("\n")); process.exit(1); }
