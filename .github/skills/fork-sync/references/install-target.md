# Source 3 — the installed copies

The fork's code is not what runs. Two **installed copies** are, plus a listener:

| What | Where | Version marker | Refresh |
|------|-------|----------------|---------|
| The grill-with-ui plugin — the skill the agent loads | `~/.copilot/installed-plugins/grill-with-ui/grill-with-ui/` | `plugin.json` `version` | `copilot plugin marketplace update grill-with-ui && copilot plugin update grill-with-ui` |
| This skill (fork-sync) | `~/.agents/skills/fork-sync/` | `SKILL.md` `metadata.version` | Re-copy `.github/skills/fork-sync/` over it |
| The grill-monitor listener | `~/.copilot/extensions/grill-monitor/` | (files, not a version) | `task ext-install` from a clone |

A plugin cannot install SDK extensions, so the listener is always a separate install —
the README's upgrade section carries the full story. A fork change that is never
refreshed into these copies is a change nobody has.

## Why version equality is the freshness signal

Neither copy is a git checkout and neither is commit-tracked: the plugin is a plain
copy of the repo, and fork-sync was copied by hand. The report therefore compares the
installed version against the repo's and prints `current`, `BEHIND` (with the remedy
printed next to it), or `NOT INSTALLED`.

A commit-hash comparison would be the wrong signal here: any commit, even a README-only
change, moves a hash, and a README-only change needs no reinstall. The version tracks
the *contract* — exactly what a stale install would be missing.

**Push before you refresh.** The plugin installs from the remote, so after merging a
sync you must push `develop` first: an unpushed merge is not installable, and the
update command would fetch the old tip.

## Version markers

| Marker | Where | Rule |
|--------|-------|------|
| `plugin.json` `version` | repo root and the installed plugin | Kept equal to the skill's `metadata.version` (0.10.0 today). Bump both with the contract change they describe; `copilot(plugin)` when only the manifest changes |
| `skills/grill-with-ui/SKILL.md` `metadata.version` | repo and the installed plugin | The shipped skill's contract version |
| fork-sync's `metadata.version` | `.github/skills/fork-sync/SKILL.md` and `~/.agents/skills/fork-sync/SKILL.md` (0.4.2) | Bump with any change to this skill |

What counts as a change to the shipped package:

| Change | Bump |
|--------|------|
| A contract change — the `state.json`/send schemas, the frontmatter `description`, the listening-mode rules | minor (or patch for a fix) |
| A new bundled file users receive — a brief, a template, a bundled skill | minor |
| A fix that does not change any contract | patch |
| A change that only touches repository tooling, not the shipped package | none |

A version bump without a shipped change is noise; a shipped change without a version
bump is a silent stale install. Keep them paired.

| Signal | Meaning | Fix |
|--------|---------|-----|
| Installed < repo | The copy predates a shipped change | plugin: the update command above; fork-sync: re-copy |
| Installed = repo | Current — the agent runs what the repo ships | — |
| Installed > repo | The copy came from a different branch | Check which checkout it was copied from |

## Legacy: the skills lock

`~/.agents/.skill-lock.json` used to track `grill-with-ui` as a skills-CLI install
(`skillPath: SKILL.md`, a commit sha in `skillFolderHash`). The plugin era ended that:
the entry is obsolete, the README's upgrade section covers deleting it, and the report
no longer reads the lock. Other skills in the lock are unaffected —
`npx skills update -g -y` still refreshes those.

## Other agents' copies

Claude Code and other agents that do not run the plugin keep their own route: a
symlink, junction, or copy of `skills/grill-with-ui` (the README documents the
symlink route). Those copies do not update themselves — after a sync, re-point or
re-pull them.

A symlink ties the running skill to whatever branch its clone is on, including an
in-progress sync branch, which would put a half-merged skill into a live grill.
Prefer a copy for anything that runs during a sync, and keep the clone's working
branch clean while a sync is in flight.