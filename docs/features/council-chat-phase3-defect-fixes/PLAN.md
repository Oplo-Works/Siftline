# PLAN: Council Chat Phase 3 Reliability and Login UX

- Feature ID: `council-chat-phase3-defect-fixes`
- Risk: Standard
- Bundle ID: `council-chat-phase3-defect-fixes-R1`
- PLAN Revision: 1
- SPEC: `docs/features/council-chat-phase3-defect-fixes/SPEC.md`, revision 1, READY_FOR_APPROVAL
- Status: READY_FOR_APPROVAL
- Base Branch/Commit: `codex/council-chat-phase3-defect-fixes` / `394cee2f5b42f26dfecc27548746e424ea6612a8`

## Baseline

- Phase 2 is locally DONE at `394cee2`; no remote upstream/push target is configured for the new branch.
- Required baseline is independently reviewed: focused Phase 2 script 60/60, `npx tsc --noEmit` exit 0, build transforms 50 renderer / 9 main / 1 preload / 1 spoof, six outputs.
- Original-baseline-identical artifacts at Phase 3 base:
  - renderer JS 289374 / `4DE4C68D...`
  - CSS 71575 / `A5971E30...`
  - `index.html` 988 / `04A5FC2C...`
  - preload 4763 / `874B05A1...`
  - spoof preload 6190 / `1BAEE87F...`
  - main 169306 / `3F426EBB...` after the approved Phase 2 status fix.
- Role source trace: 16 renderer/helper uses of `AI_ROLE_PRESETS`; active main prompts use `AI_REVIEWER_BRIEFS`; `AI_REVIEWER_PERSONAS` and `buildReviewerPrompt()` have definitions but zero call sites.
- Retry trace: `recordCouncilTurnFailure()` writes only `{ ai, promptText, errorMessage }`; `retry-council-turn` calls `enqueueCouncilTurn(ai, promptText)` with no attachments or prebuilt broadcast prompt. Placeholder removal can leave an older `deliveredCount` beyond the current message length.
- Summary trace: `summarizeCouncilMessages()` loops from array start and `break`s at budget, retaining oldest rather than newest messages.
- Kimi trace: Accounts calls `open-login-window`; `STANDALONE_LOGIN_SCRIPTS.kimi` spawns `kimi-login.mjs`; parent stdout handling imports only cookies. The current working route is direct login in the already loaded `persist:kimi` BrowserView.
- Clipboard trace: the shared mutex is correct. Gemini obtains it for every prompt; image fallback holds it across refocus, write/paste, and a two-second observation delay. Composer comparable text removes `\s+`, masking line-only flattening.
- Current EOL contract:
  - CRLF: `electron/main.ts`, `src/types.ts`, `src/App.tsx`, `src/components/AccountsPanel.tsx`.
  - working-tree CRLF with index LF: `electron/councilPrompt.ts`, `kimi-login.mjs`.
  - LF: existing/new verification scripts and feature docs.
- Preserved non-task paths: `_to_delete/` and the two untracked handoff-history files remain untouched and unstaged.

## Technical Decisions

- Canonical roles: extend `AiRolePreset` with `outputGuide`; make `AI_ROLE_PRESETS` contain the current active main brief wording. Main imports/adapts it rather than maintaining prose. Delete only the proven dead persona table/builder.
- Retry storage: use a separate in-memory replay envelope, not `CouncilRoomState`/electron-store. Capture cloned attachment metadata and exact prebuilt prompt at failure time. Public failure UI may expose availability but never paths/content.
- Retry dispatch: extend the serialized enqueue/process boundary to accept the preserved options. Do not reconstruct a broadcast retry through delivered-count delta logic.
- Summary selection: implement a pure newest-fit selector in `electron/councilPrompt.ts`; reverse selected output only after selection.
- Kimi direction: add an App callback to `AccountsPanel`. The Kimi action invokes existing focus/enable logic and closes Accounts. Guard `open-login-window` so the product route cannot accidentally use the child process. Leave root manual Kimi scripts unchanged.
- Gemini insertion: add a dedicated contenteditable line-wise helper. Use browser commands that dispatch real input semantics, verify exact structure, and only then return success. Never set `innerText` directly.
- Readback: normalize CRLF/NBSP/zero-width artifacts, derive line signatures, and require a compatible structure candidate for multiline prompts. Continue checking the exact Siftline identity.
- Clipboard: preserve the single mutex. Add timestamps around queue entry/begin/end. Do not include payload length if it could identify sensitive content beyond existing generic prompt-length logs; never log content/path. Do not implement restoration.
- Image lock: no speculative critical-section shrink in the first implementation slice. Direct Gemini insertion removes routine prompt contention; image fallback latency remains an explicit, measured correctness tradeoff.
- Risk stop: if implementation requires auth/localStorage value transfer, provider-cookie predicate edits, clipboard-content snapshot/restore, schema/dependency/selector change, or a Phase 4 routing decision, stop and return to SPEC/PLAN.

## Slices

| Slice | User-visible goal | AC IDs | Expected paths | Data/API impact | Validation | Rollback | Status |
|---|---|---|---|---|---|---|---|
| S1 — Canonical roles | UI and injected prompts show the same seven specialties; dead Kimi persona disappears. | AC-1, AC-2, AC-13, AC-14 | `src/types.ts`, `electron/main.ts`, focused script | Adds canonical `outputGuide`; no persisted/API data. | Source/runtime role fixture, tsc, build manifest. | Revert S1 commit; no migration. | DRAFT |
| S2 — Recent-first context | Older-context summaries keep what happened nearest to the current round. | AC-5, AC-6, AC-15 | `electron/councilPrompt.ts`, focused script | Pure prompt text selection only. | Budget/order/round fallback fixtures plus Phase 1 regressions. | Revert pure helper/test changes. | DRAFT |
| S3 — Exact retry | Retry resends the original failed operation with attachments rather than a new text-only delta prompt. | AC-3, AC-4, AC-13, AC-14 | `electron/main.ts`, possibly `src/types.ts` for non-sensitive availability, `src/components/CouncilChatPanel.tsx`, focused script | Runtime-only path metadata; no persistence/schema. | Mocked dispatch/restart/missing-file/lifecycle fixtures; controlled recovery UI smoke. | Clear runtime envelope and revert slice. | DRAFT |
| S4 — Kimi panel login | Accounts' Kimi button takes the user to the only working login surface. | AC-7, AC-8, AC-9, AC-13 | `src/components/AccountsPanel.tsx`, `src/App.tsx`, `electron/main.ts`, focused script | UI navigation only; no auth/session value transfer. | Renderer/source fixture and actual Logout → Open panel → user Login → Logged in. | Revert callback/guard; Phase 2 status remains. | DRAFT |
| S5 — Structure-safe Gemini path | Normal Gemini prompts preserve multiline structure without taking clipboard ownership; flattening is detected. | AC-9, AC-10, AC-11, AC-12, AC-14 | `electron/main.ts`, focused script | No clipboard read/restore; timing metadata only. | Pure verifier cases, mocked concurrency, actual Gemini composer structure, existing image-capable-panel regression. | Revert direct helper/metrics; current serialized clipboard fallback remains recoverable. | DRAFT |
| S6 — Integrated test/review packet | Phase 3 is reviewable with honest provider/environment evidence. | AC-1–AC-15 | feature evidence/review docs, HANDOFF, DEV_LOG | Documentation only. | Full commands, staged diff review, independent review. | Revert metadata commit only. | DRAFT |

## Slice Detail

### S1 — Canonical roles

1. Capture the three current role tables and prove the dead builder has zero call sites before deletion.
2. Add `outputGuide` to the canonical type and move the active brief wording into `AI_ROLE_PRESETS` while preserving all seven keys and canonical AI order.
3. Adapt main prompt builders to the canonical fields. Update comments/names so no second prose table is implied.
4. Delete `AI_REVIEWER_PERSONAS` and `buildReviewerPrompt()` as one bounded block; do not touch active final-revision builders.
5. Fixture every UI/prompt consumer against canonical title/detail and assert Kimi is `Long-Context Deep Research Analyst`.

### S2 — Recent-first context

1. Change only `summarizeCouncilMessages()` selection order and preserve final chronological presentation.
2. Add cases where oldest and newest messages cannot both fit, where exactly one line fits, and where selected messages include user/assistant/system speakers.
3. Re-run Phase 1 previous-round/null-bounds fixtures and assert mention-free intent remains `none`.

### S3 — Exact retry

1. Define a runtime-only replay envelope beside `CouncilRuntimeState`; do not add paths or expanded prompts to `CouncilRoomState` or snapshot types.
2. Capture the exact per-AI prompt and cloned attachments before/when dispatch begins, then associate them with the recoverable failure.
3. Retry through the existing `councilTurnChain`, passing the preserved prebuilt prompt, `filePaths`, and `attachedFiles` to `processCouncilTurn()`.
4. Keep replay state on retry failure, replace it only for the same failed operation, and clear it on success/skip/reset/new message/mode handoff.
5. If state is missing after hydration or a file is missing, show actionable recovery text and do not call the send path.
6. Prove retry no longer reads an out-of-range delivery cursor and that successful recovery resets the cursor to current length.

### S4 — Kimi panel login

1. Add `onOpenKimiPanel` to Accounts. For Kimi, render `Open panel`/clear help text instead of promising a standalone Login/Re-login.
2. In App, close Accounts, restore BrowserViews, and call existing focus/enable synchronization for Kimi.
3. Ensure the renderer does not invoke `openLoginWindow('kimi')`; add a defensive main guard. Keep other six standalone scripts/flows unchanged.
4. Do not modify `kimi-login.mjs`, `kimi-login.bat`, renderer storage, status predicates, or logout clearing.
5. Run the real user-visible route; record status booleans only.

### S5 — Structure-safe Gemini path

1. Extend `ComposerVerification` with expected/observed line counts and a structure verdict. Select any readback candidate that fully passes, not merely the first text source.
2. Add negative cases where `A\n\nB` becomes `A B` or `AB`; both must fail despite matching whitespace-free characters.
3. Implement line-wise Gemini insertion using `execCommand('insertText')` for text and supported paragraph/line-break commands for boundaries. Clear/select once, not per line. Dispatch no synthetic flattening rewrite.
4. Use the direct helper before the clipboard path. If it verifies, return without entering `withClipboardLock`; otherwise log structural metrics and use the current serialized compatibility fallback.
5. Add queue-wait and lock-hold timing fields to mutex logs; retain operation/provider identity only.
6. Keep image fallback's current critical section in revision 1. Re-run simultaneous multi-panel image mapping because text and image paths still share the mutex.

### S6 — Integrated validation and review

1. Run the focused Phase 3 script and inspect every assertion/count.
2. Run Electron-inclusive typecheck and production build; compare all six artifacts with the Phase 3 baseline.
3. Run Accounts/Kimi, Council retry, summary/prompt, Gemini structure, and image-capable-panel manual checks. Workflow is not manually exercised because the user retired it, but canonical Workflow prompt construction is covered by fixture/typecheck/build.
4. Perform task-scoped EOL/whitespace/scope/secret scans with CR-at-EOL classified separately under `core.autocrlf=true`.
5. Create local implementation and review-packet commits; request independent review. Do not push.

## Validation Detail

- Typecheck: `npx tsc --noEmit`; require exit 0 and inspect output.
- Focused script: bundle/run `scripts/verify-council-phase3.ts`; include canonical role equality, no dead symbols, summary budgets/order, mention-free intent, exact retry arguments/lifecycle, Kimi route guard, line-structure positives/negatives, and clipboard mutex ordering/timing fields.
- Existing regressions: rerun `scripts/verify-council-phase1.ts` and `scripts/verify-electron-phase2.ts` after rebuilding their temporary bundles; require their existing assertions to remain PASS or explain an intentional canonical-role text update without weakening assertions.
- Build: `npm run build`; expect six outputs and transforms 50/9/1/1. Preload, spoof-preload, CSS, and HTML must remain byte-identical. Renderer and main may change only for approved slices and every artifact delta must be explained before staging.
- Kimi manual: from logged-out state, click Accounts Kimi `Open panel`; verify no child window, Kimi becomes enabled/focused, user logs in in-panel, Accounts later reports true, Logout still reports false. If the user does not perform credentials, record BLOCKED and do not complete S4.
- Gemini manual: insert a known multiline prompt containing identity line, section headers, bullets, blank lines, and final language block; inspect readback/method/line metrics before send. No prompt body enters evidence.
- Retry manual/harness: deterministic mocked failure proves exact args. If an actual provider check is performed, use a disposable small non-sensitive file and visible user action; never force duplicate sends into an external account without confirmation.
- Image mapping: test only image-capable provider panels. DeepSeek remains excluded for the documented provider limitation. Verify target-image correspondence under concurrent Council fan-out.
- EOL: `git ls-files --eol` before/after for every touched surgical path. Preserve main/types/App/Accounts CRLF, Council prompt working-tree CRLF, and new script/docs LF. Reject whole-file rewrites before staging.
- Whitespace: run raw task-scoped `git diff --check -- <task paths>`, record raw line/finding counts, classify terminal CR-only findings, and require `git -c core.whitespace=cr-at-eol diff --check -- <task paths>` exit 0.
- Scope: inspect `git diff --ignore-cr-at-eol --stat`, full task diff, and cached diff after exact-path staging. Forbidden changes: package/lock, selectors, schema, `.gitattributes`, Phase 4 routing, user-owned handoff-history files, `_to_delete/`.
- Secret/data scan: inspect task diff for credential/token/private-key patterns, localStorage/cookie value transport, absolute retry paths in persistence/logging, clipboard reads/restoration, and prompt/image bodies in timing logs. Expected actionable count 0.
- PASS rule: actual outputs must be inspected. Provider-dependent checks are PASS only with observed behavior; otherwise BLOCKED, never inferred from fixtures.

## Dependencies / Assumptions

- Existing Electron/Chromium still supports the already used `execCommand` insertion APIs. The direct Gemini slice must prove line/paragraph commands in the actual composer before replacing clipboard-primary as the normal path.
- All seven BrowserViews are created/loaded at startup even when disabled; existing focus/enable synchronization can expose Kimi without a new session or hidden view.
- Current `persist:kimi` direct login remains the working provider path. Phase 2 boolean-only status detection and logout clearing stay intact.
- Retry attachment paths remain valid only within the live app session. The product will ask for reattachment rather than persist local paths.
- No user decision exists for mention-free routing; current transcript-only behavior is a locked regression expectation.

## Non-Goals

- No localStorage/token/cookie transfer redesign, auth predicate normalization, clipboard restoration, schema migration, dependency upgrade, selector update, provider addition, or EOL policy.
- No multiple-failure recovery queue or `pendingAi` redesign.
- No single-target peer-copy cleanup or IPC/Telegram send-handler deduplication.
- No mention-free default `@all`/primary routing; that remains Phase 4.
- No Workflow product enhancement or manual regression requirement beyond shared prompt/type/build coverage.
- No push, PR, merge, rebase, tag, release, deploy, or external notification.

## Approval Bundle

- Mode: STANDARD_BUNDLE
- Bundle ID: `council-chat-phase3-defect-fixes-R1`
- SPEC Revision approved: PENDING
- PLAN Revision approved: PENDING
- Decision: PENDING
- User message: N/A — awaiting explicit approval of SPEC revision 1 and PLAN revision 1.
- Constraints / expiry: Approval, if granted, covers only S1–S6 above. Any authentication/storage-value transfer, clipboard content read/restore, persistent retry paths/prompts, dependency/selector/schema/EOL-policy change, Phase 4 routing, push, PR, tag, release, or deploy invalidates it and requires a revised approval.

## High PLAN Approval

- Decision: N/A
- User message: N/A
- Constraints: N/A

## Revision History

- Revision 1 (2026-08-03): Initial plan for canonical roles/dead-code removal, exact runtime-only retry with attachments, recent-first context, embedded Kimi login navigation, and structure-aware Gemini insertion/readback with the existing mutex retained for fallbacks.
