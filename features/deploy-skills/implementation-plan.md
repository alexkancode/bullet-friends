# Deploy Skills — Implementation Plan

Alias: `deploy-skills`

## Changes

- `packages/server/src/server.ts` — `/health` returns
  `{ ok: true, commit }` with `commit` from `COMMIT_SHA` (or `unknown`).
- `packages/client/index.html` — `<meta name="commit"
  content="%VITE_COMMIT_SHA%">`; Vite substitutes the env var statically so
  curl can read it from the deployed page.
- `.github/workflows/ci.yml` — build env gains
  `VITE_COMMIT_SHA: ${{ github.sha }}`; the Railway deploy job sets
  `COMMIT_SHA` before `railway up`.
- `.claude/skills/deploy-bullet-friends/SKILL.md` + `deploy.mjs` — the
  pipeline: refuse dirty trees or non-main branches, run the full gate,
  push, poll the CI run for HEAD to conclusion, `railway variables --set
  COMMIT_SHA`, `railway up`, poll `/health` until it reports HEAD, then
  spawn the verification script as the final word.
- `.claude/skills/deploy-bullet-friends-verification/SKILL.md` — code-first
  instructions: run `verify.mjs`, read the verdict, exit code is the truth.
- `.claude/skills/deploy-bullet-friends-verification/verify.mjs` — no-dep
  Node script: resolves HEAD and `origin/main` (via `git ls-remote`), asks
  `gh` for the CI conclusion of HEAD, fetches the live page's meta commit
  and the live `/health` commit, prints one PASS/FAIL line per check and a
  final verdict; exit 1 on any failure. Manual-deploy hint printed when the
  server commit trails (set `COMMIT_SHA` then `railway up`).

## Testing (TDD order)

1. Server health test updated first: asserts `ok` plus a `commit` string,
   and that `COMMIT_SHA` env flows through (spawned with the env set).
2. The script is its own integration test: validated by running it against
   prod in both states — before the server var exists (expected FAIL naming
   the server) and after stamping (expected all-PASS).

## Ringer Review (pre-PR checklist)

- Utility placement: verification lives entirely inside the skill folder;
  app changes are one line each at the natural seams. PASS.
- Inline styles: none involved. PASS.
- Duplication: the script reuses `gh`/`git` rather than reimplementing
  auth; health shape extends the existing endpoint. PASS.
- Testable: health covered by integration test; script pure-parses its
  inputs from subprocess/file boundaries. PASS.
- Single purpose: one check per function in the script. PASS.
- Comments: none. PASS.
- Tests: health suite in CI; the skill validated live in both states. PASS.
