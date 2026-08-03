# Handoff

## Identity

- Status: DONE
- Task ID: `council-chat-phase3-defect-fixes`
- Stage: WF:CLOSE
- Risk: Standard — Kimi work is UI navigation only; auth/storage transfer is prohibited
- Updated At: 2026-08-03T20:09:08Z

## Context Summary

Phase 3 is closed locally after Opus 5 independently returned PASS on `394cee2..0b1336d`. Canonical roles,
exact live Retry, newest-first context, embedded Kimi login navigation, and Gemini structure-safe insertion
all pass automated and actual-app validation. Independent review accepted the renderer-hash-driven HTML
change and classified missing non-Gemini numeric metrics as a future enforcement prerequisite, not a current
defect. Mention-free routing remains transcript-only until the user chooses the Phase 4 product behavior.

## Ownership

- Outgoing Role / Runtime: Main Driver / Codex (`codex-sol-deep` requested;
  repository Runtime PIN remains CANDIDATE)
- Next Role: Human / Main Driver
- Next Runtime ID: current observed runtime
- Next Action: wait for the user's mention-free routing choice: keep transcript-only, default `@all`, or add a toggle; do not write Phase 4 SPEC before that decision
- Reason: Phase 3 is DONE, while the routing decision materially determines Phase 4 scope

## Git and Worktree

- Branch / Worktree: `codex/council-chat-phase3-defect-fixes` @
  `C:\Users\Sales01\Documents\AI-Council-Chat`
- Phase 2 Close Commit: `394cee2f5b42f26dfecc27548746e424ea6612a8`
- Phase 3 Planning Base: `394cee2f5b42f26dfecc27548746e424ea6612a8`
- Planning Artifact State: SELF
- Implementation Base / Head: `73b0f74` / `75a3eec`
- Reviewed Packet Head: `0b1336d1aa26aba433053ca49caf6da7e5a53924`
- Close Metadata Head: SELF — resolve this local close commit
- Worktree State: expected USER_DIRTY_ONLY after the close commit; preserved unrelated untracked paths remain
- Preserved user/unrelated paths:
  - `docs/handoff_history/HANDOFF_PROMPT_council_chat_fixes.md` (untracked)
  - `docs/handoff_history/COWORK_SESSION_HANDOFF_council_chat_review.md` (untracked)
  - `_to_delete/` (untracked; untouched)

## Publish

- Push Intent: NOT_REQUIRED — planning bundle is local; Phase 3 also prohibits push before CLOSE
- Approved Target: none
- Push Result: NOT_ATTEMPTED

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
- Do not push, PR, tag, release, deploy, merge, or rebase.
- Do not stage, commit, move, or delete the two untracked handoff-history files or `_to_delete/`.

## Phase 4 Candidates — Decision Pending

- Single-mention prompt falsely says other AIs are answering in parallel.
- `pendingAi` is a single value although up to seven providers can run concurrently.
- Council IPC and Telegram handlers duplicate roughly 90 lines.
- Mention-free default routing: waiting for the user's choice among current transcript-only behavior,
  default `@all`, or a user-facing toggle. Do not begin Phase 4 SPEC until this is decided.
- Deferred Phase 3 observations: Kimi status depends on the live BrowserView; `cookieDomainIncludes()` uses
  substring matching while newer Kimi helpers use strict suffix matching.
