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

`ref: develop` and `skillFolderHash` are the commit that was installed. That hash is
what the sync report compares against `HEAD` to decide whether the installed copy is
stale.

## Refreshing

```sh
npx skills update -g -y
```

Then confirm the hash moved:

```sh
node -e "const l=require(process.env.USERPROFILE+'/.agents/.skill-lock.json');
console.log(l.skills['grill-with-ui'].skillFolderHash)"
```

`npx skills update` re-reads the recorded `source` and `ref` from the lock file, so it
pulls the fork's `develop` — the same branch the sync work lands on. That is why the
lock's `ref` must stay `develop`: pointing it at `main` would install a month-old copy.

## Verifying the install landed

```sh
grep -n "version:" ~/.agents/skills/grill-with-ui/SKILL.md
```

The `metadata.version` in the installed `SKILL.md` must match the repo's. If it does not,
the update did not run, or it ran before the sync was merged.

## The `metadata.version` marker

`SKILL.md`'s frontmatter carries `metadata.version` (currently `0.4.2` in the fork). It is
the only version marker in the project — there is no CHANGELOG, and upstream publishes no
releases or tags. Bump it when the contract changes, and read it to confirm an install is
current:

| Situation | Meaning |
|-----------|---------|
| Installed version < repo version | The install is behind; run `npx skills update -g -y` |
| Installed version > repo version | The install came from a different branch; check the lock's `ref` |
| Versions equal but hashes differ | A commit landed without a version bump — fix the bump |

A version bump without a contract change is noise; a contract change without a version
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

If the repo is installed as a **symlink** rather than a copy, the refresh is automatic —
`git pull` in the clone is the whole update path, and no lock refresh is needed. Check
which you have:

```sh
ls -l ~/.agents/skills/grill-with-ui    # '->' means symlink
```

On Windows, a directory junction shows the same way. A symlinked install is simpler but
ties the running skill to whatever branch the clone is on — including an in-progress sync
branch, which would put a half-merged skill into a live grill. Prefer a copy for the
installed path, and keep the clone's working branch clean while a sync is in flight.

## Other install routes

Agents that do not use the skills CLI install the folder by hand — a symlink, a copy, or
a git clone. The README documents the symlink route for Claude Code, Codex, Gemini CLI,
Cursor, and Copilot. For those, the update path is `git pull` in the clone, plus a manual
copy if the install is a copy rather than a symlink.
