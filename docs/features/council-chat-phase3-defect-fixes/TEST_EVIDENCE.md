# Test Evidence: Council Chat Phase 3 Defect Fixes

- Overall Result: **PASS / ready for independent review**. Focused Phase 3, Phase 1, and Phase 2 fixtures pass; Electron-inclusive typecheck exits 0; the production build retains six outputs and transform topology 50/9/1/1. The user completed the final Kimi Accounts route cycle and concurrent image-panel mapping against the final running build and reported both PASS.
- Implementation Base: `394cee2f5b42f26dfecc27548746e424ea6612a8`
- Implementation Head: `75a3eec` — `fix(council): preserve Gemini prompt structure`
- Environment: Windows NT 10.0.26200.0; Node v24.12.0; npm 11.6.2; TypeScript 5.9.3; Electron 41.2.0; Vite 5.4.21; Git 2.55.0.windows.1; `core.autocrlf=true`.
- Data handling: no provider reply body, prompt body, attachment path, cookie/localStorage value, previous clipboard value, or clipboard content is copied into this evidence. Actual-app evidence records only provider identity, boolean/verdict state, counts, truncated digests, and timing metadata already displayed by Siftline.

## Command Evidence

| Timestamp UTC | Target | Command | Exit | Result | AC IDs | Actual output summary |
|---|---|---|---:|---|---|---|
| 2026-08-03T19:35Z | `75a3eec` | Bundle and execute `scripts/verify-council-phase3.ts` | 0 / 0 | PASS | AC-1–AC-7, AC-9–AC-12, AC-15 | `Council Phase 3 verification: assertions=80 PASS`. This includes canonical role/title semantics, dead-code absence, newest-first summaries, exact runtime replay boundaries, Kimi primary invariance, signature positive/negative cases, Gemini bounded direct retry, and content-free lock timing fields. |
| 2026-08-03T19:35Z | `75a3eec` | Bundle and execute `scripts/verify-council-phase1.ts` | 0 / 0 | PASS | AC-1, AC-6 | S2 8 PASS; English moderator baseline 2 PASS; Korean/Kimi moderator 7 PASS. The exact long Kimi role assertion remains strict. |
| 2026-08-03T19:35Z | `75a3eec` | Bundle and execute `scripts/verify-electron-phase2.ts` | 0 / 0 | PASS | AC-7–AC-9, AC-13 | 60 assertions PASS; canonical AI/default order printed unchanged. |
| 2026-08-03T19:35Z | `75a3eec` | `npx tsc --noEmit` | 0 | PASS | AC-13 | No diagnostics with `src` and `electron` included. |
| 2026-08-03T19:36Z | `75a3eec` | `npm run build` | 0 | PASS | AC-13 | Six outputs; transforms 50 renderer / 9 main / 1 preload / 1 spoof. Actual output inspected. |
| 2026-08-03T19:38Z | `394cee2..75a3eec` | Task-scoped raw `git diff --check` | 2 | CLASSIFIED | AC-14 | 676 output lines / 338 `trailing whitespace` findings. Every finding is an added CRLF line; environment has `core.autocrlf=true`. |
| 2026-08-03T19:38Z | `394cee2..75a3eec` | Task-scoped `git -c core.whitespace=cr-at-eol diff --check` | 0 | PASS | AC-14 | Output lines 0; actionable whitespace findings 0. |
| 2026-08-03T19:39Z | `394cee2..75a3eec` | Forbidden-path and scoped secret/data scan | 0 | PASS | AC-4, AC-9, AC-14 | Forbidden changed paths 0; private-key, assigned-secret, absolute user path, clipboard read, renderer-storage value transfer, and suppression findings all 0. |

## Actual Provider / UI Evidence

### Seven-provider observation gate

The user ran the observation-only build through all seven real composers and then reported, “전부다 이상없어. 다음으로 진행해.” Structure enforcement was enabled only for Gemini after that pass. The exact Kimi observation screenshot retained the following content-free fields: method `clipboard`, `verified=true`, `structureMode=observe`, expected/observed non-empty lines `40/40`, equal digest prefix `654fd718b3f23754`, and `structureMatches=true`.

| Provider | Observation state | Stored content-free metrics |
|---|---|---|
| ChatGPT | PASS | Final combined `@all`: user confirmed equal expected/observed signatures and `structureMatches=true`; exact numeric value was not transmitted. |
| Claude | PASS | Final combined `@all`: user confirmed equal expected/observed signatures and `structureMatches=true`; exact numeric value was not transmitted. |
| DeepSeek | PASS | Final combined `@all`: user confirmed equal expected/observed signatures and `structureMatches=true`; exact numeric value was not transmitted. |
| Gemini | PASS | Later enforcement run: 128/128, equal digest `736dd8dadca57030`, `structureMatches=true`. |
| Grok | PASS | Final combined `@all`: user confirmed equal expected/observed signatures and `structureMatches=true`; exact numeric value was not transmitted. |
| Kimi | PASS | 40/40, equal digest `654fd718b3f23754`, `structureMatches=true`, observe-only. |
| Perplexity | PASS | Final combined `@all`: user confirmed equal expected/observed signatures and `structureMatches=true`; exact numeric value was not transmitted. |

No provider other than Gemini is structure-blocked. For providers whose exact numeric values were not transmitted, this evidence records only the user's observed equality verdict and does not reconstruct counts or digests from source.

### Gemini structure-preserving direct path

- First actual attempt at 15:34:56: line-wise direct insertion exposed only 44 observed characters / 1 non-empty line; expected 11,204 characters / 128 lines. Serialized clipboard fallback and native setter also remained at the first line, so the turn failed visibly. This is direct evidence of a transient real-composer failure, not a PASS.
- User-triggered recovery at 15:35:04: method `execCommand-lines`, `verified=true`, expected/observed comparable characters `9486/9486`, identity `Gemini/Gemini`, expected/observed lines `128/128`, equal digest `736dd8dadca57030`, and `structureMatches=true`. The successful direct path did not acquire the clipboard lock.
- After the measured transient failure, the implementation added one bounded internal retry after 800 ms before serialized fallback. The final focused fixture asserts the two-attempt bound and fallback order. The final build was rebuilt and relaunched as Siftline PID 25108; the user's final combined `@all` run passed.

### Kimi Accounts route

- Source/renderer fixture: PASS. Kimi uses `Open panel`; the callback closes Accounts, enables/exposes Kimi, bypasses `openLoginWindow('kimi')`, and synchronizes Council with the unchanged pre-action `primaryAi`.
- Actual `Logged in → Logout → Open panel → in-panel Login → Logged in` cycle with before/after primary observation: **PASS**, user-confirmed on 2026-08-03 against the final running build. No child login popup appeared, the pre-action Focus/Council primary remained unchanged, and Accounts returned from `Not logged in` to `Logged in` after direct panel login.

### Retry, image, and Workflow boundaries

- Exact retry harness: PASS. The replay envelope is cloned in memory, exact prebuilt prompt plus both attachment forms re-enter the serialized queue, missing live replay or missing file returns actionable UI state before send, and no expanded prompt/path is persisted.
- Actual Gemini failure/recovery card: PASS for the no-attachment exact-prompt mode; the visible Retry led to the successful structured insertion above.
- Concurrent image-capable-panel mapping: **PASS**, user-confirmed on 2026-08-03 against the final combined `@all` run. DeepSeek was excluded because its integration rejects image input; every image-capable target panel received the intended image with no cross-panel mismatch. The shared prompt/image mutex and timing fixtures also pass.
- Workflow: not manually exercised. The user retired Workflow as a normal product flow. Canonical shared prompt/type/build coverage passes, and no Workflow behavior was changed.

## Build Artifact Manifest

| Output | Phase 3 base bytes / SHA-256 | Final bytes / SHA-256 | Result |
|---|---|---|---|
| `dist/index.html` | 988 / `04A5FC2C...` | 988 / `A1D68199EE76F52657AC0AA22962D5FB041A0DC016F1994140BB39FD57F91590` | Attributed change: only the content-hashed renderer JS filename reference changes when approved renderer code changes. This contradicts PLAN's literal byte-identical HTML expectation and is disclosed for review. |
| renderer JS | 289374 / `4DE4C68D...` | 292052 / `69A0B89AEE8EB44A160451E32ECB2AC2BA60A8CCDD617A172D19CF066006E8EC` | Expected S1/S4 renderer changes. |
| renderer CSS | 71575 / `A5971E30...` | 71575 / `A5971E3096B594067615BAC3EE5E92F758E02C13CC408726B1A5A1F67458C8F5` | Byte-identical. |
| `dist-electron/preload.js` | 4763 / `874B05A1...` | 4763 / `874B05A15CBE0024AC2501E4B35402250D4458FDC8E7EAEA7E51B0946A7A53CC` | Byte-identical. |
| spoof preload | 6190 / `1BAEE87F...` | 6190 / `1BAEE87F587D9838BA6B5133865DF0850173CE9706D59FAFC0CA947AE800452B` | Byte-identical. |
| `dist-electron/main.js` | 169306 / `3F426EBB...` | 173249 / `0ADA031E9B212ECD617120DC12FDB707BBD8036635C2908E241978907370418A` | Expected S1/S3/S4/S5 main changes. |

Build outputs are ignored and are not task-owned/staged. The renderer filename is `index-C03ZazMl.js`; CSS remains `index-tgr4Ry0z.css`.

## EOL / Scope / Security

- `electron/main.ts`: i/crlf w/crlf — preserved.
- `electron/councilPrompt.ts`: i/lf w/crlf — preserved working-tree CRLF; content numstat 8/6, not a whole-file rewrite.
- `src/types.ts`, `src/App.tsx`, `src/components/AccountsPanel.tsx`, `src/components/CouncilChatPanel.tsx`, and `src/components/Toolbar.tsx`: i/crlf w/crlf — preserved.
- `src/councilModerator.ts`: i/mixed w/mixed — existing mixed per-line state preserved; numstat 1/1, not a whole-file rewrite.
- Focused scripts and feature docs: LF.
- Final review range: 17 tracked paths, 1222 insertions / 299 deletions including SPEC/PLAN/evidence/review docs. Forbidden changes to package/lock, `.gitattributes`, selectors, schema, auth predicates, Kimi helper scripts, dependencies, or Phase 4 routing: 0.
- Mention-free source paths still stop at `intent.kind === 'none'`; focused fixture asserts transcript-only behavior.
- Untracked `_to_delete/` and both handoff-history files remain untouched and unstaged.

## Acceptance-Criteria State

| AC | State | Evidence |
|---|---|---|
| AC-1 | PASS | One seven-provider object with short title/long role/focus/outputGuide; exact semantic fixtures and unchanged UI titles. |
| AC-2 | PASS | Dead persona/builder absent; source search, typecheck, and build pass. |
| AC-3 | PASS | Exact runtime replay fixture and visible no-attachment recovery. |
| AC-4 | PASS | Runtime-only lifecycle/missing-state/missing-file/source scans pass; no persistence/log path. |
| AC-5 | PASS | Newest-fit/chronological pure fixtures. |
| AC-6 | PASS | Existing Phase 1 round/null-bounds regressions remain 17/17 PASS. |
| AC-7 | PASS | Source fixture plus actual no-popup Open panel cycle; Focus/Council primary unchanged. |
| AC-8 | PASS | Phase 2 regression fixture plus actual Kimi logged-in → logged-out → in-panel logged-in cycle. |
| AC-9 | PASS | No auth/storage/clipboard value transfer; scoped scan clean. |
| AC-10 | PASS | Actual direct Gemini recovery preserved 128/128 lines with equal digest and no clipboard lock; enforcement only Gemini. |
| AC-11 | PASS | Negative flattening and positive harmless-fold fixtures pass. |
| AC-12 | PASS WITH EVIDENCE GRANULARITY DISCLOSED | All seven were observed twice and user-confirmed matching; Kimi/Gemini exact metrics are retained, the other five have equality verdicts only. Final image-capable-panel mapping passed; mutex timing fixture/log fields pass. |
| AC-13 | PASS WITH DISCLOSED PLAN DISCREPANCY | Typecheck/build topology/preload/spoof pass; renderer/main attributed. HTML changes only because its hashed renderer asset reference changes. |
| AC-14 | PASS | EOL preserved, actionable whitespace 0, scoped secret/scope findings 0. |
| AC-15 | PASS | Mention-free routing remains transcript-only in both duplicated runtime entry points and fixture. |

## Residual Risk / Review Flags

- Provider composers and DOM behavior remain external and mutable; selectors were not changed.
- Gemini can transiently expose only the first inserted line. The final bounded direct retry reduces this observed timing failure, but compatibility fallback remains visible and serialized rather than being claimed infallible.
- Exact numeric metrics were retained for Kimi and Gemini. The final combined run supplied user-confirmed equality verdicts, but not numeric counts/digest strings, for the other five; this evidence limitation is explicit for independent review.
- PLAN's byte-identical `index.html` validation sentence is not achievable when Vite rewrites the content-hashed renderer JS reference after an approved renderer change. The file remains 988 bytes and its only attributable reason to change is that asset reference; independent review should confirm this classification.
- Existing npm audit findings were not changed or addressed; dependency work is out of scope.
