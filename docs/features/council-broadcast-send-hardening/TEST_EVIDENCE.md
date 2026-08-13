# Test Evidence: council-broadcast-send-hardening

- Overall Result: NOT_RUN (static checks PASS; actual-app broadcast partially verified — Perplexity retest pending after 73be9b7)
- Implementation Base: `391b294` (`codex/council-chat-phase3-defect-fixes` head)
- Implementation Head: `73be9b7`
- Verified Target: `73be9b7`
- Environment: Windows 10.0.26200, Node v24.12.0 (`C:\Program Files\nodejs`), npm bundled with that install

> Toolchain deviation: the repository pins Node `22.22.3` (`.nvmrc`) but that
> exact runtime is not installed/discoverable on this machine (no nvm/fnm/
> volta found). Static checks below ran under system Node v24.12.0. Re-run
> under the pinned toolchain before release packaging.

| Timestamp UTC | Target | Command | CWD | Exit | Duration | Result | AC IDs | Notes |
|---|---|---|---|---:|---:|---|---|---|
| 2026-08-13T19:12Z | 84c59dd (worktree) | `npx tsc --noEmit` | repo root | 0 | ~30s | PASS | AC-6 | PATH prefixed with `C:\Program Files\nodejs` (node not on shell PATH) |
| 2026-08-13T19:13Z | 84c59dd (worktree) | `npm run build` | repo root | 0 | ~3s | PASS | AC-6 | vite renderer + main/preload bundles built |
| 2026-08-13T19:16Z | 84c59dd | `git diff --check` | repo root | 2 | <1s | PASS* | AC-7 | *flags CR-at-EOL on every added line under repo `core.autocrlf=true`; clean with standard `core.whitespace=cr-at-eol` rule; committed blob verified LF (`od -c` spot checks); no real trailing whitespace or conflict markers |
| 2026-08-13T19:16Z | 84c59dd | staged diff manual secret/PII review | repo root | — | — | PASS | — | diff is automation logic only; no keys, tokens, PII, or user data |

## Manual Checks

- Result: IN PROGRESS — first owner run done on `84c59dd`; Perplexity retest pending on `73be9b7`.
- 2026-08-13 owner run (app launched via `AI Council.vbs` after `npm run build`):
  - AC-1 Gemini: PASS (owner-confirmed) — full multi-line prompt injected and sent in `@all` broadcast.
  - AC-2 Perplexity: FAIL on `84c59dd` — prompt filled the composer but Send
    stayed disabled; owner found that deleting and retyping the text manually
    re-enabled Send. Root cause: `execCommand('insertText')` updated the DOM
    while Perplexity's framework state stayed empty; DOM-only readback
    verification could not see the desync.
  - Fix iteration `73be9b7`: Perplexity injection switched to trusted CDP
    `Input.insertText` (primary) → native setter/event chain → serialized
    clipboard; execCommand removed from the Perplexity chain. Retest pending.
- Remaining steps (owner, on the running build of `73be9b7`):
  1. `@all` broadcast → expect all 7 AIs reply; Perplexity must submit with no
     text left in the composer; Gemini must remain whole (regression).
  2. Logs drawer evidence to collect:
     - `[native-input-lock] begin/end` sections must not overlap across views (AC-4)
     - `[pasteText] gemini: method=... verified=true` with matching
       `expectedLineDigest`/`observedLineDigest` (AC-1)
     - `[pasteText] perplexity: method=cdp-insertText verified=true`, then
       `[clickSend] perplexity: CDP mouse-click ... succeeded` or
       `CDP Enter-key submission succeeded` (AC-2); any failure must be an
       explicit error, not silence
     - `[council] <ai>: waiting for composer to become send-ready` for
       text-only turns (AC-3)
  3. Regression: single `@mention` to each AI; Workflow `▶ Start` (AC-5).
- Missing tool/environment: pinned Node 22.22.3 runtime on this machine.

## Skipped / Flaky / Blocked

- Lint/test scripts: SKIPPED_WITH_REASON — neither exist (PROJECT_SCOPE §4).
- AC-3..AC-5 actual-app runs: NOT_RUN — interactive session required; owner to
  execute the manual steps above. Agent cannot drive the app's 7 logged-in
  web sessions from this environment.

## Residual Risk

- Perplexity/Gemini live DOM may still diverge from probe assumptions; the CDP
  probe is composer-relative and selector-independent, and any failure now
  logs explicitly instead of timing out silently.
- Per-line verified insertion is bounded (200 lines / 15 s); longer prompts
  route to the serialized clipboard fallback by design.
- Static checks ran under Node 24.12.0, not the pinned 22.22.3 contract.
