# Test Evidence: Council Chat Phase 1 Defect Fixes

- Overall Result: **PASS — INDEPENDENTLY REVIEWED**
- Implementation Base: `b753232768f466f9130834c6e5a25b4d50c0cd1b`
- Implementation Head: `d88c4da0d36281544649d09d17efdc677adb6055`
- Verified Target: implementation commit `d88c4da` plus this review-packet metadata
- Environment: Microsoft Windows 11 Pro 10.0.26200; Node `v24.12.0`; npm `11.6.2`; Git `2.55.0.windows.1`; Electron dependency `41.2.0`
- Approved external block: Telegram regression remains **BLOCKED** because the user will not provide a separate test channel. The user explicitly accepted that block for this bundle; no Telegram message or configuration change was attempted.

## Command evidence

| Timestamp UTC | Target | Command | Exit | Duration | Result | AC IDs | Actual output summary |
|---|---|---|---:|---:|---|---|---|
| 2026-08-03T15:26Z | final implementation | `node_modules/.bin/esbuild.cmd scripts/verify-council-phase1.ts --bundle --platform=node --format=cjs --outfile=%TEMP%/verify-council-phase1-final.cjs` then `node %TEMP%/verify-council-phase1-final.cjs` | 0 / 0 | 0.207s | PASS | AC-6–AC-11 | S2: 8 assertions PASS; captured English moderator baseline: 2 PASS; Korean/Kimi moderator behavior: 7 PASS. Total: 17 assertions. The all-invalid-round regression includes `Q1 background`, excludes `Q2`, and keeps previous-round bounds null. |
| 2026-08-03T15:26Z | final implementation | `npx tsc --noEmit` | 0 | 3.477s | PASS | AC-12 | No diagnostics emitted. |
| 2026-08-03T15:26Z | final implementation | `npm run build` | 0 | 1.897s | PASS | AC-12 | Four Vite targets built; 50/8/1/1 modules transformed. Only the existing Vite CJS Node API deprecation warning was emitted. |
| 2026-08-03T15:28Z | final implementation | `cmd /c build-and-run.bat` | batch 1; install/build 0; app launched | 4.070s to batch return | ADJUSTED PASS | AC-5, AC-12 | `npm install` was up to date, all four builds passed, and Siftline appeared as PID 6244. The batch returned 1 only because its final `timeout /t 2` reported `Input redirection is not supported`; the app was observed and then closed normally. npm reported the pre-existing audit state: 25 vulnerabilities (2 low, 3 moderate, 18 high, 2 critical); dependency remediation is outside this bundle. |
| 2026-08-03T15:29Z | staged implementation packet | `git diff --cached --check -- <six explicit task paths>` plus added-line classification | 2 | <1s | ADJUSTED PASS | AC-12 | Actual output: 580 lines, 290 finding headers. Preserved CR-at-EOL exclusions: 290; actionable spaces/tabs: 0. The raw exit is expected in this checkout because Git treats the preserved CR byte as trailing whitespace. |
| 2026-08-03T15:29Z | staged implementation packet | `git diff --cached --ignore-cr-at-eol --stat/--numstat` and `git ls-files --eol -- <targets>` | 0 | <1s | PASS | AC-12 | Six task files only, `+936/-90`. Content diffs: `councilPrompt.ts +66/-19`, `main.ts +278/-69`, `councilModerator.ts +23/-2`; no whole-file rewrite. EOL states: main `i/crlf w/crlf`, councilPrompt `i/lf w/crlf`, moderator `i/mixed w/mixed`. New SPEC/PLAN/script are LF. |
| 2026-08-03T15:29Z | staged implementation packet | credential-pattern scan over staged diff | 0 | <1s | PASS | AC-12 | OpenAI, Google, GitHub, Telegram, private-key, bearer-value, and email patterns: 0 matches each. User-owned untracked handoff files were excluded from staging. |

### Git/EOL environment note

- `git config --show-origin --get core.autocrlf` returned `file:C:/Program Files/Git/etc/gitconfig true`; `core.eol` and `core.safecrlf` are unset; `.gitattributes` is absent.
- The user observed 712 CR-only findings in a separate run, while the final implementation packet produced 290. Earlier runs in this session produced 284 and 290. Counts are environment/diff-state sensitive; every inspected run had actionable whitespace count 0. The finding count is evidence, not a stable product metric.
- The saved pre-edit mixed-EOL reconciliation for `src/councilModerator.ts` matched 161 unchanged lines with 0 EOL mismatches. Its staged content diff is only `+23/-2`, so the 163-line mixed file was not normalized or rewritten.

## Actual-app checks

Only synthetic prompts, synthetic images, and a synthetic saved session were used. Evidence records method, lengths, expected/observed identity, status, and image order; it does not retain credentials, cookies, prompt bodies, or unrelated transcript content.

| Timestamp UTC | Check | Result | AC IDs | Evidence summary |
|---|---|---|---|---|
| 2026-08-03T15:02Z | measured Gemini direct-insertion failure | PASS (diagnostic) | AC-1 | Before the approved correction, a real Gemini contenteditable attempt logged `method=execCommand`, `expectedChars=10034`, `observedChars=44`, with expected/observed identity both `Gemini`; another run measured `3529/44`. Identity alone therefore could not validate the truncated prompt. These measurements establish first-line truncation and motivated the structure-preserving clipboard-primary exception. |
| 2026-08-03T15:09Z | final R4 seven-provider identity round | PASS | AC-1, AC-3, AC-5 | All seven providers were authenticated and manually active. Gemini logged one serialized lock section and `method=clipboard-primary`, `expectedComparableChars=1397`, `observedComparableChars=1397`, identity `Gemini/Gemini`. ChatGPT, Claude, DeepSeek, Grok, Kimi, and Perplexity each logged `method=execCommand`, `verified=true`, and their own matching expected/observed identity before Send. No newline flattening remained. |
| 2026-08-03T13:19Z | Kimi failure guard and long prompt | PASS | AC-3, AC-4 | An intentional readback mismatch produced the visible failed-turn recovery state and prevented Send. A later prompt over 9,000 characters used verified direct insertion; it did not enter clipboard fallback or Kimi's TXT-conversion path. |
| 2026-08-03T13:40Z | forced concurrent image clipboard fallback | PASS | AC-2, AC-13 | Two labeled 640×360 PNGs produced exactly 12 non-overlapping lock sections, `#1`–`#12`: ChatGPT, Claude, Gemini, Grok, Kimi, and Perplexity each received image A then B. No image/image or image/text clipboard section crossed. DeepSeek was correctly excluded because its existing web integration rejects images before fallback. A normal build removed the temporary ignored-dist marker; final marker count was 0. |
| 2026-08-03T15:12Z | Council routing and moderator surface | PASS | AC-5, AC-9–AC-11 | Single mention and parallel `@all` routing had already passed; the final round rendered the Council and Moderator surfaces with all seven active. Deterministic fixtures separately cover Korean classifications, concise thresholds, English baseline preservation, and Kimi selection rules. |
| 2026-08-03T15:14Z | Candidate Pin/Compare | PASS | AC-12 | Two assistant replies were pinned. The UI rendered two candidate cards, Compare Summary, a recommended candidate, remaining risks, and Merged Council Draft. Selection then marked the saved snapshot dirty and exercised UI-state persistence. |
| 2026-08-03T15:15Z | Saved Sessions lifecycle | PASS | AC-12 | Synthetic session save, favorite quick rail, complete/reopen, duplicate, dirty state, 3-second autosave, rename, note/label, archive/Archived-filter/restore, export, and import all passed. Export produced a 17,064-byte version-1 JSON in `%TEMP%`; import increased snapshot count from 2 to 3. All three synthetic snapshots and the temporary JSON were deleted after verification. |
| 2026-08-03T15:18Z | Workflow shared-path regression | PASS | AC-12 | For regression only, a saved Council handoff reached `Start → Next` after Perplexity primary completion, `Next → Continue` after all six reviewers completed (including the normal Kimi wait), and `Continue → Done` after the final Perplexity revision. The user subsequently clarified that Workflow is not a normal-use/product-priority surface; no Workflow expansion is included or recommended by this bundle. |

## Static inspection

- `clipboard.writeText(` occurrences: 1, inside the prompt critical section.
- `clipboard.writeImage(` occurrences: 1, inside the image critical section.
- `withClipboardLock(` call sites: 2, prompt and image. The FIFO promise tail releases in `finally` and rejected predecessors are absorbed before the next operation.
- Legacy `expected.slice(0, 32)` checks: 0.
- Gemini newline-flattening rewrite: 0 matches. Gemini passes the original multi-line string to the serialized clipboard-primary path.
- Non-Gemini direct insertion uses `document.execCommand('insertText')`; verification evaluates `value`, `innerText`, and `textContent`, compares normalized content conservatively, and requires the exact Council identity before Send.
- `findPreviousRoundBounds()` is the shared source for previous-round extraction and earlier-context summarization. A null-bounds branch restores the legacy second-to-last-user cutoff.
- No selector, dependency, persisted schema, provider list, role table, Telegram whitelist, or `.gitattributes` change is present.

## Manual regression and blocked checks

- PASS: application launch; seven embedded authenticated provider panels; Accounts/History/Logs surfaces; Council `@AI` and `@all`; new Council session; Hybrid Focus layout; moderator; Kimi long prompt; Perplexity/DeepSeek prompt compatibility; six-provider image-capable mapping; Candidate Pin/Compare/Merge; Saved Sessions lifecycle; required Workflow shared-path regression.
- BLOCKED by approved external constraint: Telegram send/receive, mention/file/slash-command, attachment entry point, and unauthorized-Chat-ID checks. The user explicitly declined to provide a separate test channel. No external Telegram action was taken, and the whitelist/configuration was not changed.
- Not expanded: Workflow was exercised only because it shares the modified injection path and was listed in the approved regression. The user states normal use is Chat-centered and Workflow should not be treated as a product-priority feature.

## Cleanup and residual risk

- Cleanup PASS: three synthetic Saved Sessions removed (`after=[]`); temporary export, screenshots, and bundled verification script removed; forced dist marker count 0; final Siftline process closed normally.
- Dynamic provider DOM changes remain an operational risk, but this bundle adds no hard-coded selector and does not change `electron/selectors.json`.
- Telegram remains unverified by explicit user choice. This is visible and accepted, not silently treated as executed.
- The existing npm audit findings are unchanged and outside the approved scope.
- Phase 2/3 audit items and repository-wide EOL policy/`.gitattributes` remain separate future bundles.
- No push, PR, deploy, release, tag, paid API, credential change, or external message was performed.

## Independent review result

- Reviewer: Opus 5, CHAT_ONLY_READ_ONLY, reported by the user on 2026-08-03.
- Review range: `b753232768f466f9130834c6e5a25b4d50c0cd1b..d88c4da0d36281544649d09d17efdc677adb6055`.
- Decision: **PASS**; no blocking findings and no remediation requested.
- Direct reviewer checks: Gemini clipboard-primary/no-flattening and `10034/44` first-line diagnostic self-consistency; null-bounds earlier-context fallback; bundled helper 17/17; independent fixtures 8/8; `npx tsc --noEmit` exit 0; working-tree content diff 0; three target EOL states preserved; no out-of-scope package/lock/`.gitattributes`/selector/schema changes.
- Reviewer assessment: evidence honestly explains the environment-sensitive CR-only count and does not overstate Telegram, DeepSeek image, or Workflow coverage.

## Close transition

- Status: `DONE`
- Close mode: local metadata commit only; push/PR/tag/release remain prohibited.
