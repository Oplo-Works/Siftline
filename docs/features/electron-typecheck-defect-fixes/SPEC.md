# SPEC: Electron Typecheck and Surfaced Defect Fixes

- Feature ID: `electron-typecheck-defect-fixes`
- Risk: Standard
- Bundle ID: `electron-typecheck-defect-fixes-R2`
- SPEC Revision: 2
- Status: APPROVED
- Last Updated: 2026-08-03

## Context / User / Goal

- Context: The root TypeScript project currently includes only `src`, while Vite separately transpiles the Electron main and preload entries. An in-memory `include: ["src", "electron"]` probe exposes 33 diagnostics in code that the production build already executes.
- User: The single local Siftline desktop user using Accounts, Council Chat, and Saved Sessions.
- Goal: Put all Electron TypeScript under the existing strict typecheck, remove the provider-type divergence that omitted Kimi, and fix the real login-state and legacy snapshot defects revealed by the wider check without changing the Vite/Electron runtime topology.
- Measured baseline:
  - 33 diagnostics: `electron/main.ts` 32 and `electron/councilPrompt.ts` 1.
  - By code: TS18048 x20, TS2345 x8, TS18047 x2, TS7006 x1, TS2741 x1, TS2322 x1.
  - Replacing only `councilPrompt.ts`'s local union with a type-only import in memory leaves 25 diagnostics: TS18048 x20, TS18047 x2, TS2345 x1, TS2741 x1, and TS7006 x1. Therefore S1 removes eight errors, but none of the 20 cookie-domain errors; those are independent Electron `Cookie.domain?: string` findings and must be fixed on their own merits.

## In Scope / Out of Scope

- In:
  - Change root `tsconfig.json` to include both `src` and `electron` so `npx tsc --noEmit` checks the Electron main, preload, prompt, and Telegram TypeScript graph.
  - Replace Electron-local `AiName` unions with type-only imports from `src/types.ts`. Preserve existing exported type contracts. The investigation found three declarations, not one: `councilPrompt.ts` and `preload.ts` both omit Kimi; `main.ts` happens to match today but is still a divergent copy. Reuse canonical runtime `AI_NAMES` and `DEFAULT_ENABLED_AIS` in main instead of retaining the two adjacent duplicate lists.
  - Make `getLoginStatus()` enumerate `AI_NAMES` and return an explicit boolean for every provider, including Kimi.
  - Use the observed persisted Kimi authentication signal: a cookie named exactly `kimi-auth` on a `kimi.com` domain. Verify the false/true transition in the running app before treating that predicate as complete.
  - Model legacy Saved Session records honestly at the persistence boundary, sanitize them into the current required `CouncilSnapshotRecord`, and retain backward-compatible defaults for the five newer fields.
  - Resolve every residual Electron diagnostic after S1 through control-flow narrowing, explicit nullable-cookie handling, accurate data types, or a separately documented defect fix.
  - Add focused verification fixtures and `TEST_EVIDENCE.md`, then run the required compile, build, EOL/diff, Accounts, and Saved Sessions checks.
- Out:
  - Phase 3 role-table/dead-code consolidation, retry attachment parity, and recent-first generic context summarization.
  - Phase 4 copy/state/deduplication items or any default-routing/product redesign.
  - Phase 1 follow-up performance/privacy/readback changes: Gemini clipboard-lock latency, restoring the user's previous clipboard, and line-count-aware readback. These are deferred to a separate Council clipboard/verification-hardening bundle because they are not typecheck findings and require independent behavior decisions.
  - `.gitattributes`, repository-wide EOL normalization, dependency upgrades, `npm audit` remediation, selector changes, provider additions, schema version changes, cloud sync, deploy, release, tag, push, or PR.

## Affected Areas

- Configuration/build: `tsconfig.json`; Vite configuration is inspected but not changed.
- Electron types/runtime: `electron/main.ts`, `electron/councilPrompt.ts`, and `electron/preload.ts`.
- Screens/flows: Accounts login state for Kimi and Saved Sessions list/filter/sort/lifecycle behavior. Council/Telegram prompt types receive compile-time coverage but no routing change.
- Persisted data: backward-compatible reading of legacy `councilSnapshots`; no destructive or eager migration of the user's store.
- Verification/docs: a focused Phase 2 verification script and `docs/features/electron-typecheck-defect-fixes/TEST_EVIDENCE.md` during BUILD/TEST.

## Security · Privacy · Data

- Data class: internal source code, synthetic snapshot fixtures, and non-secret authentication metadata.
- Kimi evidence already collected without cookie values: the authenticated persisted session contained `kimi-auth` on `www.kimi.com`; an isolated anonymous profile did not. Cookie values, tokens, real conversations, and credentials must never enter logs, fixtures, screenshots, or Git.
- The BUILD transition check may inspect cookie names/domains and boolean status only. Logout is user-visible and login requires the user to complete authentication; the agent does not request, enter, preserve, copy, or print credentials/cookie values.
- Saved Session compatibility tests use an isolated temporary Electron profile and synthetic transcript data. The current real store contains zero Saved Session records, so it supplies no legacy sample and must not be seeded for testing.
- No external message, paid API use, provider configuration change, or publication is authorized.

## Current Impact Findings

### S1 — Provider type divergence

- `src/types.ts` is the canonical `AiName` and includes Kimi.
- `electron/councilPrompt.ts` and `electron/preload.ts` each redeclare an older six-provider union that omits Kimi; `electron/main.ts` redeclares the current seven-provider union.
- `councilPrompt.ts` causes the measured TS2322/TS2345 family. `preload.ts` does not currently emit a diagnostic because its IPC values are not checked against the renderer declaration in the same expression, but it is the same latent omission.
- All three Electron declarations will use canonical `AiName`; their existing type exports will be preserved so callers keep the same import surface. Type-only imports disappear from emitted JavaScript. Main will additionally import canonical `AI_NAMES` and `DEFAULT_ENABLED_AIS`; `src/types.ts` has no runtime imports, and Vite will bundle/tree-shake these values without adding an output entry.
- Before removal, `electron/main.ts` and `src/types.ts` both contain exactly `['chatgpt', 'claude', 'deepseek', 'gemini', 'grok', 'kimi', 'perplexity']` in the same order, and their default-enabled lists are both `['chatgpt', 'claude', 'gemini']`. Provider order is a behavior contract: it controls panel layout (`orderedEnabledNames` and view iteration) and sequential Council target ordering. The focused fixture must lock that canonical order.

### S2 — Kimi login status omission

- `getLoginStatus()` fetches six partitions and returns six keys. Its declared `Record<AiName, boolean>` exposes the missing Kimi key as TS2741, while JavaScript returns `undefined`.
- The only renderer consumer is `AccountsPanel.refresh()`. It reads `status[ai]`; Kimi's `undefined` is falsy, so an authenticated Kimi session is shown as “Not logged in,” the button says “Login,” and Logout is disabled.
- Council activation, enabled-provider routing, and send preflight do not consume this return value. They use `enabledAis`, `AI_NAMES`, and BrowserView/session checks, so the omission misreports Accounts state but does not itself disable Kimi or remove it from Council routing.
- Positive/negative evidence supports `domain contains kimi.com && name === 'kimi-auth'` for persisted login status. Generic analytics/UI cookies exist anonymously. Existing broad name matching in `isLoginComplete()` does not match `kimi-auth` and can accept an anonymous cookie whose name contains a generic auth-like fragment. The approved BUILD aligns only the Kimi branch with the exact shared predicate before the real transition; the other six provider predicates retain their semantics. The standalone `kimi-login.mjs` still closes on its existing DOM composer detection, after which the imported cookie set must satisfy the shared predicate.

### S3 — Legacy Saved Session persistence shape

- `StoreSchema.councilSnapshots` describes the old shape and omits `label`, `note`, `lastOpenedAt`, `isArchived`, and `lifecycle`, while `sanitizeCouncilSnapshotRecord()` currently demands the new shape. This mismatch causes the remaining TS2345.
- Every runtime read goes through `getCouncilSnapshots()` and the sanitizer. Legacy records therefore currently receive these in-memory defaults: `label: null`, `note: null`, `lastOpenedAt: savedAt`, `isArchived: false`, and `lifecycle: 'in-progress'`.
- Archived filtering, label/search, opened-time sorting, and lifecycle filtering consume the sanitized summaries, so existing legacy records do not become hidden or invalid. Normalized records are persisted only when an existing mutation path writes the list.
- Conclusion: no eager store migration is required for correct behavior. Introduce an explicit legacy/persisted input type and a current sanitized output type, preserve the existing defaults, and prove the list/filter/sort/load/mutation behavior with an isolated legacy fixture. Do not falsely type raw legacy data as already migrated and do not rewrite the user's store on startup.

### S4 — Residual diagnostics

- TS18047 x2: `mainWindow` is guarded before a synchronous `AI_NAMES.forEach`, but narrowing is lost across the callback because the global is mutable. Capture the guarded window in a local constant; do not add optional chaining that silently skips layout work.
- TS18048 x20: Electron types `Cookie.domain` as optional. Domain matching must explicitly reject missing domains, and cookie copy must skip a cookie that cannot form a host URL. Missing-domain cookies must not throw or accidentally count as authenticated.
- TS7006 x1: the attachment snapshot name collection crosses an `executeJavaScript` boundary without an accurate return type. Type the snapshot/names boundary so the `.some()` callback is a string, rather than annotating an untrusted arbitrary value as string without validation.
- Any new residual diagnostic after these fixes is a finding: classify whether the value is truly nullable, fix the invariant or boundary, and revise the approved bundle if behavior/scope must expand.

## Edge Cases / Failure Behavior

- A future provider is added to canonical `AiName`/`AI_NAMES`: Electron type consumers see it immediately, and login status iteration over the canonical list assigns a boolean rather than silently omitting the property.
- A cookie has no domain: authentication predicates return false for that cookie; cookie-copy code skips it because no valid URL can be constructed. It must not throw.
- Kimi has only anonymous cookies: report false. Kimi has the observed `kimi-auth` cookie on a Kimi domain: report true. A same-named cookie on an unrelated domain must not count.
- Both Kimi login-completion checking and persisted Accounts status use that same predicate, so an anonymous session/token-named cookie cannot close the generic login path early.
- Kimi logout/login cannot be completed because the user declines or the provider is unavailable: record the transition AC as BLOCKED and do not claim S2 or the bundle complete.
- ChatGPT's existing DOM-based status and all other provider predicates must retain their current semantics while collection changes from hand-enumeration to `AI_NAMES` iteration.
- A legacy snapshot lacks all five newer fields: expose the approved defaults and keep it visible in normal/in-progress filters, sortable by `savedAt` as opened time, and mutable through existing lifecycle/archive/annotation actions.
- A malformed snapshot field is present: existing sanitizer limits/defaults still apply; this bundle does not broaden import trust or add a schema version.
- The real store has no snapshots: do not infer compatibility from emptiness; use a synthetic isolated profile.
- Build-equivalence comparison after runtime fixes: output file set and entry topology must match baseline; renderer and both preload hashes must remain identical. `main.js` changes only for S1-S4. Importing canonical runtime `AI_NAMES` is expected to add `src/types.ts` to the main transform graph (baseline 8 → expected 9 modules) without creating another output entry.
- Preserve existing EOL per target: `electron/main.ts` CRLF, `electron/councilPrompt.ts` working-tree CRLF, `electron/preload.ts` LF, and `tsconfig.json` LF. Reject a whole-file rewrite before staging. Do not add `.gitattributes`.
- Task-scoped `git diff --check` can report CR-at-EOL as trailing whitespace under `core.autocrlf=true`; record raw, excluded CR-only, and actionable counts separately and require actionable count zero.

## Acceptance Criteria

| ID | Observable criterion | Verification | Status |
|---|---|---|---|
| AC-1 | Root `tsconfig.json` includes `src` and `electron`; unmodified `npx tsc --noEmit` checks that graph and exits 0. | Inspect config and actual command output. | PASS |
| AC-2 | `AiName` has one type source in `src/types.ts`; `main.ts`, `preload.ts`, and `councilPrompt.ts` import/re-export it without a local union. Main also uses canonical runtime `AI_NAMES`. | `rg` plus tsc/build and emitted-JS inspection. | PASS |
| AC-3 | `getLoginStatus()` derives all provider entries by iterating `AI_NAMES`; every value is boolean and Kimi is never `undefined`. | Focused fixture/instrumentation and actual Accounts response inspection. | PASS |
| AC-4 | In the running app, an authenticated Kimi session reports Logged in, logout changes it to Not logged in, and user-completed login changes it back to Logged in. Only boolean status and cookie names/domains are recorded. A blocked transition prevents S2/bundle completion. | `build-and-run.bat`, Accounts UI, and non-secret Electron/CDP evidence. | BLOCKED |
| AC-5 | Kimi persisted status accepts the observed `kimi-auth` cookie only on a Kimi domain and rejects the isolated anonymous cookie set. Existing six-provider status results retain their semantics. | Positive/negative cookie-name fixtures plus actual status cycle. | PASS |
| AC-6 | Legacy Saved Session input without the five new fields sanitizes to `null`, `null`, `savedAt`, `false`, and `in-progress` respectively without an eager real-store rewrite. | Focused isolated-profile fixture and store before/after metadata inspection. | PASS |
| AC-7 | The sanitized legacy session remains visible, sorts correctly by opened time, loads, and can be labeled, completed/reopened, archived/restored, and saved back in the current shape. | Actual app against an isolated synthetic profile; inspect summaries and persisted field names only. | PASS |
| AC-8 | Missing-domain cookies neither throw nor authenticate/copy; `mainWindow` narrowing and attachment-name typing remove their diagnostics without silent optional-chain fallbacks. | Focused fixtures/code review plus the final diagnostic list. | PASS |
| AC-9 | After each slice and at the end, the Electron-inclusive diagnostic count is measured. Final count is zero; any newly exposed real defect is reported rather than suppressed. | `npx tsc --noEmit` and recorded actual output. | PASS |
| AC-10 | Production build retains the same six-output topology. Renderer/CSS/HTML, preload, and spoof-preload remain byte-identical; the main graph's expected 8→9 transform change and artifact diff are attributable to canonical `AI_NAMES` plus approved S1-S4 runtime code. | Before/after SHA-256 manifest, file sizes, Vite transform counts, and `npm run build` exit 0. | PASS |
| AC-11 | Accounts, Saved Sessions, Council Chat startup/one synthetic message, and affected attachment UI smoke checks pass. Workflow is not manually exercised because the user has retired it from normal use and no Workflow behavior is changed; compile/build guard its shared TypeScript graph. | `build-and-run.bat` manual evidence. | PASS |
| AC-12 | Task-only diff, EOL, secret, and scope checks show actionable whitespace 0, preserve all target EOLs, and show no dependency/lock/selector/schema-version/`.gitattributes` changes. Every PASS includes inspected real output and counts in `TEST_EVIDENCE.md`. | Task-scoped `git diff --check`, `git diff --cached --ignore-cr-at-eol`, `git ls-files --eol`, scoped secret scan, and path audit with `core.autocrlf=true` recorded. | PASS |
| AC-13 | Before duplicate removal, main and renderer provider/default lists are proven identical. After removal, canonical provider order remains `chatgpt, claude, deepseek, gemini, grok, kimi, perplexity`, preserving panel layout and sequential Council target order; canonical defaults remain `chatgpt, claude, gemini`. | Captured pre-change output, focused order/default fixture, and affected call-site inspection. | PASS |

## Approval

- Mode: STANDARD_BUNDLE_IN_PLAN
- Standard ledger: `docs/features/electron-typecheck-defect-fixes/PLAN.md#approval-bundle`
- High decision: N/A
- User message: 2026-08-03, SPEC revision 1 / PLAN revision 1 approved with three BUILD-time conditions; revision 2 records the provider-order contract, canonical default list, and Kimi predicate alignment. Approval explicitly remains valid through revision 2 without another request.

## Revision History

- Revision 1 (2026-08-03): Initial Phase 2 approval bundle based on the 33-diagnostic probe, direct consumer tracing, non-secret Kimi authenticated/anonymous cookie comparison, real-store metadata inspection, and baseline production-build manifest.
- Revision 2 (2026-08-03): Recorded the pre-removal provider/default list equality and order AC, imported canonical `DEFAULT_ENABLED_AIS` alongside `AI_NAMES`, and pre-approved aligning only Kimi's generic login-completion branch with the exact persisted predicate. User approval of revision 1 explicitly extends through these conditions.
