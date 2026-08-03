# PLAN: Council Chat Phase 1 Defect Fixes

- Feature ID: `council-chat-phase1-defect-fixes`
- Risk: Standard
- Bundle ID: `council-chat-phase1-defect-fixes-R4`
- PLAN Revision: 4
- SPEC: `docs/features/council-chat-phase1-defect-fixes/SPEC.md`, revision 4, APPROVED
- Status: DONE
- Base Branch/Commit: `main` / `b753232768f466f9130834c6e5a25b4d50c0cd1b`; planning branch `codex/council-chat-phase1-defect-fixes`

## Baseline

- Existing behavior:
  - `runCouncilBroadcast()` snapshots the transcript, creates all placeholders, builds one persona-specific prompt per target, and executes the target turns with `Promise.allSettled`.
  - `pasteText()` retains DeepSeek native focus handling, gives only Kimi an `execCommand` path, then uses the process-wide clipboard for all other targets and silently ignores verification/fallback results.
  - `attachFilesViaClipboardPaste()` also uses the process-wide clipboard in an awaited per-image loop. Its `writeImage`/`paste()` sequence can interleave with parallel attachment turns and with `pasteText()` fallback.
  - `extractPreviousRoundReplies()` and `summarizeContextBeforePreviousRound()` independently use the second-to-last user index.
  - `buildCouncilModeratorSnapshot()` scans up to six recent assistant replies with English keyword regexes and has no Kimi speaker-order branch.
- Existing failures:
  - Clipboard writes can cross between parallel panels, and the shared 32-character prompt prefix masks the wrong persona.
  - Parallel image clipboard fallbacks can paste the wrong/duplicate image into a panel or race with prompt text in the same global clipboard.
  - One or more unaddressed notes erase the dedicated previous-round block.
  - Korean replies fall through signal classification; Kimi cannot be proposed for missing deep-research coverage.
- Baseline ownership:
  - The actual repository root is `C:\Users\Sales01\Documents\AI-Council-Chat`. `main` matched `origin/main` at `b753232768f466f9130834c6e5a25b4d50c0cd1b` when planning began; the task branch has no upstream.
  - `CLAUDE.md` and the stale HANDOFF name `C:\Users\parkm\Documents\AI-Council-Chat` as the main worktree, while `PROJECT_SCOPE.md` calls a `C:\Users\Sales01\...` path in the legacy verification document outdated. Those path statements do not match the current runtime root. This bundle records the mismatch only and does not edit those documents.
  - Pre-existing user-owned untracked path `docs/handoff_history/HANDOFF_PROMPT_council_chat_fixes.md` is excluded from all task operations.
  - The previous HANDOFF is stale for branch/head/path context and will not be overwritten until the next workflow metadata boundary.
  - There is no `.gitattributes`. Git reports `electron/councilPrompt.ts` as index LF / working-tree CRLF, and the broader checkout emits EOL-conversion warnings. `git diff --ignore-cr-at-eol --stat` is empty at the planning baseline.
- Commands from `docs/PROJECT_SCOPE.md`:
  - Typecheck: `npx tsc --noEmit`
  - Build: `npm run build`
  - Manual run: `build-and-run.bat`
  - Recommended production run: `npx electron .`
  - Secret/diff check for this bundle: task-owned staged diff inspection with `git diff --cached --ignore-cr-at-eol`, task-scoped `git diff --check -- <task paths>` with CR-at-EOL-only findings separated from actionable whitespace, and target `git ls-files --eol` inspection. Every PASS claim requires inspection of actual output and at least the raw/excluded/actionable counts in `TEST_EVIDENCE.md`.

## Technical Decisions

- P1 selects approach A as the normal prompt path for every non-Gemini provider because DOM insertion removes the shared global resource and preserves parallel fan-out. Gemini is the approved compatibility exception: measured multi-line `insertText` retained only its first line, so the shared-mutex clipboard operation is its structure-preserving normal path. Approach B remains the compatibility fallback for other providers and shares one module-scoped promise mutex with image attachment operations.
- The shared mutex covers each complete critical section, including awaited gaps: `writeText` through keyboard paste/readback for prompt fallback, and `writeImage` through `webContents.paste()` plus its settle wait for each image. Lock release remains in `finally` so a failed panel cannot deadlock later turns.
- Injection success is based on readback, not an API return value. Normalize line endings conservatively, verify the expected text, and for Council prompts additionally verify the exact panel-specific identity line. Do not log prompt contents.
- Preserve the native click before insertion. Non-Gemini fallback order is: direct insertion and verify; serialized clipboard and verify; native setter/events for eligible textarea/input and verify; otherwise error and throw. Gemini starts with serialized clipboard and verification. Kimi prompts over 4000 bytes skip clipboard entirely.
- Introduce one pure `findPreviousRoundBounds()` helper. It scans completed user-bounded segments backward from the current user message until it finds a segment with a valid assistant reply. It returns enough bounds to let extraction read that segment and summarization combine context before the segment with skipped note segments after it. When no valid segment exists, summarization retains the legacy second-to-last-user cutoff so earlier background is not erased.
- Korean signals use separate non-`\b` regexes ORed with the existing English regexes. Kimi gets a dedicated long-context/deep-research signal. English patterns and decision precedence remain unchanged.
- No dependency, selector, persisted state, IPC contract, or role-table consolidation is included.
- Preserve the existing working-tree EOL style of every edited tracked file. Keep `electron/councilPrompt.ts` as CRLF and preserve the exact pre-edit line-by-line mixed EOL pattern of `src/councilModerator.ts` for all unchanged lines; new/replaced lines use the local surrounding style without normalizing the file. Reject a 394/394, 163/163, or other whole-file EOL-only rewrite. Do not add `.gitattributes` or normalize the 75-file checkout in Phase 1.

## Slices

| Slice | User-visible goal | AC IDs | Expected paths | Data/API impact | Validation | Rollback | Status |
|---|---|---|---|---|---|---|---|
| S1 — Safe prompt and image clipboard operations | Each target receives and verifies its own prompt before Send, while Gemini's normal prompt path and every fallback cannot race through the global clipboard. | AC-1, AC-2, AC-3, AC-4, AC-5, AC-13 | `electron/main.ts` | No contract/schema change; shared injection behavior changes for Workflow/Council paths and serializes Gemini/text fallback/image critical sections. | Forced direct/fallback/mismatch concurrency trace; seven-AI `@all`; distinct-image parallel fallback across image-capable panels; DeepSeek, Perplexity, Kimi checks; three-stage Workflow smoke. | Revert only the S1 task-owned commit/hunk; no reset/restore of user work. | DONE |
| S2 — Answered-round discovery | Notes no longer hide the last answered round and remain available as context. | AC-6, AC-7, AC-8 | `electron/councilPrompt.ts`; temporary/persistent focused verification harness as approved during BUILD | Pure prompt interpretation only; no persisted transcript change. | Fixture matrix for one note, multiple notes, first round, pending/error/blank, dedupe, and earlier-summary retention. | Revert the helper and its two call sites together. | DONE |
| S3 — Bilingual moderator and Kimi | Korean discussions produce useful moderator classifications and Kimi can fill a missing deep-research angle. | AC-9, AC-10, AC-11 | `src/councilModerator.ts`; focused verification harness | No state/API change; deterministic heuristic outputs change. | Capture English expected outputs before edit; run English/Korean/mixed, concise-boundary, Kimi-enabled/disabled/recent-speaker fixtures; `npx tsc --noEmit`. | Revert Korean/Kimi signal changes as one slice. | DONE |
| S4 — Integrated regression evidence | Phase 1 is reviewable with honest automated and manual evidence and no must-preserve regression. | AC-12 plus all prior ACs | `docs/features/council-chat-phase1-defect-fixes/TEST_EVIDENCE.md`, then review/close artifacts required by workflow; `docs/DEV_LOG.md`, `docs/HANDOFF.md` only at their metadata boundaries | Documentation only; no credentials or real transcripts recorded. | Typecheck, build, diff/secret scan, actual app checks, full minimum regression checklist, independent REVIEW. | Revert metadata only if factually incorrect; preserve implementation evidence/history. | DONE (Opus 5 independent PASS; Telegram externally blocked by approved constraint) |

## Validation Detail

### Focused pure-helper harness

- Use the repository's existing TypeScript/Vite/esbuild toolchain without adding a dependency.
- Exercise the actual exported helper code rather than a copied reimplementation.
- Record command, fixtures, assertions, exit status, and concise output in `TEST_EVIDENCE.md`; never record real Council transcripts.
- Required P2-A fixtures:
  - answered Q1 followed directly by Q2;
  - answered Q1, one note, then Q2;
  - answered Q1, two or more notes, then Q2;
  - true first round;
  - pending/error/blank messages;
  - duplicate valid replies from one AI;
  - skipped-note presence in earlier context;
  - no valid answered round, with earlier background preserved by the legacy second-to-last-user cutoff.
- Required P2-B fixtures:
  - pre-change English outputs captured before editing and replayed after editing;
  - two Korean replies producing a non-default consensus and a non-default disagreement;
  - Korean/English concise boundaries;
  - Kimi enabled with deep-research coverage missing/present, disabled, and most-recent-speaker cases.

### EOL-safe editing and diff review

- Before and after editing each tracked target, record `git ls-files --eol -- <path>`.
- Preserve `electron/councilPrompt.ts` working-tree CRLF during S2; do not accept a whole-file replacement caused only by line endings.
- Capture the pre-edit per-line EOL map of `src/councilModerator.ts`; during S3 preserve the existing mixed EOL of every unchanged line and reject a whole-file replacement before staging.
- Review the task diff with `git diff --ignore-cr-at-eol -- <task paths>` and the staged task diff with `git diff --cached --ignore-cr-at-eol -- <task paths>`.
- Run `git diff --check -- <task paths>` only against explicit task-owned paths and capture the complete output. Classify findings whose only trailing byte is the preserved CR of CRLF separately from real spaces/tabs before EOL; CR-at-EOL-only findings are explicitly excluded, while any actionable whitespace finding fails the check.
- Before reporting PASS, inspect the actual command output and record the exact command plus at least raw finding count, CR-at-EOL-excluded count, actionable finding count, and representative output summary in `TEST_EVIDENCE.md`.
- Manually scan the EOL-filtered staged diff for secrets, tokens, PII, and unrelated changes.
- Do not create `.gitattributes` or normalize the wider checkout. Record repository EOL policy/`.gitattributes` as a separate bundle candidate after Phase 1 closes.

### Actual app and regression checks

- Run `build-and-run.bat` with synthetic, non-sensitive prompts.
- Preflight all seven providers because `DEFAULT_ENABLED_AI_NAMES` enables only ChatGPT, Claude, and Gemini. All seven must be authenticated and manually active before AC-5/AC-13 execution.
- If any provider is not authenticated/available, record AC-5/AC-13 as BLOCKED and stop short of claiming P1 or the bundle complete. Request user login/activation without entering, changing, or logging credentials.
- With all seven active, issue `@all`; capture only per-panel expected/observed AI identity, method, length, and success/error status. Gemini must show `clipboard-primary`; the other six must show `execCommand`. Do not capture cookies, tokens, or unrelated page content.
- Exercise concurrent clipboard image fallback with synthetic, uniquely labeled images and verify that every image-capable targeted panel receives exactly its intended set and that the trace contains no image/image or image/text critical-section interleaving. DeepSeek is excluded because its existing web path rejects images before fallback.
- Confirm `@AI` single mention and `@all` broadcast behavior, Workflow `Start → Next → Continue`, Korean final-language behavior, Saved Sessions save/restore, Hybrid Focus Layout, and candidate compare/merged draft surfaces affected by the shared state.
- Check file attachment through Workflow, Council Chat, and Telegram entry points; confirm Kimi's long prompt does not become TXT and Perplexity/DeepSeek paths still send.
- Check Telegram send/receive and unauthorized Chat ID silent rejection without changing the whitelist. If the environment lacks an authenticated account or safe test Chat ID, record the exact blocker and request user action; do not claim PASS.
- Do not call P1 complete until the seven-panel identity mapping has been observed in the running app.

## Workflow / Commit Boundaries

1. The user's conditional approval covers revision 3 after the two required verification-method corrections. Read `docs/workflow/BUILD.md`, then begin BUILD without another approval request.
2. Implement one slice at a time. Preserve the user-owned untracked handoff prompt and stage only explicit task-owned paths.
3. Read and follow `docs/workflow/TEST.md`; create `TEST_EVIDENCE.md` with actual results. A failed or unavailable required manual check remains FAIL/BLOCKED/NOT_RUN, never PASS.
4. After required checks, create the allowed local implementation and review-packet commits. Do not push.
5. Perform independent `WF:REVIEW` using the approved review mode/runtime or obtain the required human resolution if no approved independent runtime is available.
6. Read and follow `WF:CLOSE`; update DEV_LOG/HANDOFF and create close metadata locally. The user explicitly prohibited push for this task, so Push Intent remains `NOT_REQUIRED`/held locally unless a later exact instruction changes it.

## Dependencies / Assumptions

- No new package or major upgrade is needed.
- Current selectors remain centralized in `electron/selectors.json`; this bundle does not add hard-coded selectors.
- The existing line-ending state is a checkout constraint, not task-owned product behavior. EOL normalization and `.gitattributes` remain a separate post-Phase-1 bundle candidate.
- Existing authenticated web sessions and Telegram configuration may be used only for the explicitly required synthetic manual checks. Credentials are never requested in chat, entered by the agent, or logged.
- Current app DOMs support `execCommand('insertText')` on the normal path except Gemini, whose measured multi-line truncation makes serialized clipboard its approved structure-preserving primary path.
- The user approved the revision-4 corrections, AC-13 image-capable-panel definition, and Telegram BLOCKED status, and instructed completion of the remaining manual regression and commit packet without another approval round. Phase 2 and Phase 3 still require separate bundles/decisions.
- The user subsequently clarified that Workflow is not a product-priority surface and that normal use is centered on Siftline Chat. The required three-stage Workflow regression was completed for shared-path safety only; this bundle does not expand or promote Workflow.
- The current session was requested as `codex-sol-deep`, but the repository's Runtime PIN remains unapproved and the exact active model cannot be inferred from the runner name alone.

## Non-Goals

- Do not implement any Phase 2 or Phase 3 item from the audit.
- Do not change default no-mention routing.
- Do not modify `PROJECT_SCOPE.md` §4-§5, `MODEL_RUNTIME_PIN.md`, selectors, persisted session formats, Telegram whitelist semantics, or provider configuration.
- Do not normalize repository line endings or add `.gitattributes` in this bundle.
- Do not create or update a PR, deploy, release, tag, merge/rebase, push, or contact an external party.
- Do not stage, commit, move, or delete pre-existing user-owned files.

## Approval Bundle

- Mode: STANDARD_BUNDLE
- Bundle ID: `council-chat-phase1-defect-fixes-R4`
- SPEC Revision approved: 4
- PLAN Revision approved: 4
- Decision: APPROVED
- User message: 2026-08-03, Phase 1 structure independently verified; two required pre-commit fixes approved, AC-13 redefined for image-capable targets, Telegram BLOCKED accepted, and remaining manual regression plus commit packet authorized without reapproval.
- Constraints / expiry: Phase 1 only (P1, P2-A, P2-B); no Phase 2/3, dependency, provider, paid API, credential, deploy/release, external message, or push authority. Approval expires if substantive SPEC/PLAN content changes.

## High PLAN Approval

- Decision: N/A
- User message: N/A
- Constraints: N/A

## Revision History

- Revision 1 (2026-08-03): Initial Phase 1 approval bundle.
- Revision 2 (2026-08-03): Expanded S1 to share one mutex across text and image clipboard paths; added parallel image mapping verification; added EOL-preserving edit/diff rules and deferred `.gitattributes`; made seven authenticated/active providers a blocking P1 precondition; recorded the stale path documentation against the observed root/HEAD.
- Revision 3 (2026-08-03): Replaced the invalid global `--ignore-cr-at-eol --check` PASS method with task-scoped raw-output classification and evidence counts; added exact mixed-EOL preservation and whole-file-rewrite rejection for `src/councilModerator.ts`. User approval explicitly covers this revision.
- Revision 4 (2026-08-03): Removed Gemini newline flattening in favor of its shared-mutex clipboard-primary path, restored no-valid-round earlier-context fallback, redefined AC-13 for all image-capable targeted panels, and retained the user-approved Telegram BLOCKED status.
