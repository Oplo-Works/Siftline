# Handoff

## Identity

- Status: READY_FOR_APPROVAL
- Task ID: `council-chat-phase3-defect-fixes`
- Stage: WF:SPEC_PLAN
- Risk: Standard — Kimi work is UI navigation only; auth/storage transfer is prohibited
- Updated At: 2026-08-03T18:51:54Z

## Context Summary

Phase 2 closed locally at `394cee2` after Opus 5 independently returned PASS. Phase 3 revision 1
combines canonical AI roles/dead-code removal, exact live retry with attachments, recent-first context,
the working embedded Kimi-panel login route, and structure-aware Gemini insertion/readback. Automatic
clipboard restoration and authentication-value transfer are rejected; mention-free routing remains
transcript-only and belongs to a separate Phase 4 decision.

## Ownership

- Outgoing Role / Runtime: Main Driver / Codex (`codex-sol-deep` requested;
  repository Runtime PIN remains CANDIDATE)
- Next Role: Human Approver
- Next Runtime ID: N/A
- Next Action: approve or revise SPEC revision 1 and PLAN revision 1 together
- Reason: Standard bundle `council-chat-phase3-defect-fixes-R1` is ready; BUILD is not authorized

## Git and Worktree

- Branch / Worktree: `codex/council-chat-phase3-defect-fixes` @
  `C:\Users\Sales01\Documents\AI-Council-Chat`
- Phase 2 Close Commit: `394cee2f5b42f26dfecc27548746e424ea6612a8`
- Phase 3 Planning Base: `394cee2f5b42f26dfecc27548746e424ea6612a8`
- Planning Artifact State: SELF
- Implementation Base / Head: N/A — planning only
- Worktree State: USER_DIRTY_ONLY after this planning-artifact commit
- Preserved user/unrelated paths:
  - `docs/handoff_history/HANDOFF_PROMPT_council_chat_fixes.md` (untracked)
  - `docs/handoff_history/COWORK_SESSION_HANDOFF_council_chat_review.md` (untracked)
  - `_to_delete/` (untracked; untouched)

## Publish

- Push Intent: NOT_REQUIRED — planning bundle is local; Phase 3 also prohibits push before CLOSE
- Approved Target: none
- Push Result: NOT_ATTEMPTED

## Approval Bundle

- SPEC: `docs/features/council-chat-phase3-defect-fixes/SPEC.md`, revision 1,
  READY_FOR_APPROVAL
- PLAN: `docs/features/council-chat-phase3-defect-fixes/PLAN.md`, revision 1,
  READY_FOR_APPROVAL
- Bundle ID: `council-chat-phase3-defect-fixes-R1`
- Decision: PENDING
- Approval required: explicit approval of both revision 1 documents before BUILD

## Key Decisions

- Active `AI_REVIEWER_BRIEFS` semantics become the one canonical role source; dead personas/builder go.
- Retry replay material is live-memory only and includes the exact prompt plus both attachment forms.
  Missing replay state cannot degrade into a different text-only send.
- Summary budgets retain newest complete messages, then display the retained subset chronologically.
- Accounts Kimi action opens/enables/focuses the existing `persist:kimi` panel. It does not transfer
  cookies/localStorage or invoke the standalone Kimi product path.
- Gemini gets a verified structure-preserving direct path. The shared clipboard mutex remains for
  compatibility/image fallbacks; previous clipboard data is not read or restored.
- Phase 4 mention-free default routing is explicitly excluded and current transcript-only behavior is
  an AC-15 regression guard.

## Risks and Blockers

- Blocker: Human approval is required before any Phase 3 code/test/config implementation.
- Any Kimi auth/storage-value transfer, provider-cookie predicate change, clipboard content read/restore,
  persistent retry paths/prompts, dependency/selector/schema/EOL-policy change, or Phase 4 routing
  invalidates revision 1 and requires a new risk/approval pass.
- Provider-dependent Kimi/Gemini/image checks require existing user sessions and visible user action;
  unavailable providers remain BLOCKED rather than inferred PASS.
- Deferred candidates only: Kimi false status during provider/network load failure and the inconsistent
  substring-versus-suffix cookie-domain helpers.
- Do not implement before approval; do not push, PR, tag, release, deploy, merge, or rebase.
- Do not stage, commit, move, or delete the two untracked handoff-history files or `_to_delete/`.
