# Test Evidence: Electron Typecheck and Surfaced Defect Fixes

- Overall Result: **BLOCKED** — automated/code/build/Saved Session/Chat checks pass, but AC-4's user-operated Kimi logout → login transition was not performed.
- Implementation Base: `4a95621c84e43faa6ada6e4f507631443d759975`
- Implementation Head: `9c5bf90c14606853551bf7e0b15dd01cf3783b31` — `fix(electron): enable strict typecheck coverage`
- Verified Target: `9c5bf90c14606853551bf7e0b15dd01cf3783b31`
- Environment: Windows NT 10.0.26200.0; Node v24.12.0; npm 11.6.2; TypeScript 5.9.3; Electron 41.2.0; Vite 5.4.21; `core.autocrlf=true` from system Git config.
- Data handling: Cookie values and real reply bodies were not written to this file or Git. Authentication evidence contains only boolean status and cookie names/domains/flags. Saved Session fixtures were synthetic and isolated.

## Command Evidence

| Timestamp UTC | Target | Command | Exit | Duration | Result | AC IDs | Actual output summary |
|---|---|---|---:|---:|---|---|---|
| 2026-08-03T16:47:15Z | planning base `0363a6e` | Compare the versioned pre-removal main/renderer provider and default arrays | 0 | 0.7s | PASS | AC-13 | `AI_NAMES_EQUAL=True`, order `chatgpt, claude, deepseek, gemini, grok, kimi, perplexity`; `DEFAULTS_EQUAL=True`, defaults `chatgpt, claude, gemini`. |
| 2026-08-03 BUILD S1 | working diff | Electron-inclusive `npx tsc --noEmit` immediately after canonical imports | 2 (expected baseline) | 4.18s | PASS | AC-2, AC-9 | Exactly 25 residual diagnostics: TS18048 x20, TS18047 x2, TS2345 x1, TS2741 x1, TS7006 x1. This exactly matched the approved S1 prediction. |
| 2026-08-03T16:45:11Z | `9c5bf90` content | `npx tsc --noEmit` | 0 | 4.664s | PASS | AC-1, AC-8, AC-9 | No diagnostics; root include is `src` plus `electron`. |
| 2026-08-03T16:45:11Z | `9c5bf90` content | Bundle and execute `scripts/verify-electron-phase2.ts` | 0 / 0 | 1.503s | PASS | AC-2, AC-3, AC-5, AC-8, AC-13 | 36 assertions PASS. Exact provider/default order, no Electron-local union, exhaustive `AI_NAMES.map`, shared Kimi predicate, missing-domain cases, unchanged cookie fixtures for the other providers, lifecycle defaults, and attachment snapshot validation passed. |
| 2026-08-03T16:46:45Z | `9c5bf90` | `node scripts/verify-electron-phase2-snapshots.mjs` | 0 | 1.696s | PASS | AC-6, AC-7 | Actual Electron isolated profile: legacy-new → legacy-old order; read-only normalization did not persist; load/last-opened, label/note, completed/reopened, archived/restored passed; mutation persisted all five current fields; profile removed. |
| 2026-08-03T16:45:23Z | `9c5bf90` content | `npm run build` plus SHA-256 manifest | 0 | 2.263s | PASS | AC-10 | Transforms 50/9/1/1; exactly six outputs. Renderer JS/CSS/HTML, preload, and spoof-preload were byte-identical to baseline; only main changed. |
| 2026-08-03T16:47:27Z | `4a95621..9c5bf90` | Task-scoped `git diff --check`, actionable rerun with `-c core.whitespace=cr-at-eol`, EOL/scope/secret scan | 2 / 0 | 0.8s | PASS | AC-12 | Raw output 232 lines / 116 trailing-whitespace findings; all 116 were CR-at-EOL only. Actionable output 0, changed paths 7, forbidden paths 0, secret findings 0. |
| 2026-08-03T16:47:35Z | final S2 code in running app | `node scripts/probe-electron-login-status.mjs 9224` | 0 | 0.153s | PARTIAL | AC-3–AC-5 | Seven ordered keys, seven boolean values, all true including Kimi. Kimi target contained exact `kimi-auth` on `www.kimi.com`; values omitted. Logout/relogin transition not performed. |
| 2026-08-03T16:48:15Z | `9c5bf90` | non-PTY `cmd.exe /d /c build-and-run.bat` | 1 | 3.593s | ENV_LIMIT | AC-10, AC-11 | `npm install` unchanged, build 50/9/1/1 and app launch succeeded; final batch `timeout /t 2` returned “Input redirection is not supported” in the non-interactive runner and set exit 1. |
| 2026-08-03T16:48:35Z | `9c5bf90` | PTY `cmd.exe /d /c build-and-run.bat` | 0 | 5.352s | PASS | AC-10, AC-11 | Same install/build output; app launched as `Siftline` (PID observed, start 16:48:40Z). Existing npm audit state remained 25 and was not modified. |

## Build Artifact Equivalence

| Output | Baseline bytes / SHA-256 | Final bytes / SHA-256 | Result |
|---|---|---|---|
| `dist/index.html` | 988 / `04A5FC2C...` | 988 / `04A5FC2C...` | byte-identical |
| renderer JS | 289374 / `4DE4C68D...` | 289374 / `4DE4C68D...` | byte-identical |
| renderer CSS | 71575 / `A5971E30...` | 71575 / `A5971E30...` | byte-identical |
| `dist-electron/preload.js` | 4763 / `874B05A1...` | 4763 / `874B05A1...` | byte-identical |
| spoof preload | 6190 / `1BAEE87F...` | 6190 / `1BAEE87F...` | byte-identical |
| `dist-electron/main.js` | 168391 / `31E59246...` | 168074 / `11E065FA...` | expected S1–S4 change only |

Full final hashes were inspected in the command output. No build output is task-owned or staged.

## Manual / Actual-App Checks

- Seven-provider positive status: PASS. All seven properties were present, ordered, and boolean; Kimi was `true` with exact `kimi-auth` metadata.
- Kimi true → logout false → user login true: **BLOCKED**. The user was asked to perform the transition; no logout was observed before the app closed/restarted. Per approval, AC-4 remains BLOCKED and S2/bundle completion is not claimed.
- Council Chat smoke: PASS. One addressed ChatGPT message changed the room from 10 to 12 messages; final room was idle with pending 0 and error 0. The user supplied a screenshot and confirmed the panel displayed the requested smoke response. Reply text is not copied into repository evidence.
- Saved Sessions: PASS in an actual Electron process with a disposable profile. The real user store had zero Saved Sessions at planning baseline and was not seeded or rewritten.
- Attachment boundary: PASS via three focused runtime fixtures for malformed/null/valid attachment snapshots. No selector or provider attachment behavior changed; Phase 1's actual attachment regressions remain the latest provider-upload evidence.
- Workflow: not manually exercised. The user retired Workflow from normal use, and this bundle changes no Workflow behavior; its shared graph is covered by Electron-inclusive typecheck and build.

## Acceptance-Criteria State

| AC | State | Evidence |
|---|---|---|
| AC-1 | PASS | Electron-inclusive typecheck exit 0. |
| AC-2 | PASS | Canonical imports/re-exports; preload byte-identical; no local Electron union. |
| AC-3 | PASS | Canonical `AI_NAMES.map` result contained seven boolean properties including Kimi. |
| AC-4 | BLOCKED | User-operated logout/relogin transition not completed. |
| AC-5 | PASS | Exact-domain positive/negative fixtures, anonymous baseline, actual positive Kimi status, other provider rules retained. |
| AC-6 | PASS | Legacy defaults and no eager read-time write verified. |
| AC-7 | PASS | Isolated load/order/annotation/lifecycle/archive/current-shape persistence verified. |
| AC-8 | PASS | Missing-domain, local-window narrowing, and attachment boundary verified without suppression. |
| AC-9 | PASS | Final diagnostic count zero; S1 residual count recorded exactly. |
| AC-10 | PASS | Six outputs, 50/9/1/1, five unchanged hashes, expected main-only change. |
| AC-11 | PASS | PTY official launcher, actual Chat smoke, and attachment boundary fixture. |
| AC-12 | PASS | Actionable whitespace 0, EOL preserved, scope/secret checks clean. |
| AC-13 | PASS | Pre-removal equality output and 36-assertion canonical order/default fixture. |

## EOL / Scope Details

- `electron/main.ts`: i/crlf w/crlf — preserved.
- `electron/councilPrompt.ts`: i/lf w/crlf — preserved working-tree CRLF without whole-file content rewrite (numstat 3/2 ignoring CR-at-EOL).
- `electron/preload.ts`, `tsconfig.json`, and new scripts: i/lf w/lf.
- Implementation numstat ignoring CR-at-EOL: main 116/104; prompt 3/2; preload 2/1; config 1/1; three new verification scripts only.
- No package/lock, `.gitattributes`, selector, dependency, schema-version, Phase 3/4, or user-owned handoff path change.
- `_to_delete/` remained untouched as instructed.

## Failed Harness Attempts and Cleanup

- First fixture bundle externalized `typescript` into `%TEMP%` and failed to resolve it there. Rebundling TypeScript produced the final 36/36 PASS. Product code was unaffected.
- First isolated snapshot run completed all behavioral assertions but waited on a CDP `Browser.close` response after the socket closed and exited 13. The exact stale temp profile was verified under the system temp root and removed. Bounded close handling was added; all later runs exited 0 and removed their profiles.
- First non-PTY official launcher run built and launched successfully but inherited the batch file's terminal-only `timeout` limitation. PTY rerun exited 0; the batch file is unchanged.

## Residual Risk / Blocker

- Required blocker: AC-4 remains BLOCKED until the user performs Kimi Logout and user-completed Login while status is observed false → true. S2 and the whole bundle must not be called complete before that evidence exists.
- `isLoginComplete()` Kimi and persisted Accounts status now share the exact predicate, but the standalone Kimi login script still closes on its existing DOM-composer rule. The missing manual cycle is the remaining integration proof that its transferred cookie set reaches `kimi-auth` consistently.
- Provider DOMs remain external and mutable. Selectors were intentionally unchanged.
- Existing npm audit output (25 findings) is unchanged and outside this bundle.
