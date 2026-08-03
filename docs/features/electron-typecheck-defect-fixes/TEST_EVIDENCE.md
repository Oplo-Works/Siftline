# Test Evidence: Electron Typecheck and Surfaced Defect Fixes

- Overall Result: **PASS for approved revision-3 scope** — Electron-inclusive typecheck, 60 focused assertions, isolated Saved Sessions, six-output build equivalence, Council Chat smoke, and actual Kimi `true → false → true` all pass. Current fresh Kimi authentication reports true without `kimi-auth` through a validated boolean-only renderer boundary. A separate observation remains: the Accounts Kimi Login launcher did not complete login, while direct login in the main Kimi panel succeeded; `kimi-login.mjs` was explicitly outside revision-3 scope and remains unchanged.
- Implementation Base: `4a95621c84e43faa6ada6e4f507631443d759975`
- Revision-3 Implementation Base: `175617c` — approved revision-3 metadata
- Implementation Head: `d4e0a65f992d7d09885e2b3e8e380b0fdd9351c1` — `fix(electron): detect current Kimi login state`
- Verified Target: `d4e0a65f992d7d09885e2b3e8e380b0fdd9351c1`
- Environment: Windows NT 10.0.26200.0; Node v24.12.0; npm 11.6.2; TypeScript 5.9.3; Electron 41.2.0; Vite 5.4.21; `core.autocrlf=true` from system Git config.
- Data handling: Cookie/token values and real reply bodies were not read into evidence or written to this file or Git. Authentication evidence contains only boolean status, cookie names/domains/flags, and boolean presence of non-secret local-storage key names. Saved Session fixtures were synthetic and isolated.

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
| 2026-08-03T17:58:12Z | user-operated Kimi cycle against `9c5bf90` | `node scripts/probe-electron-login-status.mjs 9224` before/after Logout and after Login; read-only CDP key-presence probe | 0 / 0 / 0 | observed live | FAIL | AC-4, AC-5 | Initial Kimi `true`; Logout produced `false` and removed `kimi-auth`. After the user completed Login, `access_token`, `refresh_token`, and user-id storage keys were present and no login control was present, but `kimi-auth` remained absent and Accounts IPC remained `kimi:false`. Values were not read or recorded. Other six statuses remained `true`. |
| 2026-08-03T16:48:15Z | `9c5bf90` | non-PTY `cmd.exe /d /c build-and-run.bat` | 1 | 3.593s | ENV_LIMIT | AC-10, AC-11 | `npm install` unchanged, build 50/9/1/1 and app launch succeeded; final batch `timeout /t 2` returned “Input redirection is not supported” in the non-interactive runner and set exit 1. |
| 2026-08-03T16:48:35Z | `9c5bf90` | PTY `cmd.exe /d /c build-and-run.bat` | 0 | 5.352s | PASS | AC-10, AC-11 | Same install/build output; app launched as `Siftline` (PID observed, start 16:48:40Z). Existing npm audit state remained 25 and was not modified. |
| 2026-08-03 revision-3 final | `d4e0a65` content | `npx tsc --noEmit` | 0 | parallel final run 6.5s | PASS | AC-1, AC-8, AC-9 | No diagnostics with root `src` + `electron` include. |
| 2026-08-03 revision-3 final | `d4e0a65` content | Bundle and execute `scripts/verify-electron-phase2.ts` | 0 / 0 | bundle 1.059s | PASS | AC-2–AC-5, AC-8, AC-13, AC-14 | 60 assertions PASS. Added exact-origin, complete/partial/malformed signal, destroyed/missing view, rejection, timeout, fixed boolean-key expression, and Kimi load-refresh-hook coverage; prior fixtures remain. |
| 2026-08-03 revision-3 final | `d4e0a65` | `node scripts/verify-electron-phase2-snapshots.mjs` | 0 | parallel final run 6.5s | PASS | AC-6, AC-7 | Isolated legacy order/default/load/mutation lifecycle PASS; exact temporary profile removed. |
| 2026-08-03 revision-3 final | `d4e0a65` content | `npm run build` plus SHA-256 manifest | 0 | 2.1s | PASS | AC-10 | Transforms 50/9/1/1; exactly six outputs. Renderer JS/CSS/HTML, preload, and spoof-preload byte-identical to revision-3 baseline; only main changed to 169306 bytes / `3F426EBB...`. |
| 2026-08-03T18:18:53Z–18:21:16Z | running revision-3 build | user-operated Kimi cycle plus `node scripts/probe-electron-login-status.mjs 9224` | 0 | observed live | PASS | AC-4, AC-5, AC-14 | Fresh authenticated Kimi first reported true without `kimi-auth`; user Logout produced false; direct user Login in the main Kimi panel produced true. Other six booleans remained true. Only key/cookie names and boolean presence were inspected; values omitted. |
| 2026-08-03 revision-3 final | running revision-3 build | `node scripts/probe-electron-login-status.mjs 9224 --chat-smoke` | 0 | 19.3s | PASS | AC-3, AC-11 | Seven ordered boolean statuses all true; room 1 → 3 messages; final idle, reply ChatGPT, error false, pending false. Reply body not recorded. |
| 2026-08-03 revision-3 final | `175617c..d4e0a65` content | task-scoped whitespace/EOL/scope/secret classification | 2 / 0 | 1.1s | PASS | AC-12, AC-14 | Raw output 143 lines / 71 trailing-whitespace findings, all main CR-at-EOL. Actionable exit 0/findings 0; main CRLF and fixture LF preserved; changed tracked paths 2; forbidden paths 0; secret-value findings 0; exactly three approved fixed-key references. |
| 2026-08-03T18:25:21Z | `d4e0a65` | PTY `cmd.exe /d /c build-and-run.bat` | 0 | 7.2s | PASS | AC-10, AC-11 | `npm install` unchanged; build 50/9/1/1; Siftline window launched. Existing npm audit 25 remains unchanged and out of scope. |

## Build Artifact Equivalence

| Output | Baseline bytes / SHA-256 | Final bytes / SHA-256 | Result |
|---|---|---|---|
| `dist/index.html` | 988 / `04A5FC2C...` | 988 / `04A5FC2C...` | byte-identical |
| renderer JS | 289374 / `4DE4C68D...` | 289374 / `4DE4C68D...` | byte-identical |
| renderer CSS | 71575 / `A5971E30...` | 71575 / `A5971E30...` | byte-identical |
| `dist-electron/preload.js` | 4763 / `874B05A1...` | 4763 / `874B05A1...` | byte-identical |
| spoof preload | 6190 / `1BAEE87F...` | 6190 / `1BAEE87F...` | byte-identical |
| `dist-electron/main.js` | revision-3 baseline 168074 / `11E065FA...` | 169306 / `3F426EBB3B3D763BB3B0B9BA414A53B3B006C2BC5307D44384BE9149FD8ED5A8` | expected revision-3 Kimi boolean-status change only |

Full final hashes were inspected in the command output. No build output is task-owned or staged.

## Manual / Actual-App Checks

- Seven-provider current status: PASS. All seven properties were present, ordered, boolean, and true. Kimi was true without `kimi-auth`; the complete current renderer signal was therefore the positive path.
- Kimi true → logout false → user login true: **PASS**. The user logged out through Accounts and logged in directly in the main Kimi panel. Exact observed transition timestamps were 18:18:53Z false and 18:21:16Z true. The six other statuses remained true.
- Kimi loading behavior: the first probe during initial Kimi page loading returned false; after the view completed, subsequent IPC and the user-provided Accounts screenshot showed Logged in. The source fixture verifies the `did-finish-load` refresh hook. No polling or hidden view was added.
- Accounts Kimi Login launcher: **SEPARATE OBSERVATION / OUT OF REVISION-3 SCOPE**. The Accounts button opened the standalone Kimi login window but did not complete authentication; the user successfully used the embedded main Kimi panel instead. The screenshots are not copied into Git. Revision 3 explicitly prohibited editing `kimi-login.mjs`; this packet does not claim that launcher works and recommends a separate follow-up decision.
- Council Chat smoke: PASS. One addressed ChatGPT message changed the final smoke room from 1 to 3 messages; final room was idle with pending 0 and error 0. The user supplied a screenshot and confirmed the panel displayed the requested smoke response. Reply text is not copied into repository evidence.
- Saved Sessions: PASS in an actual Electron process with a disposable profile. The real user store had zero Saved Sessions at planning baseline and was not seeded or rewritten.
- Attachment boundary: PASS via three focused runtime fixtures for malformed/null/valid attachment snapshots. No selector or provider attachment behavior changed; Phase 1's actual attachment regressions remain the latest provider-upload evidence.
- Workflow: not manually exercised. The user retired Workflow from normal use, and this bundle changes no Workflow behavior; its shared graph is covered by Electron-inclusive typecheck and build.

## Acceptance-Criteria State

| AC | State | Evidence |
|---|---|---|
| AC-1 | PASS | Electron-inclusive typecheck exit 0. |
| AC-2 | PASS | Canonical imports/re-exports; preload byte-identical; no local Electron union. |
| AC-3 | PASS | Canonical `AI_NAMES.map` result contained seven boolean properties including Kimi. |
| AC-4 | PASS | Actual fresh authenticated true → Accounts Logout false → direct main-panel Login true; other six stayed true. |
| AC-5 | PASS | Legacy cookie and complete current signal positives plus anonymous/unrelated/partial/malformed/error/timeout negatives passed; actual current path passed without `kimi-auth`. |
| AC-6 | PASS | Legacy defaults and no eager read-time write verified. |
| AC-7 | PASS | Isolated load/order/annotation/lifecycle/archive/current-shape persistence verified. |
| AC-8 | PASS | Missing-domain, local-window narrowing, and attachment boundary verified without suppression. |
| AC-9 | PASS | Final diagnostic count zero; S1 residual count recorded exactly. |
| AC-10 | PASS | Six outputs, 50/9/1/1, five unchanged hashes, expected main-only change. |
| AC-11 | PASS | PTY official launcher, actual Chat smoke, and attachment boundary fixture. |
| AC-12 | PASS | Actionable whitespace 0, EOL preserved, scope/secret checks clean. |
| AC-13 | PASS | Pre-removal equality output and final 60-assertion fixture retain the canonical order/default contract. |
| AC-14 | PASS | Boolean-only exact-origin boundary, failures/timeout, source key references, load refresh, scoped secret scan, and actual no-cookie positive state passed. |

## EOL / Scope Details

- `electron/main.ts`: i/crlf w/crlf — preserved.
- `electron/councilPrompt.ts`: i/lf w/crlf — preserved working-tree CRLF without whole-file content rewrite (numstat 3/2 ignoring CR-at-EOL).
- `electron/preload.ts`, `tsconfig.json`, and new scripts: i/lf w/lf.
- Revision-3 `scripts/verify-electron-phase2.ts`: i/lf w/lf; `electron/main.ts`: i/crlf w/crlf.
- Revision-3 numstat ignoring CR-at-EOL: main 71/1; focused fixture 85/2. No whole-file rewrite occurred.
- Implementation numstat ignoring CR-at-EOL: main 116/104; prompt 3/2; preload 2/1; config 1/1; three new verification scripts only.
- No package/lock, `.gitattributes`, selector, dependency, schema-version, Phase 3/4, or user-owned handoff path change.
- `_to_delete/` remained untouched as instructed.

## Failed Harness Attempts and Cleanup

- First fixture bundle externalized `typescript` into `%TEMP%` and failed to resolve it there. Rebundling TypeScript produced the final 36/36 PASS. Product code was unaffected.
- First isolated snapshot run completed all behavioral assertions but waited on a CDP `Browser.close` response after the socket closed and exited 13. The exact stale temp profile was verified under the system temp root and removed. Bounded close handling was added; all later runs exited 0 and removed their profiles.
- First non-PTY official launcher run built and launched successfully but inherited the batch file's terminal-only `timeout` limitation. PTY rerun exited 0; the batch file is unchanged.
- The first revision-3 parallel fixture command was rejected before execution because its dynamically composed temporary output/removal command violated the runner policy. It was not counted as a test. Both later explicit-path fixture runs passed; the two exact temporary bundles were inspected and removed.

## Residual Risk / Blocker

- No blocker remains inside approved revision-3 scope. AC-4, AC-5, and AC-14 pass on implementation `d4e0a65`.
- Residual follow-up: Accounts' standalone Kimi Login launcher did not complete login, while the main Kimi panel did. This was observed after revision-3 approval, and the launcher code was unchanged by the status-predicate fix. Keep it visible for independent classification and a separate approved bundle rather than folding it into this implementation.
- Provider DOMs remain external and mutable. Selectors were intentionally unchanged.
- Existing npm audit output (25 findings) is unchanged and outside this bundle.
