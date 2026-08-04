# Test Evidence: node-npm-ci-hardening

- Overall Result: PASS
- Implementation Base: `bbcdd3adbcfd6a50f552e86694acb32a687d54a6`
- Implementation Head: `0242d42f0acecde2abf24ae5323282f2093b8051`
- Verified Target: implementation diff committed as `0242d42f0acecde2abf24ae5323282f2093b8051`
- Environment: Windows 11, WSL2 Ubuntu, Node.js `22.22.3`, npm `10.9.8`, `core.autocrlf=true`
- Human decision: after the unavailable lint/test scripts and remaining dev-only audit findings were disclosed,
  the user explicitly directed commit and direct push to `origin/main` on 2026-08-04.

## Preflight

- Repository: `C:\Users\Sales01\Documents\AI-Council-Chat`
- Branch / upstream: `codex/council-chat-phase3-defect-fixes` / `origin/codex/council-chat-phase3-defect-fixes`
- Base HEAD: `bbcdd3adbcfd6a50f552e86694acb32a687d54a6`
- Preserved pre-existing untracked paths:
  - `docs/handoff_history/COWORK_SESSION_HANDOFF_council_chat_review.md`
  - `docs/handoff_history/HANDOFF_PROMPT_council_chat_fixes.md`
  - `docs/handoff_history/HANDOFF_siftline_council_phases_1to3.md`
- Local baseline: Node.js `v24.12.0`, npm `11.6.2`.
- Latest successful GitHub Actions run inspected: `26903150125` (`2026-06-03`). Windows and macOS both resolved Node.js `22.22.3`; the workflow did not print the npm version.
- Official Node.js `22.22.3` archives for Windows and Linux were inspected/executed and contain npm `10.9.8`.

## Verification

| Timestamp UTC | Target | Command | Platform | Exit | Result | Notes |
|---|---|---|---|---:|---|---|
| 2026-08-04T20:15:48Z | working diff | `npx --yes npm@10.9.8 install --package-lock-only --ignore-scripts` | Windows, local Node 24 | 0 | PASS | Lockfile regenerated with exact npm; expected engine warning because the host Node is outside the approved range. |
| 2026-08-04T20:15:48Z | working diff | official Node `22.22.3` / npm `10.9.8`: `npm ci` | Windows x64 | 0 | PASS | 458 packages installed; no EUSAGE, Missing, or Invalid failure. |
| 2026-08-04T20:15:48Z | working diff | `npm ls --all` | Windows x64 | 0 | PASS | `problemCount=0`; no Missing/Invalid entries. |
| 2026-08-04T20:15:48Z | working diff | dependency API smoke | Windows x64 | 0 | PASS | `marked` exported a function; SheetJS `0.20.3` created a workbook and worksheet. |
| 2026-08-04T20:15:48Z | working diff | `npx tsc --noEmit` | Windows x64 | 0 | PASS | Canonical project typecheck. |
| 2026-08-04T20:15:48Z | working diff | `npm run build` | Windows x64 | 0 | PASS | Vite transforms: renderer 50, main 9, preload 1, spoof preload 1. |
| 2026-08-04T20:15:48Z | clean archived checkout + task files | `npm ci` | WSL2 Linux x64 | 0 | PASS | Exact Node/npm; 459 packages installed from the same Windows-regenerated lockfile. |
| 2026-08-04T20:15:48Z | clean archived checkout + task files | `npm ls --all` | WSL2 Linux x64 | 0 | PASS | No dependency-tree problems. |
| 2026-08-04T20:15:48Z | clean archived checkout + task files | `npm audit --omit=dev` | WSL2 Linux x64 | 0 | PASS | `0 vulnerabilities`. |
| 2026-08-04T20:15:48Z | clean archived checkout + task files | `npx tsc --noEmit` | WSL2 Linux x64 | 0 | PASS | Cross-platform typecheck. |
| 2026-08-04T20:15:48Z | clean archived checkout + task files | `npm run build` | WSL2 Linux x64 | 0 | PASS | Same transform topology as Windows. |
| 2026-08-04T20:15:48Z | working diff | `npx --yes npm@10.9.8 audit --omit=dev` | Windows | 0 | PASS | Production audit: 0 vulnerabilities. |
| 2026-08-04T20:15:48Z | working diff | `npx --yes npm@10.9.8 audit --json` | Windows | 1 | EXPECTED_NONZERO | Dev-inclusive audit: 21 vulnerabilities (2 low, 3 moderate, 14 high, 2 critical). |
| 2026-08-04T20:15:48Z | task paths | YAML parse + 40-character action SHA validation | Windows | 0 | PASS | 10 action references parse and are pinned to full commits with release comments. |
| 2026-08-04T20:15:48Z | task paths | `git diff --check -- .github/workflows/build.yml package.json package-lock.json` plus `.nvmrc` whitespace check | Windows | 0 | PASS | No actionable whitespace error. |
| 2026-08-04T20:15:48Z | added task lines | secret/PII pattern scan | Windows | 0 | PASS | 8 pattern classes, 0 matches. |

## Dependency and Lockfile Results

- Production vulnerabilities removed:
  - `marked` `18.0.0` to `18.0.2` (MIT).
  - `xlsx` `0.18.5` to official SheetJS CDN tarball `0.20.3` (Apache-2.0).
  - `@xmldom/xmldom` `0.8.12` to `0.8.13` through an exact override (MIT).
  - `fast-uri` `3.1.0` to `3.1.5` through an exact override (BSD-3-Clause).
- No surviving dependency changed license.
- The new SheetJS package no longer depends on seven Apache-2.0 helper packages: `adler-32`, `cfb`, `codepage`, `frac`, `ssf`, `wmf`, and `word`.
- Lockfile version remains `3`; package entries changed from 534 to 527.
- The lock contains 61 OS/CPU-specific optional entries, including complete `@esbuild/*`, `@napi-rs/canvas-*`, and `@rollup/*` families. This project has no `@emnapi/*`, `@img/*`, or `@next/swc-*` dependency.

## Not Available / Residual Risk

- `npm run lint`: SKIPPED_WITH_REASON because the repository has no lint script and the project validation policy marks lint unavailable.
- `npm test`: SKIPPED_WITH_REASON because the repository has no test script and the project validation policy marks unit/integration tests unavailable.
- The dev-inclusive audit still reports 21 findings. The direct dev findings require major upgrades (`electron-builder` 24 to 26 and Vite 5 to 8), which are outside this task's minimum production-security scope and require separate approval/compatibility work.
- Existing deprecation warnings remain in dev/packaging transitive dependencies (`inflight`, `glob`, `boolean`, and `tar`).
- Vite 5 emits its existing CJS Node API deprecation warning during build.
- The updated release workflow was parsed and locally modeled but cannot be executed without a tag or manual GitHub workflow dispatch, both outside current authorization.
- Two failed WSL harness invocations were caused by local shell quoting before npm started; both exact `/tmp/ai-council-ci-*` directories were verified and removed. The corrected clean Linux run passed.
