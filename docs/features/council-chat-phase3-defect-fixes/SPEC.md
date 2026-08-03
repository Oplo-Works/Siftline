# SPEC: Council Chat Phase 3 Reliability and Login UX

- Feature ID: `council-chat-phase3-defect-fixes`
- Risk: Standard
- Bundle ID: `council-chat-phase3-defect-fixes-R1`
- SPEC Revision: 1
- Status: DONE — WF:CLOSE
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

- P3-B — make `src/types.ts` the sole role-definition source. One `AI_ROLE_PRESETS` object holds a short UI `title`, long prompt `role`, `focus`, and `outputGuide` for every provider. Preserve the current short UI titles and the active `AI_REVIEWER_BRIEFS` prompt semantics, then delete `AI_REVIEWER_PERSONAS` plus unused `buildReviewerPrompt()`.
- P3-C — capture a runtime-only replay envelope for a failed Council turn: exact per-AI prebuilt prompt when applicable, user text, file paths, sanitized attached-file metadata, and dispatch mode. Retry must use that envelope through the normal serialized turn queue.
- P3-C failure boundary — never persist attachment paths, file contents, or expanded prompts in Saved Sessions. If exact live replay state is unavailable after restart/snapshot hydration, do not silently send a text-only or differently structured retry; require the user to reattach and resend.
- P3-D — select summary messages newest-first within the character budget, then render the selected messages in chronological order. Keep the existing per-message snippet bound and deterministic/offline behavior.
- Kimi Accounts login — choose direction (a): close Accounts, enable Kimi if needed, and expose the existing embedded `persist:kimi` panel while preserving the current Council `primaryAi`. Use an explicit Kimi-specific button label/help text. The Accounts action must not spawn `kimi-login.mjs` or call the cookie-only standalone transport.
- Clipboard/readback hardening:
  - add observation-only line-structure metrics to composer verification before changing any provider's pass/fail gate. A line signature is the ordered sequence of non-empty trimmed lines, so harmless blank-line folding passes while flattening distinct non-empty lines fails;
  - measure all seven providers in the actual composers and record expected/observed signature counts, digests, and verdicts without prompt bodies. Only a provider with recorded stable fidelity may later have structure enforced; no unmeasured provider may be blocked by the new metric;
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
- `AI_ROLE_PRESETS` retains its exported name and becomes `Record<AiName, { title, role, focus, outputGuide }>`. `title` remains the existing compact UI wording; `role`, `focus`, and `outputGuide` contain the active prompt truth. Electron main consumes those fields directly without copying prose.
- Candidate Compare, Toolbar, Council Chat, Moderator, and Council/Workflow handoff consume the same canonical object but use the field appropriate to their surface. Human-facing missing-angle text uses the short `title`; the moderator's next-speaker prompt uses the long `role`. The Phase 1 Kimi moderator fixture will continue to assert the exact long role and will not be weakened.
- UI title before/after is intentionally byte-for-byte unchanged: ChatGPT `Versatile Creative Generalist`, Claude `Long-Document Analyst`, DeepSeek `Technical Reasoning Solver`, Gemini `Multimodal Context Synthesizer`, Grok `Real-Time Reality Critic`, Kimi `Long-Context Deep Analyst`, and Perplexity `Source-Grounded Verifier`.
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
- The supported product action is therefore `Open Kimi panel`, not an apparently successful isolated login. It closes Accounts, activates Kimi, and exposes Kimi through a dedicated App state/layout path so the user logs in directly in `persist:kimi`.
- The dedicated path must preserve the Council `primaryAi` observed immediately before the action; it must not call the existing focus handler that passes `primaryAi: kimi`. Other six providers keep their current standalone login behavior.
- `kimi-login.mjs`/`kimi-login.bat` are not deleted in this bundle because they are root-level manual helpers; the Accounts product path simply must not invoke them.

### Clipboard observations

- Observation 1 (lock latency): the routine source is Gemini's clipboard-primary prompt. A verified structured direct path removes that routine lock acquisition. Image clipboard fallback remains serialized for correctness; duration is measured, not guessed.
- Observation 2 (clipboard ownership): automatic restoration is rejected in revision 1. The direct Gemini path reduces normal overwrites; compatibility/image fallback can still overwrite the clipboard and must be truthfully logged as a fallback.
- Observation 3 (flattening invisibility): first emit non-blocking structural observations for every provider. The signature is the ordered sequence of non-empty trimmed lines after CRLF/NBSP/zero-width normalization. Logs contain only expected/observed counts, digests, and verdicts, never the prompt body. After all seven real composers are measured, enforcement is enabled only for explicitly evidenced stable providers; existing identity/comparable verification remains the gate elsewhere.
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
- A provider readback exposes only flattened `textContent` for multiline input: record the mismatch during the observation phase without failing that provider turn. Do not enforce structure for that provider unless another actual readback candidate is measured stable.
- A provider folds `A\n\nB` to `A\nB`: both normalize to the non-empty-line signature `[A, B]`, so the harmless blank-line fold passes. Flattening to `A B` produces `[A B]` and is detected.
- Clipboard image fallback and prompt fallback overlap: the existing module-wide mutex preserves target/payload correspondence. Timing instrumentation must not shorten the protected interval by itself.
- Kimi is disabled when Accounts is open: the panel action adds it to enabled AIs and exposes its panel without changing Council primary; no child login process is spawned.
- Kimi page is unavailable: the panel remains visible with provider/network failure state; Accounts does not fabricate a successful login.

## Acceptance Criteria

| ID | Observable criterion | Verification | Status |
|---|---|---|---|
| AC-1 | Exactly one seven-provider role object remains with short `title` and long `role` plus `focus`/`outputGuide`. Existing compact UI titles remain unchanged; injected Council/Workflow roles derive from the long fields and Kimi remains the long-context research role. | `rg`, focused source/runtime fixtures, and UI/prompt inspection. | PASS |
| AC-2 | `AI_REVIEWER_PERSONAS` and unused `buildReviewerPrompt()` are absent with no orphan references or behaviorally different duplicate role prose. | Scoped source search, typecheck, build. | PASS |
| AC-3 | A live failed turn retries with the same per-AI prompt mode and the same attachment paths/metadata; no attachment is silently dropped. | Mocked orchestration fixture plus controlled app recovery check. | PASS |
| AC-4 | Retry state is runtime-only, cleared on lifecycle boundaries, and never persisted/logged. Missing replay state or missing files produces an actionable failure instead of a text-only send. | Persistence/source fixture, scoped secret/path scan, UI failure check. | PASS |
| AC-5 | Bounded summaries retain the newest complete messages and emit the retained subset in chronological order. | Pure fixtures covering mixed speakers and multiple budgets. | PASS |
| AC-6 | Previous-round extraction and null-bounds earlier-context fallback still pass while their older summary uses the recent-first policy. | Existing Phase 1 fixtures plus new regression cases. | PASS |
| AC-7 | Accounts Kimi action closes the modal, enables/exposes Kimi, and shows the embedded login surface without spawning/calling the standalone path; Council `primaryAi` is identical immediately before and after the action. | Renderer fixture and actual user-visible run with before/after primary observation. | PASS |
| AC-8 | Other six Accounts login/logout actions and Kimi logout/status transitions retain their Phase 2 behavior. | Source contract fixture and manual smoke; Kimi user action if required. | PASS |
| AC-9 | No auth/localStorage/cookie value or previous clipboard value crosses a new boundary, enters logs/evidence, or is persisted. | Source review and task-diff secret/value scan. | PASS |
| AC-10 | After all-seven observation, Gemini's measured normal multiline prompt preserves headers, bullets, non-empty-line boundaries, and final language-rule separation through the direct path without acquiring the clipboard lock; Gemini structure enforcement is enabled only from that evidence. | Focused insertion fixture and actual composer readback before send. | PASS |
| AC-11 | The non-empty-trimmed-line signature detects `A\n\nB` flattened to `A B`, even when whitespace-free characters and identity match, while harmless folding to `A\nB` and single-line/provider-compatible inputs pass. | Positive/negative verifier fixtures with line metrics. | PASS |
| AC-12 | Before any structure gate changes, expected/observed signature metrics are recorded for all seven real providers. Only measured-stable providers may be explicitly enforced. Compatibility text/image fallbacks remain serialized; panel-image correspondence does not regress; wait/hold timing is content-free. | Seven-provider observation matrix, concurrency fixture, image-capable-panel regression, log-field inspection. | PASS — exact retained metrics for Gemini/Kimi; other providers remain observe-only. |
| AC-13 | Electron-inclusive typecheck exits 0 and production build keeps six outputs and transform topology 50/9/1/1. Preload/spoof remain byte-identical; renderer/main changes are fully attributable. When approved renderer code changes, `index.html` may change only to reference the new content-hashed renderer asset filename. | `npx tsc --noEmit`, `npm run build`, SHA-256 manifest and asset-reference comparison. | PASS |
| AC-14 | Target EOLs are preserved, actionable whitespace and secret findings are 0, and no dependency/lock/selector/schema/`.gitattributes`/Phase 4 path changes appear. | Task-scoped diff/EOL/secret checks before and after staging. | PASS |
| AC-15 | Mention-free Council messages remain transcript-only; no default `@all` or default-primary routing is introduced. | Existing intent fixture and source diff inspection. | PASS |

## Approval

- Mode: STANDARD_BUNDLE_IN_PLAN
- Standard ledger: `docs/features/council-chat-phase3-defect-fixes/PLAN.md#approval-bundle`
- High decision: N/A
- User message: 2026-08-03 — user explicitly approved SPEC revision 1 and PLAN revision 1, required the three documented BUILD-time conditions, waived reapproval for those conditions, and directed BUILD.

## Revision History

- Revision 1 (2026-08-03): Initial Phase 3 bundle. Consolidates roles, specifies exact runtime-only retry with attachments, makes summaries recent-first, selects embedded Kimi-panel login without auth transfer, and defines structure-aware Gemini insertion/readback. Explicitly excludes clipboard restoration, auth predicate/storage transfer, and mention-free default routing.
- Revision 1 approved conditions (2026-08-03): keep structural metrics observation-only until all seven providers are measured, define signatures as ordered non-empty trimmed lines and add harmless-fold coverage, preserve `primaryAi` when opening Kimi, and split canonical short UI `title` from long prompt `role` in the same object. Approval remains valid; no revision increment or reapproval is required.
- Revision 1 close correction (2026-08-03): independent review confirmed that renderer changes legitimately rename Vite's content-hashed JS asset and therefore update only the corresponding `index.html` script reference. The earlier byte-identical-HTML expectation was inherited incorrectly from the Electron-only Phase 2 bundle; scope and design are unchanged.
