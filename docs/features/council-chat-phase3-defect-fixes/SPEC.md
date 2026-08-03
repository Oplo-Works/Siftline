# SPEC: Council Chat Phase 3 Reliability and Login UX

- Feature ID: `council-chat-phase3-defect-fixes`
- Risk: Standard
- Bundle ID: `council-chat-phase3-defect-fixes-R1`
- SPEC Revision: 1
- Status: READY_FOR_APPROVAL
- Last Updated: 2026-08-03

## Context / User / Goal

- Context: Phase 1 fixed parallel prompt/attachment clipboard races, previous-round discovery, and Korean moderator behavior. Phase 2 closed at `394cee2` after independently reviewed Electron type coverage and current Kimi status detection. The remaining Phase 3 findings are independent reliability and UX defects rather than continuations of either implementation.
- User: The single local Siftline user, who primarily uses Council Chat and does not use Workflow as a normal product flow.
- Goal: remove divergent role definitions and dead prompt code, make Retry replay the failed turn including attachments, retain the newest context under budget, replace the nonworking Accounts Kimi login launcher with the working embedded-panel route, and harden prompt structure verification while reducing normal Gemini clipboard ownership.
- Current behavior:
  - Role text exists in `src/types.ts:AI_ROLE_PRESETS`, active `electron/main.ts:AI_REVIEWER_BRIEFS`, and dead `AI_REVIEWER_PERSONAS`; the dead Kimi persona is materially different.
  - `CouncilFailedTurn` stores only AI, user text, and error. Retry rebuilds a legacy delta prompt through `enqueueCouncilTurn()` and loses both attachment arrays and the exact broadcast prompt.
  - `summarizeCouncilMessages()` iterates oldest-first and stops at the budget, so the nearest context is discarded first.
  - Accounts launches Kimi in a standalone process. Its completion transport returns/imports cookies only, while current Kimi authentication lives in renderer storage. Direct login in the existing `persist:kimi` panel works.
  - Gemini's ordinary multi-line prompt uses the OS clipboard under the shared lock; readback removes all whitespace and therefore cannot detect line-break-only flattening.
- Desired behavior: every consumer observes one role definition, live Retry is an exact replay, summaries keep the newest useful messages in chronological presentation, the Kimi button opens the working panel route without moving authentication data, and multiline structure is verified rather than inferred from whitespace-free text.

## In Scope / Out of Scope

### In Scope

- P3-B — make `src/types.ts` the sole role-definition source. Preserve the active `AI_REVIEWER_BRIEFS` semantics as canonical, expose the same title/focus to UI consumers, add the review output guide to the canonical type, and delete `AI_REVIEWER_PERSONAS` plus unused `buildReviewerPrompt()`.
- P3-C — capture a runtime-only replay envelope for a failed Council turn: exact per-AI prebuilt prompt when applicable, user text, file paths, sanitized attached-file metadata, and dispatch mode. Retry must use that envelope through the normal serialized turn queue.
- P3-C failure boundary — never persist attachment paths, file contents, or expanded prompts in Saved Sessions. If exact live replay state is unavailable after restart/snapshot hydration, do not silently send a text-only or differently structured retry; require the user to reattach and resend.
- P3-D — select summary messages newest-first within the character budget, then render the selected messages in chronological order. Keep the existing per-message snippet bound and deterministic/offline behavior.
- Kimi Accounts login — choose direction (a): close Accounts, enable Kimi if needed, and focus the existing embedded `persist:kimi` panel. Use an explicit Kimi-specific button label/help text. The Accounts action must not spawn `kimi-login.mjs` or call the cookie-only standalone transport.
- Clipboard/readback hardening:
  - add line-structure metrics to composer verification; whitespace-insensitive equality remains a secondary compatibility signal and cannot by itself pass a multiline prompt;
  - add a Gemini structure-preserving direct insertion path using line-wise `insertText` plus browser-supported paragraph/line-break commands, verified before send;
  - retain the module-wide mutex for the compatibility text fallback and image clipboard fallback;
  - record lock wait/hold duration without recording clipboard contents;
  - keep the image fallback's conservative serialized observation window unless actual provider evidence proves a smaller critical section preserves panel-image correspondence.
- Add a focused Phase 3 verification script and evidence/review packet.

### Explicitly Out of Scope

- Do not copy, serialize, return, log, or inspect Kimi localStorage values. Do not build renderer-storage transfer between processes. That candidate is rejected for this revision; proposing it changes the bundle to High risk and requires a new SPEC.
- Do not broaden `isLoginComplete()`, `getLoginStatus()`, or any provider authentication predicate. The Kimi status fix from Phase 2 remains unchanged.
- Do not automatically restore the user's previous OS clipboard. Doing so would read arbitrary clipboard data and can overwrite a newer user copy; it requires a separate data/race policy. This revision reduces routine clipboard use instead.
- Do not change mention-free message routing. It remains transcript-only until the user makes the separate Phase 4 product decision.
- Do not include the other Phase 4 items: single-target peer wording, `pendingAi` redesign, UI copy cleanup, or IPC/Telegram handler deduplication.
- Do not change selectors, dependencies, package/lock files, schema versions, `.gitattributes`, repository-wide EOL, provider count, Workflow behavior, Telegram routing, release, deploy, tag, push, or PR.

## Affected Areas

- Canonical types/roles: `src/types.ts`; role consumers in renderer helpers/components and Electron main.
- Council runtime: `electron/main.ts` retry envelope/orchestration, Kimi login routing guard, Gemini insertion/readback, and clipboard timing metadata.
- Council prompt helpers: `electron/councilPrompt.ts` recent-first summary selection.
- Accounts UI: `src/components/AccountsPanel.tsx` and `src/App.tsx` embedded Kimi-panel action.
- Verification/docs: new `scripts/verify-council-phase3.ts`, Phase 3 evidence and review request, HANDOFF, and DEV_LOG.
- No persisted schema change. Runtime-only replay state is cleared on reset, skip, successful recovery, new user turn, mode handoff, and app restart.

## Security · Privacy · Data

- Data class: internal source, synthetic Council messages, local attachment path metadata already supplied by the user, and provider-independent test fixtures.
- Kimi boundary: the Accounts action changes local UI navigation only. It neither reads nor transfers authentication storage. Existing Phase 2 boolean-only status evaluation remains the only Kimi renderer-auth observation.
- Retry boundary: absolute file paths may exist only in current-process memory for the live retry. They must not enter Council messages, snapshots, logs, evidence, or Git. File contents remain on the existing attachment path and are not duplicated into retry metadata.
- Clipboard boundary: no previous clipboard value is read, persisted, restored, or logged. Timing logs contain operation ID/type/provider and durations only. Prompt/image content and file paths are excluded.
- Risk remains Standard only because the selected Kimi solution is UI routing to an existing persistent panel and no authentication/session data boundary changes. Any storage transfer, auth predicate modification, clipboard-content snapshot, or persistence expansion invalidates this bundle and requires a new risk review/approval.
- No external message is sent by automated verification. Provider-facing manual checks require the user's existing sessions and explicit visible action.

## Design Decisions and Findings

### P3-B — Canonical role definitions

- The active prompt truth is `AI_REVIEWER_BRIEFS`: Gemini multimodal broad context; Claude long-document reasoning/drafting; ChatGPT creative communication; Perplexity source-grounded verification with citations; Grok current/trend adversarial reality; DeepSeek first-principles technical reasoning; Kimi long-context research.
- `AI_ROLE_PRESETS` will retain its exported name for renderer compatibility but its `title`, `detail`, and new `outputGuide` will contain the active truth. Electron main will adapt those fields to prompt helper inputs without copying text.
- UI-visible role wording will intentionally align with the actual injected role. Candidate Compare, Moderator, Council/Workflow handoff, Toolbar, and Council Chat must all consume the same canonical object.
- `AI_REVIEWER_PERSONAS` and `buildReviewerPrompt()` have no call sites and are deleted. Kimi must not retain the dead `Agentic Execution Architect` identity.

### P3-C — Exact live retry

- The displayed/persisted `CouncilFailedTurn` remains non-sensitive. Exact retry material lives in a separate runtime-only structure and is cloned when captured so later UI mutation cannot alter it.
- Broadcast failure capture keeps the exact `promptByAi` entry and both attachment representations. Single-target failures retain their exact built prompt/dispatch form as well.
- Retry re-enters `councilTurnChain` and calls the same `processCouncilTurn()` path with the preserved prebuilt prompt and attachments. A successful retry sets `deliveredCount` from the current transcript length.
- Placeholder cleanup cannot be used as a delivery cursor. No retry may rely on an out-of-range `deliveredCount` or silently produce `No recent transcript.`
- Multiple-failure UI redesign remains out of scope; the existing single recovery card may represent only the currently recoverable failure. This must be documented and must not corrupt another in-flight replay.

### P3-D — Recent-first summary

- Build bounded lines from the end of the input until adding another complete line would exceed the budget, then reverse the selected set for readable chronological output.
- Do not reverse message text, truncate from the wrong end, or reorder speakers. A single line still uses the existing 220-character snippet limit.
- `summarizeContextBeforePreviousRound()` retains the Phase 1 valid-round discovery and null-bounds fallback; only its delegated budget selection changes.

### Kimi Accounts login route

- `copyCookiesToMainSession()` and standalone child stdout import copy cookies only. Current Kimi localStorage is not transferred into the already running parent BrowserView.
- The supported product action is therefore `Open Kimi panel`, not an apparently successful isolated login. It closes Accounts, activates Kimi, and focuses Kimi through existing App state/layout functions so the user logs in directly in `persist:kimi`.
- Changing Focus may make Kimi the current Council primary; the label/help text must make the navigation explicit. Other six providers keep their current standalone login behavior.
- `kimi-login.mjs`/`kimi-login.bat` are not deleted in this bundle because they are root-level manual helpers; the Accounts product path simply must not invoke them.

### Clipboard observations

- Observation 1 (lock latency): the routine source is Gemini's clipboard-primary prompt. A verified structured direct path removes that routine lock acquisition. Image clipboard fallback remains serialized for correctness; duration is measured, not guessed.
- Observation 2 (clipboard ownership): automatic restoration is rejected in revision 1. The direct Gemini path reduces normal overwrites; compatibility/image fallback can still overwrite the clipboard and must be truthfully logged as a fallback.
- Observation 3 (flattening invisibility): verifier success for multiline input requires structure agreement in addition to identity and comparable characters. Expected/observed line counts and structure verdicts are logged, never the prompt body.
- If Gemini's structured insertion cannot preserve headers, bullets, blank-line section boundaries, and the final language block in the real composer, keep the existing serialized fallback and mark the direct-path AC FAIL; do not flatten or claim the clipboard issue solved.

## Deferred Nonblocking Observations

- Kimi status depends on the live BrowserView. A network/provider load failure can display false despite persisted authentication. This is recorded as a later candidate; no hidden view, retry polling, or authorization use is added here.
- `cookieDomainIncludes()` uses substring matching while Kimi cookie/page helpers use exact suffix matching. Provider-wide cookie-domain normalization is an authentication change and remains a separate High-risk candidate.

## Edge Cases / Failure Behavior

- Role table gains/reorders a provider: TypeScript's `Record<AiName, ...>` and the canonical-order fixture fail until every role is present.
- Attached live turn fails after its placeholder is removed: Retry still has the cloned file arrays and exact prompt; cursor length drift does not affect the replay.
- App restarts before Retry: no file path or expanded prompt is recovered from disk; UI refuses misleading replay and asks for a fresh send.
- A retry attachment was moved/deleted: existing attachment processing fails visibly and retains recovery state; it must not send a successful-looking text-only substitute.
- Summary budget fits only the newest line(s): keep those lines and render them in original order.
- Gemini direct insertion returns true but drops line breaks: structural verification fails and the operation uses the serialized compatibility fallback.
- A provider readback exposes only flattened `textContent` for multiline input: that candidate cannot establish structure; another readback candidate must pass or verification fails.
- Clipboard image fallback and prompt fallback overlap: the existing module-wide mutex preserves target/payload correspondence. Timing instrumentation must not shorten the protected interval by itself.
- Kimi is disabled when Accounts is open: the panel action adds it to enabled AIs and focuses it; no child login process is spawned.
- Kimi page is unavailable: the panel remains visible with provider/network failure state; Accounts does not fabricate a successful login.

## Acceptance Criteria

| ID | Observable criterion | Verification | Status |
|---|---|---|---|
| AC-1 | Exactly one seven-provider role text table remains. UI role titles/details and injected Council/Workflow roles derive from it; Kimi is the long-context research role. | `rg`, focused source/runtime fixtures, and UI/prompt inspection. | Pending |
| AC-2 | `AI_REVIEWER_PERSONAS` and unused `buildReviewerPrompt()` are absent with no orphan references or behaviorally different duplicate role prose. | Scoped source search, typecheck, build. | Pending |
| AC-3 | A live failed turn retries with the same per-AI prompt mode and the same attachment paths/metadata; no attachment is silently dropped. | Mocked orchestration fixture plus controlled app recovery check. | Pending |
| AC-4 | Retry state is runtime-only, cleared on lifecycle boundaries, and never persisted/logged. Missing replay state or missing files produces an actionable failure instead of a text-only send. | Persistence/source fixture, scoped secret/path scan, UI failure check. | Pending |
| AC-5 | Bounded summaries retain the newest complete messages and emit the retained subset in chronological order. | Pure fixtures covering mixed speakers and multiple budgets. | Pending |
| AC-6 | Previous-round extraction and null-bounds earlier-context fallback still pass while their older summary uses the recent-first policy. | Existing Phase 1 fixtures plus new regression cases. | Pending |
| AC-7 | Accounts Kimi action closes the modal, enables/focuses Kimi, and shows the embedded login surface; it does not spawn/call the standalone Kimi login path. | Renderer fixture and actual user-visible run. | Pending |
| AC-8 | Other six Accounts login/logout actions and Kimi logout/status transitions retain their Phase 2 behavior. | Source contract fixture and manual smoke; Kimi user action if required. | Pending |
| AC-9 | No auth/localStorage/cookie value or previous clipboard value crosses a new boundary, enters logs/evidence, or is persisted. | Source review and task-diff secret/value scan. | Pending |
| AC-10 | Gemini's normal multiline prompt preserves headers, bullets, blank lines, and final language-rule separation through the direct path without acquiring the clipboard lock. | Focused insertion fixture and actual composer readback before send. | Pending |
| AC-11 | A flattened multiline readback fails even when whitespace-free characters and identity match; single-line/provider-compatible inputs still pass. | Positive/negative verifier fixtures with line metrics. | Pending |
| AC-12 | Compatibility text/image clipboard fallbacks remain serialized and panel-image correspondence does not regress; wait/hold timing is reported without content. | Concurrency fixture, image-capable-panel regression, log-field inspection. | Pending |
| AC-13 | Electron-inclusive typecheck exits 0 and production build keeps six outputs and transform topology 50/9/1/1. Preload/spoof remain byte-identical; renderer/main changes are fully attributable. | `npx tsc --noEmit`, `npm run build`, SHA-256 manifest. | Pending |
| AC-14 | Target EOLs are preserved, actionable whitespace and secret findings are 0, and no dependency/lock/selector/schema/`.gitattributes`/Phase 4 path changes appear. | Task-scoped diff/EOL/secret checks before and after staging. | Pending |
| AC-15 | Mention-free Council messages remain transcript-only; no default `@all` or default-primary routing is introduced. | Existing intent fixture and source diff inspection. | Pending |

## Approval

- Mode: STANDARD_BUNDLE_IN_PLAN
- Standard ledger: `docs/features/council-chat-phase3-defect-fixes/PLAN.md#approval-bundle`
- High decision: N/A
- User message: N/A — revision 1 is awaiting explicit approval together with PLAN revision 1.

## Revision History

- Revision 1 (2026-08-03): Initial Phase 3 bundle. Consolidates roles, specifies exact runtime-only retry with attachments, makes summaries recent-first, selects embedded Kimi-panel login without auth transfer, and defines structure-aware Gemini insertion/readback. Explicitly excludes clipboard restoration, auth predicate/storage transfer, and mention-free default routing.
