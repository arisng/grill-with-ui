# Commit Scope Constitution

Last Updated: 2026-09-23

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

### `agent` (Tier 2 — skill assets)

- `skill`: the skill's prompt contract and companion briefs:
  `SKILL.md`, `visual-brief.md`, `domain-brief.md`.

### `copilot` (Tier 2 — GitHub Copilot assets)

- `instruction`: repository Copilot instructions
  (`.github/copilot-instructions.md`).
- `mcp`: MCP server configuration (`.vscode/mcp.json`).

### `devtool` / `codex` (Tier 2 — reserved)

- No repository files currently map here. Proposed on demand for
  `scripts/*`, `.vscode/settings.json`, `.vscode/tasks.json`,
  `.codex/*`.

### Universal types without entries (`style`, `perf`, `build`, `ci`,
`chore`, `revert`)

- Scope is the affected module; propose an amendment when first used.

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
