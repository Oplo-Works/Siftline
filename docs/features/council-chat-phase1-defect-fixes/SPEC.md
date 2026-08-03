# SPEC: Council Chat Phase 1 Defect Fixes

- Feature ID: `council-chat-phase1-defect-fixes`
- Risk: Standard
- Bundle ID: `council-chat-phase1-defect-fixes-R4`
- SPEC Revision: 4
- Status: APPROVED
- Last Updated: 2026-08-03

## Context / User / Goal

- Context: Council Chat already fans a round out to the selected AIs in parallel and carries peer replies into later rounds, but three defects undermine prompt identity, round continuity, and moderator decisions.
- User: The single local Siftline desktop user using Council Chat with the seven embedded AI web sessions.
- Goal: Make prompt injection safe under parallel fan-out, preserve the most recent answered round across unaddressed notes, and make moderator heuristics work for Korean replies and Kimi.
- Current behavior:
  - Parallel turns share the OS clipboard between `clipboard.writeText()` and `Ctrl+V`, so one AI can receive another AI's persona prompt. The current first-32-character check cannot distinguish Council prompts and contenteditable mismatches are silently accepted.
  - The image-attachment fallback also shares the OS clipboard between `clipboard.writeImage()` and `webContents.paste()` inside an awaited loop. Concurrent image attachments can cross panels, and image paste can interleave with the text-prompt clipboard fallback.
  - Previous-round extraction assumes the two most recent user messages are round boundaries. A user note with no AI reply therefore hides the last answered round and demotes it into the earlier-context summary.
  - Moderator signals are English-only, Korean concise detection is unreliable, and Kimi has neither a speaker-order signal nor a role-specific missing-angle prompt.
- Desired behavior:
  - Every non-Gemini prompt injection first uses DOM `execCommand('insertText')`; only a failed or unverified attempt uses a serialized clipboard fallback. Gemini uses that serialized clipboard operation as its normal path because its contenteditable truncates multi-line `insertText` at the first line. One module-wide clipboard mutex protects both prompt text and image-attachment fallback for their complete clipboard operation. Readback verifies the actual target text and Council AI identity before Send, and an unresolved mismatch logs an error and fails the turn.
  - The previous round is the most recent user-bounded segment containing at least one valid assistant reply. Consecutive notes with no replies are skipped as boundaries but retained in earlier context.
  - Moderator classification recognizes equivalent English and Korean signals, uses a Korean-aware concise threshold, and can select Kimi for missing long-context/deep-research coverage.

## In Scope / Out of Scope

- In:
  - Rework `pasteText()` to use `execCommand` as the default for all non-Gemini AIs, use the serialized structure-preserving clipboard path as Gemini's normal path, and preserve native focus/click behavior.
  - Add one module-scoped clipboard mutex shared by `pasteText()` and `attachFilesViaClipboardPaste()`. Protect the entire prompt fallback (`writeText` through paste/readback) and each complete image operation (`writeImage` through `webContents.paste()` and its settle wait).
  - Replace prefix-only success detection with shared post-injection readback verification. For Council prompts, require the exact panel-specific `You are participating in Siftline as X.` identity in addition to conservative text verification.
  - Preserve Perplexity's native textarea setter fallback and DeepSeek's native mouse focus path. Protect Kimi prompts over 4000 bytes from clipboard fallback so failed direct insertion becomes a clear turn failure rather than a TXT attachment.
  - Add one shared previous-round-bounds helper and use it in both reply extraction and earlier-context summarization.
  - Add Korean signal patterns, Korean-aware concise detection, a Kimi deep-research signal, and Kimi-specific moderator guidance consistent with `AI_ROLE_PRESETS.kimi`.
  - Add focused verification evidence for the pure helpers and complete the required project validation and manual regression checks after implementation.
  - Preserve existing line endings in edited tracked files: keep the CRLF working-tree form of `electron/councilPrompt.ts`, and retain the existing per-line mixed EOL pattern of `src/councilModerator.ts`. Inspect content diffs with `--ignore-cr-at-eol`.
- Out:
  - Phase 2 items: Electron-wide typecheck configuration, role-table consolidation/dead-code removal, retry parity, and recent-first generic summarization.
  - Phase 3 items: single-target peer wording, UI copy, `pendingAi` state redesign, IPC/Telegram deduplication, and changing unmentioned messages to default `@all`.
  - Selector changes, provider additions, dependencies, schema/data migrations, cloud sync, unattended workflow, automatic scoring, mobile work, deploy, release, or push.
  - Localizing the moderator's fixed English UI sentences; this bundle changes signal recognition and selection only.
  - Repository-wide EOL normalization or adding `.gitattributes`; record that as a separate post-Phase-1 bundle candidate only.

## Affected Areas

- Screens/flows: Council Chat `@AI` and `@all`, AI Moderator, shared `pasteText()` paths used by the three-stage Workflow, Council Chat, and final/reviewer prompts.
- Data/models: No persisted schema change. Transcript interpretation changes only in pure prompt-building helpers.
- APIs/integrations: Existing BrowserView DOM injection, Electron clipboard fallback, CDP file attachment, and Telegram-triggered Council routing must retain their contracts.
- Roles/permissions: No application permission change. Work is local to the current task branch; no push, provider change, paid API call, deploy, release, or external message is authorized.

## Security · Privacy · Data

- Data class: Internal source code and synthetic verification fixtures only.
- Retention/provider constraints: Do not expose stored AI sessions, cookies, API keys, Telegram tokens, real transcripts, or other local user data. Actual app checks use only synthetic prompts and the user's already authenticated sessions.
- Runtime note: The request names `codex-sol-deep` for this task. The repository Runtime registry remains `CANDIDATE`; this task does not edit or approve `MODEL_RUNTIME_PIN.md` or `PROJECT_SCOPE.md`.
- Risks and required approvals: No new dependency or paid API is planned. If required manual verification lacks authenticated AI/Telegram state, stop for user action rather than requesting, entering, logging, or changing credentials. Push remains prohibited by the task request.

## Edge Cases / Failure Behavior

- `execCommand` returns false, throws, or produces incomplete/different text: verify readback, then enter the clipboard fallback only under the mutex.
- Gemini receives a multi-line Council prompt: do not flatten or otherwise rewrite its section headers, list boundaries, peer markdown, or final-language block. Use the structure-preserving clipboard path under the shared mutex. The measured direct-insertion failure must remain in test evidence.
- Clipboard fallback rejects or verification fails: always release the mutex; log the AI, method, and non-sensitive length/identity result; throw so the turn is recorded as failed and Send is not clicked.
- Image clipboard fallback runs concurrently with another image or prompt fallback: the shared mutex prevents any other clipboard write/paste pair from entering until the current image has been pasted and settled.
- Contenteditable target remains mismatched: do not mutate `innerText`; fail explicitly after the safe attempts.
- Native textarea/input remains mismatched: preserve the prototype native-value-setter plus input/change event fallback, verify again, and fail if it still differs.
- Kimi prompt exceeds 4000 bytes: never use clipboard paste; failed/unverified direct insertion fails the turn without triggering Kimi's TXT conversion.
- Consecutive user notes occur after an answered round: skip every empty segment, retain the newest valid reply per AI, and include the skipped notes in earlier context.
- Pending, error, blank, or non-AI assistant messages: never qualify a segment as an answered round and never appear in the previous-round reply block.
- No answered round exists: return no previous-round replies and keep first-round peer wording, but preserve the pre-existing earlier-background summary by falling back to the second-to-last user boundary.
- Korean/English mixed text: either language's signal may classify the reply; Korean presence uses the character-aware concise rule without changing the existing English word threshold.
- Kimi is disabled or spoke most recently: never select a disabled AI; retain the existing recent-speaker avoidance and primary-AI fallback behavior.
- Editing `electron/councilPrompt.ts`: preserve its existing CRLF working-tree line endings and reject a whole-file EOL-only rewrite before staging.
- Editing `src/councilModerator.ts`: preserve its existing line-by-line mixed EOL pattern (index/worktree both mixed) and reject a whole-file rewrite before staging. Do not normalize its 163 lines to either LF or CRLF.
- Fewer than seven providers are enabled or authenticated: record the seven-panel AC as BLOCKED and do not claim P1 or the bundle complete.

## Acceptance Criteria

| ID | Observable criterion | Verification | Status |
|---|---|---|---|
| AC-1 | Successful default prompt injection uses `execCommand('insertText')` for every non-Gemini AI. Gemini uses the shared-mutex-protected clipboard path as its structure-preserving normal path. Every path verifies full readback and the exact Council AI identity before Send. | Instrumented code review plus actual-app injection logs for all seven AIs, including the measured Gemini multi-line truncation and its serialized clipboard-primary success. | PASS |
| AC-2 | A failed/unverified direct insertion and image-attachment clipboard fallback both use one rejection-safe module mutex; no `writeText`/`Ctrl+V` or `writeImage`/`paste()` critical section can interleave with another. | Focused concurrency harness/trace plus code inspection of both call sites. | PASS |
| AC-3 | The first-32-character check is gone. Readback detects a wrong AI identity or other unresolved mismatch, emits an error, throws, and prevents Send. | Focused mismatch fixture and actual-app logs; inspect failed-turn UI behavior. | PASS |
| AC-4 | DeepSeek native mouse focus, Perplexity native setter/event fallback, and Kimi over-4000-byte no-TXT behavior remain intact. | Targeted code review and manual checks with synthetic prompts. | PASS |
| AC-5 | With all seven AIs authenticated and manually active (the default enables only three), an `@all` round verifies that each panel received its own `You are participating in Siftline as X.` identity before Send. A missing provider is BLOCKED, and P1 cannot be called complete. | `build-and-run.bat`; capture non-sensitive per-panel verification logs or DevTools readback and the seven-provider preflight state. | PASS |
| AC-6 | `[Q1, Claude reply, Gemini reply, note, Q2]` and the same case with two or more consecutive notes both return Claude and Gemini as the previous round. | Pure-helper verification script with asserted before/after fixtures. | PASS |
| AC-7 | A true first round returns `[]`; pending/error/blank replies remain excluded; multiple replies from one AI retain only its latest valid reply. | Pure-helper verification script. | PASS |
| AC-8 | Notes skipped as empty round boundaries remain visible in earlier-context summary, while the selected previous-round replies remain in the dedicated previous-round block. If no valid answered round exists, earlier background still uses the legacy second-to-last-user cutoff rather than disappearing. | Pure-helper verification script asserting both outputs and the all-invalid-round fallback. | PASS |
| AC-9 | Two or more Korean assistant replies with supported signals produce non-default consensus/disagreement classification, while captured English fixtures retain their pre-change results. | Pure moderator verification script with Korean and English fixtures. | PASS |
| AC-10 | Korean replies at or below the approved character threshold count as concise; English replies retain the existing 110-word threshold. | Boundary fixtures around both thresholds. | PASS |
| AC-11 | When enabled and its deep-research angle is missing, Kimi can be selected as `nextSpeaker` and receives a role-specific prompt consistent with `AI_ROLE_PRESETS.kimi`; disabled Kimi is never selected. | Pure moderator fixtures. | PASS |
| AC-12 | Required typecheck, build, EOL-aware diff/secret checks, and the agreed manual regression checklist pass, or any environment-dependent check is recorded honestly as blocked/not run without claiming completion. No repository-wide EOL normalization is included. A check is reported PASS only after its real output and at least the finding count are inspected and recorded. | `npx tsc --noEmit`, `npm run build`, task-scoped `git diff --check -- <task paths>` with CR-at-EOL-only findings explicitly classified/excluded from actionable whitespace findings, task-owned staged diff review with `git diff --cached --ignore-cr-at-eol`, `git ls-files --eol` plus whole-file-rewrite rejection for both EOL-sensitive targets, `build-and-run.bat`, and `docs/VERIFICATION.md` evidence. Record commands and actual output summaries in `TEST_EVIDENCE.md`. | PASS |
| AC-13 | When concurrent clipboard image fallbacks are exercised with uniquely identifiable images, every image-capable targeted panel receives exactly its intended image set and no prompt text/image clipboard operation crosses panels. DeepSeek is excluded because its existing web integration rejects image attachments before clipboard fallback. | Forced/observed fallback concurrency trace plus actual-app inspection using synthetic labeled images across every image-capable targeted panel. | PASS |

## Approval

- Mode: STANDARD_BUNDLE_IN_PLAN
- Standard ledger: `docs/features/council-chat-phase1-defect-fixes/PLAN.md#approval-bundle`
- High decision: N/A
- User message: 2026-08-03, Phase 1 structure independently verified; Gemini structure-preserving clipboard-primary and null-bounds summary fallback required before commit, AC-13 redefined for image-capable panels, Telegram BLOCKED accepted, and work authorized through commit packet without reapproval.

## Revision History

- Revision 1 (2026-08-03): Initial Phase 1 approval bundle.
- Revision 2 (2026-08-03): Added the shared image/text clipboard mutex scope and image-mapping AC; added EOL-preservation and `--ignore-cr-at-eol` validation constraints; made seven-provider authentication/activation a blocking P1 precondition; recorded the current-path documentation mismatch without changing the source policy documents.
- Revision 3 (2026-08-03): Scoped whitespace checks to task-owned paths and required actual-output counts plus explicit CR-at-EOL classification; added line-by-line mixed-EOL preservation and whole-file-rewrite rejection for `src/councilModerator.ts`. Approved by the user under the revision-2 conditional approval, which explicitly extends through revision 3.
- Revision 4 (2026-08-03): Replaced the unapproved Gemini newline flattening with the shared-mutex clipboard-primary path, restored earlier-background summarization when no valid answered round exists, redefined AC-13 to every image-capable targeted panel, and retained the user-approved Telegram BLOCKED status. The user authorized this correction and commit packet without another approval round.
