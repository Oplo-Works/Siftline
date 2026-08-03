# PLAN: Electron Typecheck and Surfaced Defect Fixes

- Feature ID: `electron-typecheck-defect-fixes`
- Risk: Standard
- Bundle ID: `electron-typecheck-defect-fixes-R2`
- PLAN Revision: 2
- SPEC: `docs/features/electron-typecheck-defect-fixes/SPEC.md`, revision 2, APPROVED
- Status: READY_FOR_REVIEW — AC-4 BLOCKED
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

## Technical Decisions

- Type/provider source: import canonical `AiName` into all three Electron TypeScript entry modules that currently redeclare it, and preserve their existing type exports. Use the `.js` module specifier compatible with the existing ESM/bundler convention. Main also imports canonical runtime `AI_NAMES` and `DEFAULT_ENABLED_AIS` from the side-effect-free `src/types.ts`, removing both adjacent duplicate lists. Do not hand-synchronize another union/list.
- Provider-order contract: canonical order is `chatgpt → claude → deepseek → gemini → grok → kimi → perplexity`; canonical defaults are `chatgpt → claude → gemini`. The order drives panel placement and sequential Council targets, so a focused fixture fails on reorder as well as omission.
- Typecheck/build boundary: update only root `include` to `["src", "electron"]`; leave compiler options, the `tsconfig.node.json` reference, Vite entries, Rollup externals, package scripts, and output directories unchanged.
- Exhaustive login result: obtain partition cookies through `AI_NAMES` iteration and derive a boolean for every name. Keep provider-specific predicates explicit. Avoid a six/seven-key object literal as the final completeness mechanism.
- Kimi status predicate: persisted status requires exact `kimi-auth` plus a Kimi domain. Reuse that predicate in the Kimi branch of `isLoginComplete()` so generic anonymous session/token cookies cannot complete the generic window early. Do not change the other six provider predicates. The standalone login script's DOM close behavior remains unchanged; its transferred cookies must satisfy the shared persisted predicate. If they do not, record BLOCKED/FAIL rather than weaken detection.
- Optional cookie domains: use a small explicit domain-normalization/match helper that returns no match for missing domains. During copying, skip cookies without a usable host. This resolves the full 20-error family and is a runtime hardening fix, not an optional-chain suppression.
- Window narrowing: capture the guarded `mainWindow` in a local constant before the synchronous callback, preserving add/remove behavior.
- Attachment snapshot typing: validate/declare the `executeJavaScript` snapshot boundary as `{ count: number; names: string[] } | null` so names are strings before comparison.
- Snapshot persistence: define a backward-compatible persisted input shape whose five later fields are optional, while keeping the sanitized `CouncilSnapshotRecord` fields required. Let the existing sanitizer perform the conversion. Do not claim the raw store is already current, add an eager startup write, or introduce a schema version.
- Snapshot migration decision: no eager migration. Current UI correctness is supplied by read-time normalization; existing mutation paths naturally persist current records. Add an isolated old-shape fixture to prove filters, sorting, loading, lifecycle, archive, annotation, and current-shape persistence.
- Follow-up observations: defer all three Phase 1 nonblocking observations to a separate Phase 3 candidate. Clipboard restoration in particular has an external race (the user may copy new content while a paste is in progress), so it needs a dedicated ownership/policy design rather than being hidden in typecheck cleanup.
- EOL: preserve each target's current working-tree convention exactly. Use surgical patches; inspect `--numstat`, EOL state, and content diff before staging. Reject an apparent whole-file rewrite.

## Slices

### Slice 1 — Activate the checker and canonicalize provider types

1. Edit root `tsconfig.json` include to `src` plus `electron` without changing other compiler/build options.
2. Capture the exact pre-removal equality/output of both provider arrays and both default-enabled arrays.
3. Replace local `AiName` unions in `electron/main.ts`, `electron/preload.ts`, and `electron/councilPrompt.ts` with canonical imports/re-exports; make main use canonical runtime `AI_NAMES` and `DEFAULT_ENABLED_AIS`, retaining existing public type surfaces.
4. Add a focused fixture that asserts both canonical arrays and the provider order used by panel/sequential-target call sites.
5. Run the real `npx tsc --noEmit`, record the post-S1 count/code/file list, and confirm it matches or explain any difference from the 25-error in-memory baseline.
6. Verify emitted JS contains no preload type import and Vite still discovers the same three Electron entries.

### Slice 2 — Fix exhaustive login state and cookie nullability

1. Extract explicit safe cookie-domain matching used by login predicates and cookie copy. Missing domain returns false/skip.
2. Refactor `getLoginStatus()` to iterate `AI_NAMES`, preserve the existing six provider rules, and add exact Kimi persisted detection. Reuse the same predicate in only the Kimi branch of `isLoginComplete()`.
3. Add focused positive/negative fixtures using cookie names/domains only; cover unrelated-domain `kimi-auth` and missing domain.
4. Run the app. Observe current Kimi Logged in, perform Logout, verify false, then open Kimi Login and wait for the user to complete it before verifying true. Record only booleans and cookie names/domains.
5. If actual login completion does not establish `kimi-auth`, mark S2 blocked/failing, document the observed non-secret signals, and return to SPEC/PLAN approval rather than guessing.

### Slice 3 — Make Saved Session compatibility explicit

1. Separate persisted/legacy snapshot input typing from the required current sanitized record and update the store/sanitizer boundary.
2. Preserve the five established defaults and no-eager-migration behavior.
3. In a disposable Electron profile, seed one synthetic old-shape record, then verify list visibility, opened-time ordering, load, label/note, lifecycle, archive/restore, and current-shape persistence after mutation.
4. Confirm the real store still has snapshot count 0 and was not written by the fixture. Delete the isolated profile after inspecting non-sensitive metadata.

### Slice 4 — Resolve remaining strict errors by invariant

1. Capture guarded `mainWindow` locally for synchronous view layout.
2. Type/validate the attachment snapshot boundary and its name array.
3. Re-run the checker; inspect every residual diagnostic. Fix true defects in-scope, or stop for approval if a fix changes behavior beyond S1-S4.
4. Do not use `any`, `@ts-ignore`, blanket non-null assertions, or widespread optional chaining to make the count zero.

### Slice 5 — Integrated validation and review packet

1. Run the focused verification script and inspect every assertion/count.
2. Run Electron-inclusive typecheck and production build; create the after manifest and explain each changed artifact.
3. Run Accounts, isolated Saved Sessions, Council Chat startup/message, and affected attachment UI smoke checks. Do not revive the retired Workflow manual flow because this bundle does not modify it; typecheck/build still cover its shared graph.
4. Perform task-scoped whitespace/EOL/secret/scope checks, explicitly excluding CR-only findings from actionable whitespace.
5. Record commands plus actual output summaries in `TEST_EVIDENCE.md`. A check is PASS only after output inspection.
6. Create a local review packet and request independent review. Do not push or create a PR.

## Validation Detail

- Typecheck: `npx tsc --noEmit`; expected exit 0 with `electron` present in root include. Save the actual exit/count, not an inferred PASS.
- Focused fixtures: run the Phase 2 verification script for canonical unions, login-result completeness/Kimi cookie cases/missing domains, and legacy snapshot defaults/behavior. Record asserted totals.
- Build: `npm run build`; compare recursive output path, byte size, and SHA-256 manifest against the six-file baseline. Expected topology is unchanged. Exact renderer, CSS, HTML, preload, and spoof-preload hashes should remain stable. Review the main change against approved source changes. Expected transforms are 50 renderer / 9 main / 1 preload / 1 spoof preload because canonical runtime `AI_NAMES` adds `src/types.ts` to the main graph; any other variation requires explanation.
- App: use `build-and-run.bat`. Inspect Accounts Kimi true → logout false → user login true; verify other provider statuses did not regress. Use a disposable profile/harness for the legacy snapshot and never mutate the real store for that fixture.
- Chat smoke: open Council Chat, confirm panels/layout load, send one synthetic addressed message to an already authenticated provider, and inspect attachment-name matching UI/code path. No real transcript content enters evidence.
- EOL before and after: `git ls-files --eol -- electron/main.ts electron/councilPrompt.ts electron/preload.ts tsconfig.json`. Preserve main CRLF, prompt working-tree CRLF, preload LF, and tsconfig LF; add test/docs files as LF. Reject whole-file numstat for surgical targets.
- Whitespace: run `git diff --check -- tsconfig.json electron/main.ts electron/councilPrompt.ts electron/preload.ts <new task paths>`. Record raw count, classify only terminal CR findings as CR-only, and require actionable count 0. Record `git config --show-origin --get core.autocrlf` (`true` at baseline).
- Diff/scope: inspect `git diff --ignore-cr-at-eol --stat`, `git diff --ignore-cr-at-eol -- <task paths>`, and after explicit staging `git diff --cached --ignore-cr-at-eol`. Confirm package/lock, selectors, `.gitattributes`, schema version, Phase 3/4 code, and user-owned paths are absent.
- Secret scan: scan only task-owned diff for credential/token/private-key patterns. Cookie values are forbidden from artifacts; expected finding count 0.
- Failure rule: BLOCKED/FAIL/NOT_RUN remains explicit. Kimi transition BLOCKED prevents S2 and bundle completion. Build or final typecheck failure prevents review handoff.

## Workflow / Commit Boundaries

1. Wait for explicit Human approval of SPEC revision 1 and PLAN revision 1. Do not edit product/config/test code before approval.
2. After approval, read `docs/workflow/BUILD.md`; implement each slice and commit only explicit task-owned paths locally.
3. Read `docs/workflow/TEST.md`; create evidence with inspected command output and perform the approved manual checks.
4. Prepare a local independent-review packet. Resolve findings within approval or revise the bundle when required.
5. After review PASS, follow `WF:CLOSE` locally. Push, PR, tag, release, and deploy remain prohibited.

## Dependencies / Assumptions

- Existing dependencies and Electron/Vite versions are sufficient; no install or upgrade is planned.
- The observed authenticated/anonymous Kimi cookie-name difference remains valid during BUILD, but actual transition is the acceptance gate.
- The user can complete Kimi authentication manually after logout. If not, the required check is blocked and no completion claim is allowed.
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
- Bundle ID: `electron-typecheck-defect-fixes-R1`
- SPEC Revision approved: 2 (revision 1 plus explicitly pre-approved BUILD conditions)
- PLAN Revision approved: 2 (revision 1 plus explicitly pre-approved BUILD conditions)
- Decision: APPROVED
- User message: 2026-08-03, revision 1 approved; record the order/default contracts and align only Kimi's completion predicate, then begin BUILD without reapproval.
- Constraints / expiry: Phase 2 S1-S4 only; approval expires if substantive scope, authentication predicate, migration decision, build topology, dependency/provider/selector/EOL/publication behavior changes.

## High PLAN Approval

- Decision: N/A
- User message: N/A
- Constraints: N/A

## Revision History

- Revision 1 (2026-08-03): Initial Phase 2 plan. Records the 33-error and 25-residual measured baselines, three Electron-local `AiName` declarations, evidence-backed Kimi status rule/consumer impact, no-eager-migration legacy snapshot decision, Vite/tsconfig boundary, deterministic build manifest, EOL constraints, and deferred Phase 1 observations.
- Revision 2 (2026-08-03): Added pre-removal provider/default equality evidence, canonical `DEFAULT_ENABLED_AIS`, an order/default fixture and AC, and the pre-approved shared exact Kimi predicate for generic completion plus persisted status. Approval remains valid without another request.
