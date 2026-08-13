# SPEC: Council Broadcast Send Hardening (Gemini injection + Perplexity send)

- Feature ID: council-broadcast-send-hardening
- Risk: Standard
- Bundle ID: council-broadcast-send-hardening-R1
- SPEC Revision: 1
- Status: APPROVED
- Last Updated: 2026-08-13

## Context / User / Goal

- Context: In Council Chat `@all` broadcasts, two providers fail reproducibly or
  intermittently (reported 2026-08-13 with screenshots):
  - **Gemini**: the council prompt is truncated to its first line
    ("You are participating in Siftline as Gemini." — 44 chars) inside the
    composer; the turn then fails. This matches the measured first-line
    truncation documented in
    `docs/features/council-chat-phase1-defect-fixes/TEST_EVIDENCE.md`
    (`expectedChars=10034, observedChars=44`) and the residual risk accepted in
    `docs/features/council-chat-phase3-defect-fixes/TEST_EVIDENCE.md`
    ("Gemini can transiently expose only the first inserted line").
  - **Perplexity**: the full prompt is injected and verified, but Send never
    happens; the text stays in the composer and the turn fails or times out.
- User: single desktop user running 7 logged-in AI panels.
- Goal: every AI targeted by an `@all` broadcast (or a single `@mention`)
  receives the complete prompt and the message is actually submitted, with
  honest failure logging when submission cannot be verified.

### Current behavior

- `pasteText()` (electron/main.ts): Gemini uses line-wise `execCommand`
  insertion with one bounded retry, then a shared-mutex clipboard Ctrl+V
  fallback, then throws. Gemini is the only provider under structure
  enforcement (`STRUCTURE_ENFORCED_AI_NAMES`).
- `waitForComposerReadyToSend()` is invoked **only when files are attached**;
  text-only turns proceed after a fixed `CLICK_SEND_DELAY_MS = 800` sleep.
- `clickSend()` tries, in order: configured selector click → generic DOM
  heuristic ("rightmost icon-only button" walked up from the first
  `textarea`/`contenteditable`) → native Enter via `sendInputEvent`. Perplexity
  has no trusted (CDP) submission path; only Kimi has one.
- `runCouncilBroadcast()` runs all target turns fully in parallel. Every view
  calls `webContents.focus()`, `sendInputEvent()` (mouse clicks, Ctrl+V,
  Enter) and clipboard operations concurrently — OS-level focus and the
  clipboard are process-global resources, so these phases race across panels.
- The generic heuristic can click a non-send control and still return
  `ok: true`, producing a silent no-op send followed by a response timeout.

### Desired behavior

- Gemini's multi-line council prompt is inserted with its structure intact, or
  the truncation is detected and repaired **before** Send.
- Perplexity submission uses a trusted CDP path (mouse click on the located
  send button, clean CDP Enter fallback) with post-submit verification
  (composer cleared or streaming/stop indicator visible), like the existing
  Kimi path.
- Every council send — text-only or with attachments — waits for a
  send-ready composer before clicking.
- Focus-dependent phases (clipboard write/paste, native key/mouse input, CDP
  input) never execute concurrently across AI views; DOM-level injection
  remains parallel.

## In Scope / Out of Scope

- In:
  1. A module-wide native-input mutex serializing focus + `sendInputEvent` +
     CDP-input + clipboard sections across AI views, with a defined lock
     ordering relative to the existing clipboard mutex.
  2. Perplexity CDP trusted-send path with submission verification.
  3. Unconditional `waitForComposerReadyToSend()` before `clickSend()` in the
     council turn path (timeout remains non-fatal, as today).
  4. Gemini structure-safe insertion hardening: per-line verified insertion
     with bounded re-insertion of missing lines, and a focus-verified clipboard
     fallback (confirm the target view's document holds focus before Ctrl+V,
     bounded retry).
  5. Selector/default-config touch-ups justified by live DOM evidence captured
     during TEST (e.g. Perplexity send-button selectors).
- Out:
  - New providers or provider-count changes.
  - Response-capture selector redesign (unless TEST evidence shows a break
    caused by this change).
  - Prompt content / prompt-builder changes.
  - Automatic (unattended) workflow mode, API-only mode, mobile — all remain
    out of scope per PROJECT_SCOPE.
  - Telegram entry-point behavior changes (it shares the pipeline; regression
    check only).

## Affected Areas

- Screens/flows: Council Chat `@all` broadcast and `@mention` single turns;
  Workflow mode send path (shares `pasteText`/`clickSend`) — regression only.
- Data/models: none (no schema, store, or persistence changes).
- APIs/integrations: none external; internal functions `pasteText`,
  `clickSend`, `waitForComposerReadyToSend`, `processCouncilTurn`,
  `runCouncilBroadcast` in `electron/main.ts`.
- Roles/permissions: no change.

## Security · Privacy · Data

- Data class: Internal (local app automation code; no secrets, tokens, or PII
  involved).
- Retention/provider constraints: none new; no network calls added.
- Risks and required approvals: CDP debugger attach/detach on the Perplexity
  view (same technique already used for Kimi). No paid/quota impact. Standard
  risk per CORE §4.

## Edge Cases / Failure Behavior

- Perplexity send button not located by probe → clean CDP Enter → still
  unsubmitted → turn fails with an explicit error log (never silent).
- Gemini direct insertion still truncates after bounded per-line re-insert →
  focus-verified clipboard fallback → still unverified → throw and fail the
  turn (current honest-failure behavior preserved).
- Native-input mutex contention with 7 panels → serialized wait; single
  non-reentrant mutex, lock ordering `nativeInputLock` outer → `clipboardLock`
  inner, never reversed; no nested same-lock acquisition.
- Single `@mention` and Workflow sends share the modified functions → must
  show no regression.
- A provider page mid-navigation or logged out → existing navigation/selector
  failure behavior unchanged.

## Acceptance Criteria

| ID | Observable criterion | Verification | Status |
|---|---|---|---|
| AC-1 | In an `@all` broadcast, Gemini's composer receives the complete multi-line council prompt; logs show `method=` with matching `expectedLineDigest`/`observedLineDigest` (structure enforcement passes) before Send. | Actual app run, Logs drawer evidence | Pending |
| AC-2 | In an `@all` broadcast and a single `@perplexity` turn, Perplexity submission is verified (composer cleared or stop/streaming indicator observed); an unsubmitted turn always produces an explicit error log, never a silent timeout with text left in the box. | Actual app run, Logs drawer evidence | Pending |
| AC-3 | Every council send path (text-only and attachment) invokes the send-ready wait before clicking; logs show `[composer-ready]` entries for text-only turns. | Logs drawer evidence | Pending |
| AC-4 | Focus-dependent sections (clipboard, native Enter/mouse, CDP input) execute serialized across views during `@all`; logs show non-overlapping lock sections. | Logs drawer evidence + code review | Pending |
| AC-5 | Regression: single `@mention` to each logged-in AI and Workflow `▶ Start` still inject and send successfully. | Actual app run checklist | Pending |
| AC-6 | `npx tsc --noEmit` PASS and `npm run build` PASS on Windows repo root. | Validation commands (PROJECT_SCOPE §4) | Pending |
| AC-7 | Prompt content, council prompt builders, and the userData `selectors.json` override mechanism are unchanged. | Diff review | Pending |

## Approval

- Mode: STANDARD_BUNDLE_IN_PLAN
- Standard ledger: PLAN.md#approval-bundle
- High decision: N/A
- User message: 2026-08-13 — SPEC rev 1 + PLAN rev 1 bundle approved
