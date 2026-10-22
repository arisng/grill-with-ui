# Source 3 — the installed copy: `~/.agents/skills/grill-with-ui`

## Why it is a source

The fork's code is not what runs. The **installed copy** is: a snapshot of this repo
installed into the agent's skills directory, and it is the one the agent loads when a
grill starts. A fork change that is never reinstalled is a change nobody has.

The install is tracked in `~/.agents/.skill-lock.json`:

```json
"grill-with-ui": {
  "source": "arisng/grill-with-ui",
  "sourceType": "github",
  "sourceUrl": "https://github.com/arisng/grill-with-ui.git",
  "ref": "develop",
  "skillPath": "SKILL.md",
  "skillFolderHash": "2b5b6b56749eeee40264c61bcfe4233a28bdc20a",
  "installedAt": "...",
  "updatedAt": "..."
}
```

`ref` is the branch the install tracks, and `skillFolderHash` is the commit that was
installed. Together they say exactly what is installed.

## Refreshing

```sh
npx skills update -g -y
```

`npx skills update` re-reads the recorded `source` and `ref` from the lock file, so it
pulls the fork's `develop` — the same branch the sync work lands on. That is why the
lock's `ref` must stay `develop`: pointing it at `main` would install a month-old copy.

## Two different questions about freshness

**Is the install current with its source?** That is what the lock answers: compare
`skillFolderHash` with the tip of `sourceUrl` at `ref`.

```sh
git ls-remote https://github.com/arisng/grill-with-ui.git refs/heads/develop
```

The report does this and prints `current with its source` or `BEHIND its source`. Only
`BEHIND` needs a refresh.

**Is the fork itself published?** The lock's `ref` is a *remote* branch, so after
merging a sync you must **push** before updating. Until then the report says
`the source tip is behind local HEAD — push the fork, then update again`.

Do not confuse these two. An install that is behind local HEAD but matches the source
tip is **not** stale — the local commits simply are not published yet.

**Is the installed skill the version you think?** That is the `metadata.version` check,
and it is a separate signal from the commit hash:

```sh
grep -n "version:" ~/.agents/skills/grill-with-ui/SKILL.md
```

The `metadata.version` in the installed `SKILL.md` must match the repo's. If it does
not, the update did not run, or it ran before the sync was merged.

| Signal | Meaning | Fix |
|--------|---------|-----|
| Installed commit ≠ source tip | The install is behind its source | `npx skills update -g -y` |
| Installed commit = source tip, but ≠ local HEAD | The fork's commits are not pushed | Push the fork, then update |
| Installed `metadata.version` < repo's | The install predates a shipped change | `npx skills update -g -y` |
| Installed `metadata.version` > repo's | The install came from a different branch | Check the lock's `ref` |

A commit-hash difference does **not** imply a missing version bump: any commit, even a
README-only change, moves the hash. The version tracks the *contract*; the hash tracks
the *content*.

## The `metadata.version` marker

`SKILL.md`'s frontmatter carries `metadata.version` (currently `0.5.0` in the fork). It is
the only version marker in the project — there is no CHANGELOG, and upstream publishes no
releases or tags. Bump it when the **shipped package** changes, and read it to confirm an
install is current.

What counts as a change to the shipped package:

| Change | Bump |
|--------|------|
| A contract change — the `state.json`/send schemas, the frontmatter `description`, the listening-mode rules | minor (or patch for a fix) |
| A new bundled file users receive — a brief, a template, a bundled skill | minor |
| A fix that does not change any contract | patch |
| A change that only touches repository tooling, not the shipped package | none |

A version bump without a shipped change is noise; a shipped change without a version
bump is a silent stale install. Keep them paired.

## Other agents' copies

The skills ecosystem installs the same folder into several agents' directories
(`~/.claude/skills/`, `~/.agents/skills/`, `~/.cursor/skills/`, and project-level
`.github/skills/`, `.claude/skills/`, `.agents/skills/`). The lock file tracks one
install; a second agent directory may hold a separate copy.

Check what is installed where:

```sh
npx skills list
```

Refresh them all in one go, or per agent:

```sh
npx skills update -g -y
```

## Other install routes

Agents that do not use the skills CLI install the folder by hand — a symlink, a copy, or
a git clone. The README documents the symlink route for Claude Code, Codex, Gemini CLI,
Cursor, and Copilot. For those, the update path is `git pull` in the clone, plus a manual
copy if the install is a copy rather than a symlink.

Check which you have:

```sh
ls -l ~/.agents/skills/grill-with-ui    # '->' means symlink
```

On Windows, a directory junction shows the same way. A symlinked install is simpler but
ties the running skill to whatever branch the clone is on — including an in-progress sync
branch, which would put a half-merged skill into a live grill. Prefer a copy for the
installed path, and keep the clone's working branch clean while a sync is in flight.

## A note on `skillFolderHash` and other source types

The lock's `skillFolderHash` is a **commit sha** for a GitHub install, because the
install came from a branch. For other `sourceType` values it can be a tree hash of the
folder's content instead. The report compares the hash with a commit, so it only draws
a conclusion for GitHub-sourced installs; for anything else it reports the state as
`unknown` rather than guessing.