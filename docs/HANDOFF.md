# Handoff

## Identity

- Status: IN_PROGRESS
- Task ID: `council-chat-phase3-defect-fixes`
- Stage: WF:BUILD
- Risk: Standard — Kimi work is UI navigation only; auth/storage transfer is prohibited
- Updated At: 2026-08-03T19:08:36Z

## Context Summary

Phase 2 closed locally at `394cee2` after Opus 5 independently returned PASS. The user approved Phase 3
SPEC/PLAN revision 1 with three BUILD-time conditions: structural composer metrics remain observation-only
until all seven providers are measured, opening Kimi preserves Council primary, and the one canonical role
object separates short UI titles from long prompt roles. BUILD is active. Automatic clipboard restoration
and authentication-value transfer remain rejected; mention-free routing stays transcript-only.

## Ownership

- Outgoing Role / Runtime: Main Driver / Codex (`codex-sol-deep` requested;
  repository Runtime PIN remains CANDIDATE)
- Next Role: Implementation Owner
- Next Runtime ID: current observed runtime
- Next Action: implement and validate approved S1–S6 without scope expansion
- Reason: Standard bundle `council-chat-phase3-defect-fixes-R1` is approved and BUILD is authorized

## Git and Worktree

- Branch / Worktree: `codex/council-chat-phase3-defect-fixes` @
  `C:\Users\Sales01\Documents\AI-Council-Chat`
- Phase 2 Close Commit: `394cee2f5b42f26dfecc27548746e424ea6612a8`
- Phase 3 Planning Base: `394cee2f5b42f26dfecc27548746e424ea6612a8`
- Planning Artifact State: SELF
- Implementation Base / Head: `73b0f74` / in progress
- Worktree State: TASK_DIRTY plus preserved unrelated untracked paths
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

- No approval blocker remains for the approved scope. S4 completion still requires the user's actual Kimi
  Logout → Open panel → Login transition; absent user action, S4 is BLOCKED while other slices continue.
- Any Kimi auth/storage-value transfer, provider-cookie predicate change, clipboard content read/restore,
  persistent retry paths/prompts, dependency/selector/schema/EOL-policy change, or Phase 4 routing
  invalidates revision 1 and requires a new risk/approval pass.
- Provider-dependent Kimi/Gemini/image checks require existing user sessions and visible user action;
  unavailable providers remain BLOCKED rather than inferred PASS.
- Deferred candidates only: Kimi false status during provider/network load failure and the inconsistent
  substring-versus-suffix cookie-domain helpers.
- Do not push, PR, tag, release, deploy, merge, or rebase.
- Do not stage, commit, move, or delete the two untracked handoff-history files or `_to_delete/`.
