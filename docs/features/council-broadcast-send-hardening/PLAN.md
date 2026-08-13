# PLAN: Council Broadcast Send Hardening (Gemini injection + Perplexity send)

- Feature ID: council-broadcast-send-hardening
- Risk: Standard
- Bundle ID: council-broadcast-send-hardening-R1
- PLAN Revision: 1
- SPEC: docs/features/council-broadcast-send-hardening/SPEC.md — SPEC revision 1 — APPROVED
- Status: APPROVED
- Base Branch/Commit: `codex/council-chat-phase3-defect-fixes` @ `391b294`
  (task branch: `kimi/council-broadcast-send-hardening`)

## Baseline

- Existing behavior: `@all` broadcast injects and sends in parallel per AI;
  Gemini line-wise insertion + clipboard fallback under a clipboard mutex;
  Perplexity send relies on selector click → generic heuristic → native Enter;
  send-ready wait only for attachment turns.
- Existing failures (2026-08-13 user report + screenshots + prior evidence):
  - Gemini: composer keeps only the identity line (44 chars); turn fails.
    Matches measured truncation in
    `council-chat-phase1-defect-fixes/TEST_EVIDENCE.md` and the accepted
    residual risk in `council-chat-phase3-defect-fixes/TEST_EVIDENCE.md`.
  - Perplexity: prompt injected and verified, Send never fires; text remains
    in composer; intermittent (one run showed Perplexity succeed while Gemini
    failed).
- Commands (PROJECT_SCOPE §4):
  - Typecheck: `npx tsc --noEmit` (repo root)
  - Build: `npm run build` (repo root)
  - Run check (manual): `build-and-run.bat` + checklist
  - Production run check (recommended): `npx electron .`
  - Lint/test scripts: none exist
  - Secret scan: staged diff manual review + `git diff --check`

## Slices

| Slice | User-visible goal | AC IDs | Expected paths | Data/API impact | Validation | Rollback | Status |
|---|---|---|---|---|---|---|---|
| S1 | Focus-dependent phases never race across panels: one module-wide native-input mutex wraps clipboard paste, native Enter/mouse, and CDP input sections; lock ordering `nativeInputLock` → `clipboardLock` documented and logged | AC-4 | `electron/main.ts` | none | `npx tsc --noEmit`; `@all` run shows non-overlapping lock sections in Logs | Revert lock wrappers (DOM injection path untouched) | DRAFT |
| S2 | Every council send waits for a send-ready composer (text-only turns included); timeout stays non-fatal | AC-3 | `electron/main.ts` (`processCouncilTurn`) | none | `npx tsc --noEmit`; Logs show `[composer-ready]` for text-only turns | Restore attachment-only condition | DRAFT |
| S3 | Perplexity submits reliably: CDP mouse click on probed send button → clean CDP Enter fallback → submission verified by composer-clear / stop-indicator polling; failure always logged | AC-2 | `electron/main.ts` (`clickSend` + Perplexity probe helper); selector touch-up in `DEFAULT_SELECTORS` only if live DOM evidence supports it | none | `npx tsc --noEmit`; `@perplexity` + `@all` manual runs; Logs evidence | Remove Perplexity CDP branch; previous heuristic/Enter path remains | DRAFT |
| S4 | Gemini prompt arrives whole: per-line verified insertion with bounded re-insert of missing lines; clipboard fallback verifies target-view document focus before Ctrl+V with bounded retry; structure enforcement unchanged | AC-1 | `electron/main.ts` (`insertComposerTextWithLineCommands`, `pasteText` Gemini branch) | none | `npx tsc --noEmit`; `@all` run logs matching line digests for Gemini | Revert to current line-wise + clipboard fallback behavior | DRAFT |
| S5 | No regressions and evidence pack: single `@mention` to each logged-in AI, Workflow `▶ Start`, typecheck/build PASS, TEST_EVIDENCE.md written | AC-5, AC-6, AC-7 | `docs/features/council-broadcast-send-hardening/TEST_EVIDENCE.md` | none | `build-and-run.bat` checklist + `npm run build` | N/A (evidence slice) | DRAFT |

Slice order: S1 first (it protects S3/S4), then S2, S3, S4, then S5 evidence.
S1–S4 touch overlapping regions of `electron/main.ts`; they land as one
coherent implementation pass but remain individually revertible.

## Dependencies / Assumptions

- All 7 AI sessions are logged in and manually active for the actual-app
  validation runs (same precondition used in phase-1/phase-3 evidence).
- Perplexity/Gemini live DOM may differ from bundled selectors; the CDP probe
  locates the send control generically (composer-relative, icon-only,
  rightmost, attach-excluded), so selector staleness does not block S3.
  Any selector default change requires live DOM evidence recorded in
  TEST_EVIDENCE.
- The CDP debugger technique is already in use for Kimi; no new Electron
  capability or permission is required.
- Electron/Chromium version unchanged; no dependency changes.

## Non-Goals

- Response-capture/stability selector redesign.
- Prompt content or council prompt-builder changes.
- Generalizing the CDP send path to all providers (Perplexity only; Kimi
  already has one; others keep the existing path unless evidence shows
  breakage).
- Clipboard contents save/restore (previously excluded in phase 3; stays out).
- Any new provider, automation-mode, or UI work.

## Approval Bundle

- Mode: STANDARD_BUNDLE
- Bundle ID: council-broadcast-send-hardening-R1
- SPEC Revision approved: 1
- PLAN Revision approved: 1
- Decision: APPROVED
- User message: 2026-08-13 — "council-broadcast-send-hardening의 SPEC rev 1과 PLAN rev 1을 승인"
- Constraints / expiry: implementation limited to the paths listed in Slices;
  no dependency/schema/permission changes; push only at WF:CLOSE to the
  task branch upstream per PROJECT_SCOPE §5.
