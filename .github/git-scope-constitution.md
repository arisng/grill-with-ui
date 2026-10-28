# Commit Scope Constitution

Last Updated: 2026-10-28

## Purpose

This constitution defines the approved scopes for atomic commits in
grill-with-ui, ensuring consistency and clarity in commit history. It
governs Tier 3 scopes (workspace-specific); commit types come from
Conventional Commits (Tier 1) and the extended `agent`/`copilot`/
`devtool`/`codex` types (Tier 2).

## Scope Naming Conventions

- Kebab-case, lowercase, singular, 1-3 words (`design`, `server`,
  `copilot instruction` → `instruction`).
- Domain/module-based; no verbs, no file names, no `misc`/`other`.
- For Tier 2 types (`agent`, `copilot`, `devtool`, `codex`) the scope
  is the artifact **category**, never the instance: `agent(skill)`,
  not `agent(pdf)`. The subject names the instance.
- Exactly one scope per commit; mention a secondary area in the
  subject if needed.

## Approved Scopes by Commit Type

### `feat`

- `server`: `server.mjs` — the HTTP server and CLI (newserve, patch,
  wait, url behavior and validation).
- `page`: `page.html` — the browser page's rendering and interaction.
- `sampler`: `sound-sampler.html` — the standalone completion-sound
  taste page.

### `fix`

- `server`: correctness fixes in `server.mjs`.
- `page`: correctness fixes in `page.html`.

### `docs`

- `skill`: prose instructions for running the skill (`SKILL.md`
  usage sections) when not changing the prompt contract itself.
- `design`: dated decision records under `docs/` (`design.md`,
  `visualize-design.md`).
- `readme`: the root `README.md`.
- `constitution`: `.github/git-scope-constitution.md` and
  `.github/git-scope-inventory.md`.

### `test`

- `server`: `test/*` — unit and e2e suites (server contract, page
  flows).
- `eval`: `evals/*` — the waza behavioural evaluation specs for the
  skill (one task per contract in `SKILL.md`, plus the routing
  triggers).

### `agent` (Tier 2 — skill assets)

- `skill`: the skill's prompt contract and companion briefs:
  `SKILL.md`, `visual-brief.md`, `domain-brief.md`, `adr-template.md`.

### `copilot` (Tier 2 — GitHub Copilot assets)

- `extension`: Copilot extension sources that ship with the repository
  (`.github/extensions/<name>/**` — the entry `extension.mjs`, its manifest,
  and its tests).
- `instruction`: repository Copilot instructions
  (`.github/copilot-instructions.md`).
- `mcp`: MCP server configuration (`.mcp.json` at the repository root; formerly
  `.vscode/mcp.json`).
- `memory`: `.github/copilot-memories.jsonl` — the durable repository
  facts the agent store keeps, one JSON record per line.
- `skill`: project-scoped agent skills that ship with the repository —
  `.github/skills/<name>/**`. Distinct from the `agent` type's `skill`
  scope, which covers the shipped skill's own prompt contract
  (`SKILL.md`, the briefs) that users install and run.

### `devtool` (Tier 2 — developer tooling)

- `config`: `.waza.yaml` — the project configuration for the waza CLI
  (token budgets per file).
- `taskfile`: `Taskfile.yml` — the taskfile.dev wrappers over the
  repository's own commands.
- `taste`: `taste.mjs` — the sampler launcher and the SOUND_CUES
  drift check against `page.html`.

### `codex` (Tier 2 — reserved)

- No repository files currently map here. Proposed on demand for
  `.codex/*`.

### Universal types without entries (`style`, `perf`, `build`, `ci`,
`revert`)

- Scope is the affected module; propose an amendment when first used.

### `chore`

- `repo`: repository housekeeping that touches no product file —
  `.gitignore`, `.gitattributes`.

### Legacy / external types

- `no-mistakes(document)`, `no-mistakes(review)`: emitted by external
  review tooling in older history. Accepted as-is; do not use for
  hand-authored commits.

## Scope Selection Guidelines

1. Map the file path to a type first (Tier 2 wins over Tier 1).
2. Pick the scope from that type's approved list; the inventory
   (`.github/git-scope-inventory.md`) shows historical usage.
3. One logical change per commit; commit order keeps every state
   buildable (server contract before its tests, configs before docs
   that reference them).
4. If no scope fits, propose an amendment before committing.

## Amendment Process

1. Analyze recent commits and new structure (see workflow in the
   scope-constitution skill).
2. Add or refine the scope with a clear, non-overlapping definition.
3. Record the change under Amendment History and bump Last Updated.

## Amendment History

### 2026-10-28 - Amendment #8

**Changes:**
- Repointed the `copilot`/`mcp` scope from `.vscode/mcp.json` to the root
  `.mcp.json` (cross-client workspace MCP format).

**Rationale:**
The workspace's MCP configuration moved to the root `.mcp.json` so non-VS Code
clients discover the same Playwright server; the scope's meaning (MCP server
configuration) is unchanged, only its path.

**Migration Notes:**
No history rewriting; the covering commit moves the file in the same series.

### 2026-10-28 - Amendment #7

**Changes:**
- Added the `plugin` scope under the `copilot` type, for the Copilot plugin
  manifest that bundles the skill and its extensions for one-command install
  (`plugin.json` at the repository root, plus any plugin packaging metadata).

**Rationale:**
The fork ships a root `plugin.json` so `copilot plugin install
arisng/grill-with-ui` installs the skill and the grill-monitor extension
together. The manifest is Copilot distribution metadata — not an extension
source, an instruction, an MCP config, a memory file, or a project skill — so
no existing scope fit.

**Migration Notes:**
No history rewriting; the scope is new, so no earlier commit is affected.

### 2026-10-27 - Amendment #6

**Changes:**
- Added the `extension` scope under the `copilot` type, for Copilot extension
  sources that ship with the repository (`.github/extensions/<name>/**` — the
  entry `extension.mjs`, its manifest, and its tests).

**Rationale:**
The grill-monitor extension (`.github/extensions/grill-monitor/`) is a Copilot
asset that ships beside the skill but is neither a repository instruction, an
MCP configuration, a memory file, nor a project skill, so no existing `copilot`
scope fit. Tier-2 scopes name the artifact category, so the scope is
`extension` and the subject names the instance.

**Migration Notes:**
No history rewriting; the scope is new, so no earlier commit is affected.

### 2026-10-23 - Amendment #5

**Changes:**
- Added the `sampler` scope under the `feat` type, for the standalone
  completion-sound taste page (`sound-sampler.html`).
- Added the `taste` scope under the `devtool` type, for the sampler
  launcher and cue-table drift check (`taste.mjs`).

No history rewriting; both files are new.

### 2026-10-22 - Amendment #4

**Changes:**
- Added the `skill` scope under the `copilot` type, for project-scoped agent
  skills that ship in the repository (`.github/skills/<name>/**`).
- Clarified the boundary between that scope and the `agent` type's `skill`
  scope, which covers the shipped skill's own prompt contract and briefs.
- Added the `taskfile` scope under the `devtool` type, for `Taskfile.yml`.
- Added the `memory` scope under the `copilot` type, for
  `.github/copilot-memories.jsonl`.

**Rationale:**
The `fork-sync` skill (`.github/skills/fork-sync/`) keeps this fork in step
with its upstreams. It is a repository tool, not part of the skill users
install and run, so `agent(skill)` would have claimed it wrongly. The
Taskfile already had a scope in the historical inventory, but the
constitution never granted it.

**Migration Notes:**
No history rewriting; the scopes are new, so no earlier commit is affected.

### 2026-10-22 - Amendment #3

**Changes:**
- Added the `eval` scope under `test` for `evals/*`, the waza behavioural
  evaluation suite for the skill.
- Split the reserved `devtool`/`codex` section: `devtool` now holds the
  `config` scope for `.waza.yaml`; `codex` stays reserved.
- Added the `chore` scope `repo` for `.gitignore`.

**Rationale:**
The evaluation suite, its project configuration, and the ignore rule for
the run artifacts are three new file kinds with no approved scope, and
the constitution asks for an amendment before a file that fits no scope
is committed. The `chore` type had no entry at all, so the ignore rule
needed one.

**Migration Notes:**
No history rewriting; the scopes grow from the previous set.

### 2026-10-21 - Amendment #2

**Changes:**
- Extended the `agent`/`skill` scope to `adr-template.md`, the ADR shape that
  `server.mjs adr` scaffolds at Finish.

**Rationale:**
The ADR template is a skill asset the agent writes verbatim, so it belongs beside
`domain-brief.md`. The scope named only the prompt and the two briefs, and the
constitution asks for an amendment before a file that fits no scope is committed.

**Migration Notes:**
No history rewriting; the scope grows from three files to four.

### 2026-09-23 - Amendment #1

**Changes:**
- Initial constitution: scopes derived from git history
  (`docs(skill)`, `fix(page)`, `test(server)`), repository structure
  (root skill assets, `server.mjs`/`page.html`, `docs/` records,
  `test/`), and Tier 2 category mappings.
- Published history inventory to `.github/git-scope-inventory.md`.

**Rationale:**
The domain-modeling-mode branch needed validated scopes for atomic
commits; the repo had no constitution.

**Migration Notes:**
Older commits keep their historical forms (including scope-less
subjects and `no-mistakes`); no history rewriting.
