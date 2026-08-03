# Cross-Machine Handoff: Council Chat Phase 1–3 Complete

- Snapshot Time: 2026-08-03T20:24:20Z
- Status: DONE
- Durable Branch: `codex/council-chat-phase3-defect-fixes`
- Expected Remote: `origin/codex/council-chat-phase3-defect-fixes`
- Base: `b753232768f466f9130834c6e5a25b4d50c0cd1b` (`main` at task start)
- Phase 1 Close: `eb6eac2112cc390794833c73656d6a8da78a9b76`
- Phase 2 Close: `394cee2f5b42f26dfecc27548746e424ea6612a8`
- Phase 3 Close: `6e6aa022a6ac446879d69582373079f54473b8ea`
- Portability Metadata: SELF — resolve this file's commit after checkout
- Independent Review: Opus 5 PASS for every phase

## Resume on Another PC

For a machine without a local branch:

```powershell
git clone https://github.com/Oplo-Works/AI-Council-Chat.git
cd AI-Council-Chat
git fetch origin
git switch --track origin/codex/council-chat-phase3-defect-fixes
npm install
npx tsc --noEmit
npm run build
```

For an existing clone:

```powershell
git fetch origin
git switch codex/council-chat-phase3-defect-fixes
git pull --ff-only origin codex/council-chat-phase3-defect-fixes
```

Before changing anything, the next coding agent must read, in order:

1. `AGENTS.md`
2. `docs/AGENT_WORKFLOW_CORE.md`
3. `docs/MODEL_RUNTIME_PIN.md`
4. `docs/PROJECT_SCOPE.md`
5. `docs/HANDOFF.md`
6. The workflow playbooks mapped by CORE for the new request

Do not continue from `main`; it does not contain the cumulative Phase 1–3 work. Do not merge/rebase/push to
`main` without a separate explicit request and approval.

## Completed Work

- Phase 1: module-wide prompt/image clipboard mutex; prompt identity verification; previous valid-round
  recovery; Korean/Kimi moderator fixes; Gemini multiline preservation and earlier-context regression fix.
- Phase 2: Electron-inclusive strict typecheck; canonical AI/default lists; complete Kimi current-login status;
  Saved Session typing alignment; actual Kimi true → false → true validation.
- Phase 3: one canonical role object; newest-first context retention; exact runtime-only Retry with attachments;
  embedded Kimi Accounts route with primary invariance; observe-mode line signatures for all providers;
  Gemini-only structure enforcement and bounded direct insertion; final concurrent image mapping.

Primary evidence:

- `docs/features/council-chat-phase1-defect-fixes/TEST_EVIDENCE.md`
- `docs/features/electron-typecheck-defect-fixes/TEST_EVIDENCE.md`
- `docs/features/council-chat-phase3-defect-fixes/TEST_EVIDENCE.md`

Final Phase 3 automated results: focused 80/80, Phase 2 regression 60/60, Phase 1 regression 17/17,
`npx tsc --noEmit` exit 0, production build six outputs with transforms 50/9/1/1. The user also passed the
actual Kimi embedded-login cycle and image-capable-panel mapping.

## Product Decisions

- Council Chat is the user's primary surface. Workflow is retired from normal use; do not prioritize it
  without a new explicit request.
- Mention-free Council messages deliberately remain transcript-only notes. A full parallel round uses the
  existing one-click `@all` quick mention. The user decided a Phase 4 toggle/default-routing bundle is not
  necessary.
- Gemini is the only structure-enforced provider. Before enforcing another provider, collect and record the
  target provider's actual expected/observed line count and digest; verbal confirmation is insufficient.
- No provider authentication values, retry paths/prompts, previous clipboard contents, or build outputs are
  committed. Provider logins and Electron `persist:*` session data are local to each PC and may need to be
  established again on a new machine.

## Deferred Optional Work

None is required for the current application:

- Correct single-target peer-parallel prompt wording and stale `sequential`/`in order` UI copy.
- Redesign display-only `pendingAi` if concurrent status presentation matters.
- Deduplicate Council IPC/Telegram handlers only with Telegram regression coverage.
- Improve Kimi status behavior during provider/network load failure.
- Treat cookie-domain exact matching as a separate High-risk authentication-hardening bundle.
- Consider `.gitattributes`/repository EOL normalization and the pre-existing npm audit findings separately.

## Local-Only Files Not Published

The source PC has three unrelated untracked paths that are intentionally excluded from commits and push:

- `_to_delete/`
- `docs/handoff_history/COWORK_SESSION_HANDOFF_council_chat_review.md`
- `docs/handoff_history/HANDOFF_PROMPT_council_chat_fixes.md`

Their absence on another PC is expected and does not indicate an incomplete checkout.
