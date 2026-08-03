# Handoff

## Identity

- Status: DONE
- Task ID: `council-chat-phase3-defect-fixes`
- Stage: WF:CLOSE
- Risk: Standard — Kimi work is UI navigation only; auth/storage transfer is prohibited
- Updated At: 2026-08-03T20:24:20Z

## Context Summary

Phase 3 is closed locally after Opus 5 independently returned PASS on `394cee2..0b1336d`. Canonical roles,
exact live Retry, newest-first context, embedded Kimi login navigation, and Gemini structure-safe insertion
all pass automated and actual-app validation. Independent review accepted the renderer-hash-driven HTML
change and classified missing non-Gemini numeric metrics as a future enforcement prerequisite, not a current
defect. The user accepted keeping mention-free messages transcript-only and decided a Phase 4 bundle is not
necessary. `@all` remains available as a one-click quick mention when a full council round is wanted.

## Ownership

- Outgoing Role / Runtime: Main Driver / Codex (`codex-sol-deep` requested;
  repository Runtime PIN remains CANDIDATE)
- Next Role: Future Main Driver / coding agent on the user's chosen machine
- Next Runtime ID: read `docs/MODEL_RUNTIME_PIN.md`; repository runtime remains CANDIDATE until separately approved
- Next Action: no active implementation task. Fetch and check out the published task branch, read the required bootstrap docs and this HANDOFF, then wait for a new explicit request
- Reason: Phase 1–3 are complete and independently reviewed; the user decided not to open Phase 4

## Git and Worktree

- Branch / Worktree: `codex/council-chat-phase3-defect-fixes` @
  `C:\Users\Sales01\Documents\AI-Council-Chat`
- Phase 2 Close Commit: `394cee2f5b42f26dfecc27548746e424ea6612a8`
- Phase 3 Planning Base: `394cee2f5b42f26dfecc27548746e424ea6612a8`
- Planning Artifact State: SELF
- Implementation Base / Head: `73b0f74` / `75a3eec`
- Reviewed Packet Head: `0b1336d1aa26aba433053ca49caf6da7e5a53924`
- Close Metadata Head: `6e6aa022a6ac446879d69582373079f54473b8ea`
- Portability Metadata Head: SELF — resolve this local handoff/publish commit
- Worktree State: expected USER_DIRTY_ONLY after the portability commit; preserved unrelated untracked paths remain local and are not published
- Preserved user/unrelated paths:
  - `docs/handoff_history/HANDOFF_PROMPT_council_chat_fixes.md` (untracked)
  - `docs/handoff_history/COWORK_SESSION_HANDOFF_council_chat_review.md` (untracked)
  - `_to_delete/` (untracked; untouched)

## Publish

- Push Intent: AUTO_AT_CLOSE — user explicitly requested commit and push on 2026-08-03
- Approved Target: `origin/codex/council-chat-phase3-defect-fixes` (current non-protected task branch)
- Canonical Remote URL: `https://github.com/Oplo-Works/AI-Council-Chat.git` (GitHub redirected the legacy
  `MinkyuTheBuilder` URL here during the first successful branch push)
- Expected Remote Head: SELF — resolve this portability metadata commit
- Push Result: PENDING until the exact local head is pushed and verified

## Approval Bundle

- SPEC: `docs/features/council-chat-phase3-defect-fixes/SPEC.md`, revision 1, APPROVED
- PLAN: `docs/features/council-chat-phase3-defect-fixes/PLAN.md`, revision 1, APPROVED
- Bundle ID: `council-chat-phase3-defect-fixes-R1`
- Decision: APPROVED on 2026-08-03; BUILD directed without reapproval for the recorded three conditions
- Approval required: satisfied for S1–S6 under the recorded constraints

## Key Decisions

- One canonical role object separates unchanged short UI titles from active long prompt roles/focus/output
  guidance; dead personas/builder go.
- Retry replay material is live-memory only and includes the exact prompt plus both attachment forms.
  Missing replay state cannot degrade into a different text-only send.
- Summary budgets retain newest complete messages, then display the retained subset chronologically.
- Accounts Kimi action opens/enables/exposes the existing `persist:kimi` panel without changing Council
  primary. It does not transfer cookies/localStorage or invoke the standalone Kimi product path.
- Composer structure metrics are observation-only until all seven providers are actually measured. The
  non-empty trimmed-line signature tolerates blank-line folding and detects flattening. Only evidenced
  providers may be enforced; Gemini gets a verified direct path before routine clipboard ownership ends.
- Phase 4 mention-free default routing is explicitly excluded and current transcript-only behavior is
  an AC-15 regression guard.
- Post-close product decision: no Phase 4 bundle. Mention-free messages remain transcript-only notes;
  the existing `@all` quick-mention button is the deliberate route for a full parallel round.
- The user retired Workflow from normal use. Shared type/build/prompt coverage remains, but future work
  should not expand or manually prioritize Workflow without a new explicit request.

## Risks and Blockers

- No Phase 3 blocker remains. The user confirmed the actual Kimi Logout → Open panel → Login cycle and the
  final concurrent image-capable-panel mapping; Opus 5 independently returned PASS.
- Gemini remains the only structure-enforced provider. Before expanding enforcement to another provider,
  collect and record that target's actual expected/observed line count and digest. User verbal confirmation
  alone is not sufficient to expand the enforcement set.
- Any Kimi auth/storage-value transfer, provider-cookie predicate change, clipboard content read/restore,
  persistent retry paths/prompts, dependency/selector/schema/EOL-policy change, or Phase 4 routing
  invalidates revision 1 and requires a new risk/approval pass.
- Provider-dependent Kimi/Gemini/image checks require existing user sessions and visible user action;
  unavailable providers remain BLOCKED rather than inferred PASS.
- Deferred candidates only: Kimi false status during provider/network load failure and the inconsistent
  substring-versus-suffix cookie-domain helpers.
- This handoff authorizes one normal push of the exact current task branch only. Do not open a PR, push a
  tag, release, deploy, merge, rebase, or force-push without separate explicit approval.
- Do not stage, commit, move, or delete the two untracked handoff-history files or `_to_delete/`.

## Deferred Optional Work — No Phase 4 Planned

- Low-severity truthfulness copy: a single-target mention still receives peer-parallel wording, and Council
  UI help still says `sequential`/`in order` although broadcast execution is parallel.
- Display-only state: `pendingAi` is a single value although placeholders represent every concurrent target.
- Maintenance debt: Council IPC and Telegram handlers duplicate roughly 90 lines. Do not refactor without a
  behavior-changing reason and corresponding Telegram regression coverage.
- Kimi status depends on the live BrowserView; a provider/network load failure can temporarily report false.
- Auth hardening must be a separate High-risk bundle: `cookieDomainIncludes()` uses substring matching while
  newer Kimi helpers use strict suffix matching. Do not mix it with UI cleanup.
- Separate repository maintenance remains optional: `.gitattributes`/EOL normalization and the existing npm
  audit findings. None blocks the current working application.
