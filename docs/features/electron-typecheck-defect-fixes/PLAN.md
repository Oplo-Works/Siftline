# PLAN: Electron Typecheck and Surfaced Defect Fixes

- Feature ID: `electron-typecheck-defect-fixes`
- Risk: Standard
- Bundle ID: `electron-typecheck-defect-fixes-R3`
- PLAN Revision: 3
- SPEC: `docs/features/electron-typecheck-defect-fixes/SPEC.md`, revision 3, APPROVED
- Status: APPROVED
- Base Branch/Commit: `codex/council-chat-phase1-defect-fixes` / `eb6eac2112cc390794833c73656d6a8da78a9b76`; planning branch `codex/electron-typecheck-defect-fixes`

## Baseline

- Current root: `C:\Users\Sales01\Documents\AI-Council-Chat`.
- Phase 1 is locally closed at `eb6eac2`; Phase 2 starts from that exact state and has no push/upstream authority.
- Root `tsconfig.json` has strict options but `include: ["src"]`. Its project reference points to `tsconfig.node.json`, whose independent scope remains `vite.config.ts`.
- `vite.config.ts` explicitly gives `vite-plugin-electron` three entries: `electron/main.ts`, `electron/preload.ts`, and `electron/preload-chrome-spoof.js`. Vite/esbuild already transpiles those entries to `dist-electron`; it does not use root `tsconfig.include` to discover build entries. Widening `include` therefore changes static checking, not entry selection or emit configuration.
- Production baseline `npm run build` exited 0 with transforms 50 renderer / 8 main / 1 preload / 1 spoof preload and six outputs. A before/after same-source rebuild was byte-identical:
  - `dist-electron/main.js` 168391 bytes, SHA-256 `31E592467B7DC1CFFF2DC17E29F8ED42A438D05B8D1C166EF7F0F8232957BD08`
  - `dist-electron/preload.js` 4763 bytes, `874B05A15CBE0024AC2501E4B35402250D4458FDC8E7EAEA7E51B0946A7A53CC`
  - `dist-electron/preload-chrome-spoof.js` 6190 bytes, `1BAEE87F587D9838BA6B5133865DF0850173CE9706D59FAFC0CA947AE800452B`
  - renderer JS/CSS/HTML hashes: `4DE4C68D...`, `A5971E30...`, `04A5FC2C...` respectively.
- An in-memory config override measured 33 diagnostics without editing `tsconfig.json`: main 32, Council prompt 1; TS18048 x20, TS2345 x8, TS18047 x2, TS7006 x1, TS2741 x1, TS2322 x1.
- An in-memory S1 type-import substitution leaves 25 diagnostics: TS18048 x20, TS18047 x2, TS2345 x1, TS2741 x1, TS7006 x1. This measured result supersedes the initial hypothesis that S1 causes most TS18048 errors.
- Kimi status consumer trace: preload IPC → renderer `window.electronAPI.getLoginStatus()` → `AccountsPanel.refresh()` only. `undefined` produces the false Accounts state; Council enabled/preflight routing does not read it.
- Kimi cookie evidence, values omitted: authenticated persisted Kimi has `kimi-auth` on `www.kimi.com`; a deleted isolated anonymous profile lacks that cookie. Generic anonymous cookies and broad DOM signals are insufficient.
- Pre-removal list equality: main and renderer `AI_NAMES` both print `chatgpt,claude,deepseek,gemini,grok,kimi,perplexity` in exactly that order; main `DEFAULT_ENABLED_AI_NAMES` and renderer `DEFAULT_ENABLED_AIS` both print `chatgpt,claude,gemini`. This output must be copied into `TEST_EVIDENCE.md` before the duplicate lines are removed.
- Saved Sessions evidence: all reads sanitize before summaries; the real local `councilSnapshots` array currently has count 0. Compatibility must therefore be tested with an isolated synthetic legacy record, not claimed from the empty store.
- Existing EOL: main i/crlf w/crlf; Council prompt i/lf w/crlf; preload i/lf w/lf; tsconfig i/lf w/lf. Global Git config reports `core.autocrlf=true`.
- Preserved user-owned untracked paths are excluded from every stage/staging operation:
  - `docs/handoff_history/COWORK_SESSION_HANDOFF_council_chat_review.md`
  - `docs/handoff_history/HANDOFF_PROMPT_council_chat_fixes.md`
- `_to_delete/` is prior-review trash, not a preserved user file. It remains outside task scope and the agent will not modify or delete it; if the user deletes it, it stays absent.
- Revision-3 planning base is `91cd6c6`. Actual user-operated evidence against implementation `9c5bf90`: legacy state `kimi:true` with exact `kimi-auth`; Logout removed the cookie and produced `false`; fresh Login persisted boolean presence of `access_token`, `refresh_token`, and `msh_user_id` in the existing Kimi renderer partition, produced no login control, did not recreate `kimi-auth`, and remained `kimi:false` after app restart. Values were not returned or recorded; all other provider statuses stayed true.
- Revision-3 artifact baseline is the current six-output build: main 168074 bytes / `11E065FA9BC4297C9A1AFEEE5170915E1422BA4CCD83A899C72210CC5BEA4443`; renderer JS 289374 / `4DE4C68D...`; CSS 71575 / `A5971E30...`; HTML 988 / `04A5FC2C...`; preload 4763 / `874B05A1...`; spoof preload 6190 / `1BAEE87F...`. Revision 3 may change main only.

## Technical Decisions

- Type/provider source: import canonical `AiName` into all three Electron TypeScript entry modules that currently redeclare it, and preserve their existing type exports. Use the `.js` module specifier compatible with the existing ESM/bundler convention. Main also imports canonical runtime `AI_NAMES` and `DEFAULT_ENABLED_AIS` from the side-effect-free `src/types.ts`, removing both adjacent duplicate lists. Do not hand-synchronize another union/list.
- Provider-order contract: canonical order is `chatgpt → claude → deepseek → gemini → grok → kimi → perplexity`; canonical defaults are `chatgpt → claude → gemini`. The order drives panel placement and sequential Council targets, so a focused fixture fails on reorder as well as omission.
- Typecheck/build boundary: update only root `include` to `["src", "electron"]`; leave compiler options, the `tsconfig.node.json` reference, Vite entries, Rollup externals, package scripts, and output directories unchanged.
- Exhaustive login result: obtain partition cookies through `AI_NAMES` iteration and derive a boolean for every name. Keep provider-specific predicates explicit. Avoid a six/seven-key object literal as the final completeness mechanism.
- Kimi status predicate revision: retain exact-domain `kimi-auth` as the legacy fast path. If absent, read the existing Kimi BrowserView only when its parsed URL hostname is exactly `kimi.com` or a subdomain, execute a fixed expression that converts the three observed storage entries to booleans inside the renderer, validate the returned fixed-shape object in main, and require all three booleans true. A destroyed/missing view, unrelated/invalid URL, navigation race, partial/malformed result, rejection, or timeout returns false. No value leaves the renderer.
- Kimi flow boundary: keep the existing standalone `kimi-login.mjs` composer completion and shared `persist:kimi` partition; do not edit the script or emit/copy storage values. After child completion, the existing parent reload/status notification lets `getLoginStatus()` evaluate the current renderer signal. Keep `isLoginComplete()`'s Kimi exact-cookie branch narrow for the generic fallback; do not restore broad `session|token|access|refresh|user` cookie-name matching. Other six provider predicates remain byte-for-byte behaviorally unchanged.
- Startup/loading behavior: attach the existing `login-status-changed` notification to Kimi view `did-finish-load` so an Accounts panel opened before storage evaluation is ready refreshes once the real view loads. Do not create a hidden view, add polling, or emit storage values.
- Risk boundary: this remains a Standard local status-display correction because the only consumer is Accounts presentation. The boolean result must not be reused for Council routing, authorization, or credential transfer. Such reuse, or returning/copying values, stops BUILD and requires a High-risk revision.
- Revision-3 expected paths: `electron/main.ts`, `scripts/verify-electron-phase2.ts`, `docs/features/electron-typecheck-defect-fixes/{SPEC,PLAN,TEST_EVIDENCE,OPUS5_REVIEW_REQUEST}.md`, `docs/HANDOFF.md`, and `docs/DEV_LOG.md`. `kimi-login.mjs`, preload/renderer source, selectors, package/lock, and build outputs are not task-owned changes.
- Optional cookie domains: use a small explicit domain-normalization/match helper that returns no match for missing domains. During copying, skip cookies without a usable host. This resolves the full 20-error family and is a runtime hardening fix, not an optional-chain suppression.
- Window narrowing: capture the guarded `mainWindow` in a local constant before the synchronous callback, preserving add/remove behavior.
- Attachment snapshot typing: validate/declare the `executeJavaScript` snapshot boundary as `{ count: number; names: string[] } | null` so names are strings before comparison.
- Snapshot persistence: define a backward-compatible persisted input shape whose five later fields are optional, while keeping the sanitized `CouncilSnapshotRecord` fields required. Let the existing sanitizer perform the conversion. Do not claim the raw store is already current, add an eager startup write, or introduce a schema version.
- Snapshot migration decision: no eager migration. Current UI correctness is supplied by read-time normalization; existing mutation paths naturally persist current records. Add an isolated old-shape fixture to prove filters, sorting, loading, lifecycle, archive, annotation, and current-shape persistence.
- Follow-up observations: defer all three Phase 1 nonblocking observations to a separate Phase 3 candidate. Clipboard restoration in particular has an external race (the user may copy new content while a paste is in progress), so it needs a dedicated ownership/policy design rather than being hidden in typecheck cleanup.
- EOL: preserve each target's current working-tree convention exactly. Use surgical patches; inspect `--numstat`, EOL state, and content diff before staging. Reject an apparent whole-file rewrite.

## Slices

### Slice 1 — Activate the checker and canonicalize provider types — COMPLETE at `9c5bf90`

1. Edit root `tsconfig.json` include to `src` plus `electron` without changing other compiler/build options.
2. Capture the exact pre-removal equality/output of both provider arrays and both default-enabled arrays.
3. Replace local `AiName` unions in `electron/main.ts`, `electron/preload.ts`, and `electron/councilPrompt.ts` with canonical imports/re-exports; make main use canonical runtime `AI_NAMES` and `DEFAULT_ENABLED_AIS`, retaining existing public type surfaces.
4. Add a focused fixture that asserts both canonical arrays and the provider order used by panel/sequential-target call sites.
5. Run the real `npx tsc --noEmit`, record the post-S1 count/code/file list, and confirm it matches or explain any difference from the 25-error in-memory baseline.
6. Verify emitted JS contains no preload type import and Vite still discovers the same three Electron entries.

### Slice 2 — Fix exhaustive login state and cookie nullability — REVISION-3 PENDING

1. Extract explicit safe cookie-domain matching used by login predicates and cookie copy. Missing domain returns false/skip.
2. Preserve the exhaustive `AI_NAMES` loop and existing six provider rules. For Kimi, combine exact legacy-cookie status with a bounded boolean-only renderer-storage probe against the existing Kimi BrowserView.
3. Introduce a small typed/validated current-signal boundary. It returns only `{ accessTokenPresent, refreshTokenPresent, userIdPresent }` booleans; require all three. Do not return strings, storage snapshots, user identifiers, or arbitrary objects.
4. Add focused positive/negative fixtures for legacy exact/unrelated cookies, exact/unrelated origins, complete/partial/malformed current signals, destroyed/missing view behavior, evaluation rejection, timeout, and the Kimi load-completion refresh hook. Retain missing-cookie-domain coverage and assert the other six provider predicates are unchanged.
5. Run the app at the current fresh authenticated state and require Accounts Kimi true without `kimi-auth`. Then ask the user to perform Logout and fresh Login again; observe `true → false → true`, confirm current signals clear/reappear, and confirm the six other booleans remain stable. Record only booleans, key names, and cookie names/domains/flags.
6. If the signal contract or actual cycle fails, keep AC-4/AC-5/AC-14 FAIL or BLOCKED and return to SPEC/PLAN; do not weaken the all-three/exact-origin rule from ad hoc provider output.

### Slice 3 — Make Saved Session compatibility explicit — COMPLETE at `9c5bf90`

1. Separate persisted/legacy snapshot input typing from the required current sanitized record and update the store/sanitizer boundary.
2. Preserve the five established defaults and no-eager-migration behavior.
3. In a disposable Electron profile, seed one synthetic old-shape record, then verify list visibility, opened-time ordering, load, label/note, lifecycle, archive/restore, and current-shape persistence after mutation.
4. Confirm the real store still has snapshot count 0 and was not written by the fixture. Delete the isolated profile after inspecting non-sensitive metadata.

### Slice 4 — Resolve remaining strict errors by invariant — COMPLETE at `9c5bf90`

1. Capture guarded `mainWindow` locally for synchronous view layout.
2. Type/validate the attachment snapshot boundary and its name array.
3. Re-run the checker; inspect every residual diagnostic. Fix true defects in-scope, or stop for approval if a fix changes behavior beyond S1-S4.
4. Do not use `any`, `@ts-ignore`, blanket non-null assertions, or widespread optional chaining to make the count zero.

### Slice 5 — Integrated validation and review packet — PENDING after revision-3 Slice 2

1. Run the focused verification script and inspect every assertion/count.
2. Run Electron-inclusive typecheck and production build; create the after manifest and explain each changed artifact.
3. Run Accounts, isolated Saved Sessions, Council Chat startup/message, and affected attachment UI smoke checks. Do not revive the retired Workflow manual flow because this bundle does not modify it; typecheck/build still cover its shared graph.
4. Perform task-scoped whitespace/EOL/secret/scope checks, explicitly excluding CR-only findings from actionable whitespace.
5. Record commands plus actual output summaries in `TEST_EVIDENCE.md`. A check is PASS only after output inspection.
6. Create a local review packet and request independent review. Do not push or create a PR.

## Validation Detail

- Typecheck: `npx tsc --noEmit`; expected exit 0 with `electron` present in root include. Save the actual exit/count, not an inferred PASS.
- Focused fixtures: extend the Phase 2 verification script for canonical unions, login-result completeness, legacy/current Kimi positive and negative cases, exact-origin parsing, boolean-boundary validation/failures/timeouts, missing cookie domains, and legacy snapshot defaults/behavior. Record the actual assertion total and output.
- Build: `npm run build`; compare recursive output path, byte size, and SHA-256 manifest against the revision-3 six-file baseline above. Expected topology and transforms remain 50 renderer / 9 main / 1 preload / 1 spoof preload. Renderer, CSS, HTML, preload, and spoof-preload must remain byte-identical; only main may change for the approved boolean status correction. Any other variation requires explanation.
- App: use `build-and-run.bat`. First prove the currently fresh authenticated Kimi state becomes true without `kimi-auth`. Then inspect Accounts Kimi true → user Logout false → user Login true and verify the three boolean current signals clear/reappear while the other provider statuses do not regress. Token/user-id values are prohibited from output. Use a disposable profile/harness for the legacy snapshot and never mutate the real store for that fixture.
- Chat smoke: open Council Chat, confirm panels/layout load, send one synthetic addressed message to an already authenticated provider, and inspect attachment-name matching UI/code path. No real transcript content enters evidence.
- EOL before and after: `git ls-files --eol -- electron/main.ts electron/councilPrompt.ts electron/preload.ts tsconfig.json`. Preserve main CRLF, prompt working-tree CRLF, preload LF, and tsconfig LF; add test/docs files as LF. Reject whole-file numstat for surgical targets.
- Whitespace: run `git diff --check -- tsconfig.json electron/main.ts electron/councilPrompt.ts electron/preload.ts <new task paths>`. Record raw count, classify only terminal CR findings as CR-only, and require actionable count 0. Record `git config --show-origin --get core.autocrlf` (`true` at baseline).
- Diff/scope: inspect `git diff --ignore-cr-at-eol --stat`, `git diff --ignore-cr-at-eol -- <task paths>`, and after explicit staging `git diff --cached --ignore-cr-at-eol`. Confirm package/lock, selectors, `.gitattributes`, schema version, Phase 3/4 code, and user-owned paths are absent.
- Secret scan: scan only task-owned diff for credential/token/private-key patterns. Cookie/storage/token/user-id values are forbidden from artifacts; fixed key names and boolean presence are allowed and must be manually distinguished from values. Expected secret-value finding count 0.
- Failure rule: BLOCKED/FAIL/NOT_RUN remains explicit. Any failure to prove current authenticated true and actual `true → false → true`, or any value crossing the renderer boundary, prevents S2/bundle completion and review handoff. Build or final typecheck failure also prevents handoff.

## Workflow / Commit Boundaries

1. Wait for explicit Human approval of SPEC revision 3 and PLAN revision 3. The user's “승인이야. 다음 단계로 가자” authorizes preparing this revision, not BUILD before the substantive documents are presented. Do not edit product/config/test code before revision-3 approval.
2. After approval, read `docs/workflow/BUILD.md`; implement each slice and commit only explicit task-owned paths locally.
3. Read `docs/workflow/TEST.md`; create evidence with inspected command output and perform the approved manual checks.
4. Prepare a local independent-review packet. Resolve findings within approval or revise the bundle when required.
5. After review PASS, follow `WF:CLOSE` locally. Push, PR, tag, release, and deploy remain prohibited.

## Dependencies / Assumptions

- Existing dependencies and Electron/Vite versions are sufficient; no install or upgrade is planned.
- Legacy exact-cookie evidence remains valid as a compatibility fast path, but the actual fresh-login storage evidence supersedes cookie-only status as the complete rule.
- All seven BrowserViews are created at startup, including disabled panels, so the current Kimi view is available to the status collector. If it is missing, destroyed, not on an exact Kimi origin, or not ready within the bounded probe, Kimi current-signal status is false; no hidden view is created as a side effect.
- The user can repeat Kimi Logout and authentication manually after the fix. If not, the required actual cycle is BLOCKED and no completion claim is allowed.
- The isolated snapshot harness can point Electron/electron-store at a disposable profile without reading or writing the user's real Saved Sessions.
- The user's normal product surface is Council Chat, not Workflow. Workflow code remains must-preserve but is not behaviorally touched by this bundle.
- Provider DOMs and selectors remain external and unchanged.

## Non-Goals

- Do not implement or opportunistically clean up Phase 3/4 findings.
- Do not restore or redesign clipboard ownership/readback in this bundle.
- Do not edit selectors, package manifests/locks, runtime PIN/scope policy, provider configuration, or dependencies.
- Do not normalize EOL or add `.gitattributes`.
- Do not seed the user's real store, capture auth values, or automate credentials.
- Do not push, create a PR/tag/release, deploy, or contact external services beyond the user-driven provider login required by AC-4.
- Do not stage, commit, move, or delete pre-existing user-owned files.

## Approval Bundle

- Mode: STANDARD_BUNDLE
- Bundle ID: `electron-typecheck-defect-fixes-R3`
- SPEC Revision approved: 3
- PLAN Revision approved: 3
- Decision: APPROVED
- User message: 2026-08-03, “빌드 시작해줘” after the revision-3 SPEC/PLAN packet was presented — explicit BUILD approval.
- Constraints / expiry: Requested approval is limited to the boolean-only Kimi status correction in `electron/main.ts`, focused verification/evidence, and the repeated actual cycle. Existing Phase 2 implementation stays intact. Any returned/copied auth value, authorization/routing use, edit to `kimi-login.mjs`, dependency/provider/selector/EOL-policy/build-topology change, Phase 3/4 work, push, PR, tag, release, or deploy invalidates this bundle.

## High PLAN Approval

- Decision: N/A
- User message: N/A
- Constraints: N/A

## Revision History

- Revision 1 (2026-08-03): Initial Phase 2 plan. Records the 33-error and 25-residual measured baselines, three Electron-local `AiName` declarations, evidence-backed Kimi status rule/consumer impact, no-eager-migration legacy snapshot decision, Vite/tsconfig boundary, deterministic build manifest, EOL constraints, and deferred Phase 1 observations.
- Revision 2 (2026-08-03): Added pre-removal provider/default equality evidence, canonical `DEFAULT_ENABLED_AIS`, an order/default fixture and AC, and the pre-approved shared exact Kimi predicate for generic completion plus persisted status. Approval remains valid without another request.
- Revision 3 (2026-08-03): Replaces the disproved cookie-only completion assumption with legacy exact-cookie OR validated exact-origin boolean-only current renderer storage status; freezes the no-value-crossing boundary, leaves the standalone login script and other providers unchanged, adds current-signal failure fixtures and AC-14, and requires a repeated user-operated actual cycle.
