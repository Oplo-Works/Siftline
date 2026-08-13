# Test Evidence: council-broadcast-send-hardening

- Overall Result: PASS for AC-1..AC-4, AC-6, AC-7 (owner actual-app `@all` run 2026-08-13, full log captured); AC-5 single-mention/Workflow regression still pending
- Implementation Base: `391b294` (`codex/council-chat-phase3-defect-fixes` head)
- Implementation Head: `611d879` (includes MICRO log-drawer fix `611d879`; broadcast bundle code is `84c59dd` + `73be9b7`)
- Verified Target: `611d879`
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
| 2026-08-13T19:44Z | 73be9b7 (worktree) | `npx tsc --noEmit` + `npm run build` | repo root | 0 | ~5s | PASS | AC-6 | after Perplexity CDP-injection fix |
| 2026-08-13T19:44Z | 73be9b7 (worktree) | `npm run package:installer` | repo root | 0 | ~90s | PASS | — | `release\AI-Council-Setup.exe` (123.5 MB) built; owner's uncommitted siftline.ico rebrand included as-is; productName/version unchanged (AI-Council-Setup / 1.0.9) |
| 2026-08-13T07:57Z | 611d879 (installed build) | owner `@all` broadcast, full Logs capture | app UI | — | ~40s | PASS | AC-1, AC-2, AC-3, AC-4 | all 7 AIs injected, sent, and answered; log excerpts below |

### 2026-08-13 `@all` run — log excerpts (owner-captured via the new Copy button)

- AC-1 Gemini: direct one-shot paths still truncate at 44 chars (`verified=false expectedLines=23 observedLines=1`),
  per-line verified insertion detected the drop at line 2 and aborted as designed, then
  `method=clipboard-primary verified=true expectedChars=2195 observedChars=2225
  expectedLineDigest=dd8eabb981f78bb8 observedLineDigest=dd8eabb981f78bb8 structureMatches=true`
  inside `[native-input-lock] #5 paste:gemini` + `[clipboard-lock] #1`. Truncation is now
  detected and repaired before Send instead of being sent truncated.
- AC-2 Perplexity: `method=cdp-insertText verified=true ... observedComparableChars=1833/1833
  expectedLineDigest=74b5919e48cb4ecb observedLineDigest=74b5919e48cb4ecb`, then
  `[native-input-lock] #2 clickSend:perplexity holdMs=547` with no fallback warnings, then
  answer streaming (`text changed 0→2327c … resolving 2679 chars`). No text left in composer.
- AC-3: `[council] <ai>: waiting for composer to become send-ready` logged for every text-only
  turn (perplexity, claude, gemini, grok, chatgpt, kimi, deepseek).
- AC-4: `[native-input-lock] begin/end #1..#8` strictly non-overlapping across
  clickSend/paste sections of all 7 panels; `waitMs` recorded per section.
- Other providers: Kimi CDP Enter succeeded; DeepSeek heuristic click succeeded; ChatGPT,
  Claude, Grok selector clicks succeeded; all answers captured (122–2679 chars; two
  false-positive-guard acceptances are pre-existing response-capture behavior, unchanged).
- Log drawer select & copy (MICRO fix `611d879`): owner-confirmed working — this very log was
  captured with the new Copy button.

## Manual Checks

- Result: PASS for the `@all` broadcast path (see excerpts above). Single `@mention`
  per AI and Workflow `▶ Start` spot checks remain pending with the owner.
- 2026-08-13 first owner run on `84c59dd` (superseded):
  - AC-1 Gemini: PASS (owner-confirmed).
  - AC-2 Perplexity: FAIL on `84c59dd` — prompt filled the composer but Send
    stayed disabled; owner found that deleting and retyping the text manually
    re-enabled Send. Root cause: `execCommand('insertText')` updated the DOM
    while Perplexity's framework state stayed empty; DOM-only readback
    verification could not see the desync. Fixed in `73be9b7`, PASS in the
    2026-08-13T07:57Z rerun above.
- Missing tool/environment: pinned Node 22.22.3 runtime on this machine.

## Skipped / Flaky / Blocked

- Lint/test scripts: SKIPPED_WITH_REASON — neither exist (PROJECT_SCOPE §4).
- AC-5 single `@mention` per AI and Workflow `▶ Start` spot checks: NOT_RUN —
  pending owner run; the shared injection/send path was exercised 7× in the
  passing `@all` broadcast above.

## Residual Risk

- Perplexity/Gemini live DOM may still diverge from probe assumptions; the CDP
  probe is composer-relative and selector-independent, and any failure now
  logs explicitly instead of timing out silently.
- Per-line verified insertion is bounded (200 lines / 15 s); longer prompts
  route to the serialized clipboard fallback by design.
- Static checks ran under Node 24.12.0, not the pinned 22.22.3 contract.
