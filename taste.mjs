// Opens the completion-sound sampler (sound-sampler.html) in the default browser after
// checking its SOUND_CUES table against page.html — retune a tone in page.html (it plays
// the real cues), copy the table into the sampler, then run `task taste` to taste it.
// `node taste.mjs --check` (task taste:check) gates drift without opening a browser:
// exit 0 = in sync, 1 = drift, 2 = a table is missing. No dependencies; plain Node.
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const files = ["page.html", "sound-sampler.html"].map((f) => join(here, f));
const cues = (path) => {
  const m = readFileSync(path, "utf8").match(/const\s+SOUND_CUES\s*=\s*\{[\s\S]*?\};/);
  return m ? m[0].replace(/\s+/g, " ").trim() : null;
};
const [page, sampler] = files.map(cues);
if (!page || !sampler) {
  console.error(`missing SOUND_CUES table in ${!page ? files[0] : files[1]}`);
  process.exit(2);
}
const check = process.argv.includes("--check");
if (page !== sampler) {
  console.error("SOUND_CUES drift: sound-sampler.html no longer matches page.html.");
  console.error("Edit page.html first (it plays the real cues), copy the table into the sampler, re-run.");
  if (check) process.exit(1);
} else {
  console.log("SOUND_CUES in sync with page.html");
}
if (check) process.exit(0);
const file = files[1];
const cmd = process.platform === "win32" ? { c: "cmd", a: ["/c", "start", "", file] }
  : process.platform === "darwin" ? { c: "open", a: [file] }
  : { c: "xdg-open", a: [file] };
spawn(cmd.c, cmd.a, { stdio: "ignore", detached: true })
  .on("error", (e) => { console.error(`could not open ${file}: ${e.message}`); process.exit(1); })
  .unref();
