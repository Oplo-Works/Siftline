# Opus 5 Review Request: Council Chat Phase 3 Defect Fixes

## Review Mode

- Mode: `CHAT_ONLY_READ_ONLY`
- Review range: `394cee2f5b42f26dfecc27548746e424ea6612a8..HEAD`
- Implementation head: `75a3eec`
- SPEC/PLAN: revision 1, approved with three recorded BUILD conditions
- Evidence: `docs/features/council-chat-phase3-defect-fixes/TEST_EVIDENCE.md`
- Do not edit files, stage, commit, push, run provider login/logout, send provider messages, or expose prompt/reply/auth/attachment values.

## What Changed

1. One canonical seven-provider role object now separates compact UI `title` from long prompt `role`, with `focus` and `outputGuide`; the dead persona table and unused builder are removed.
2. Council summaries fill their budget newest-first and render retained messages chronologically.
3. Failed-turn Retry keeps an exact runtime-only cloned envelope with the prebuilt prompt and both attachment forms. Missing live state or missing files refuses a misleading text-only send.
4. Accounts' Kimi action opens/enables the existing embedded panel without changing Council primary or transferring renderer storage/cookies. The standalone Kimi product route is guarded.
5. Composer readback logs content-free non-empty-line signatures. All seven remain observe-only except measured Gemini; Gemini uses line-wise direct insertion with one bounded retry before the shared serialized clipboard fallback.
6. Prompt and image clipboard fallbacks retain the Phase 1 module-wide mutex with content-free wait/hold timing.
7. Mention-free messages remain transcript-only; Workflow, selectors, auth predicates, dependencies, schema, and Phase 4 behavior are unchanged.

## Required Review Questions

- Is `AI_ROLE_PRESETS` now the single semantic truth while every UI/prompt/moderator consumer deliberately selects short `title` or long `role`?
- Are `AI_REVIEWER_PERSONAS` and `buildReviewerPrompt()` fully dead and safely removed?
- Does recent-first selection preserve complete newest messages and chronological rendering without breaking Phase 1 round fallback?
- Can any retry attachment path or expanded prompt reach persisted Council state, Saved Sessions, logs, evidence, or Git?
- Does retry re-enter the normal serialized queue with exact prompt and attachment arrays, and does every unavailable-state/file boundary stop before send?
- Does `Open panel` bypass the cookie-only child route, enable/expose Kimi, and preserve the pre-action `primaryAi` without auth-value transfer?
- Is the signature definition robust to harmless blank-line folding while detecting flattening, and is enforcement correctly limited to Gemini after observation?
- Is the two-attempt Gemini direct path bounded, structure-verified, and ordered ahead of the unchanged serialized fallback?
- Do mutex timing logs omit contents/paths, and does the image fallback remain protected for the full correctness interval?
- Are EOL, actionable whitespace, scope, and secret classifications supported by the range diff?
- Is the changed `index.html` correctly attributed solely to Vite's changed content-hashed renderer filename, despite PLAN's literal byte-identical sentence?

## Current Actual-App State

- Seven-provider observation was performed by the user and reported clean. The final combined `@all` run also passed. Exact Kimi and Gemini counts/digests are retained; the other five have user-confirmed signature-equality verdicts but their numeric values were not transmitted. Please judge this disclosed evidence granularity rather than treating absent values as reconstructed data.
- Gemini actual recovery succeeded through `execCommand-lines` with 128/128 non-empty lines, matching digests, and no clipboard lock. The preceding real attempt failed at 44 characters/1 line through all safe paths; the final code adds one bounded direct retry based on that evidence.
- Kimi `Open panel` route cycle passed with no child popup, unchanged Focus/Council primary, and `Not logged in → Logged in` after direct panel login. The final concurrent image-capable-panel mapping also passed; DeepSeek was excluded for its documented provider limitation.

## Reproduction Commands

```powershell
$phase3 = Join-Path $env:TEMP 'verify-council-phase3-review.cjs'
node_modules/.bin/esbuild.cmd scripts/verify-council-phase3.ts --bundle --platform=node --format=cjs --outfile=$phase3
node $phase3

$phase1 = Join-Path $env:TEMP 'verify-council-phase1-review.cjs'
node_modules/.bin/esbuild.cmd scripts/verify-council-phase1.ts --bundle --platform=node --format=cjs --outfile=$phase1
node $phase1

$phase2 = Join-Path $env:TEMP 'verify-electron-phase2-review.cjs'
node_modules/.bin/esbuild.cmd scripts/verify-electron-phase2.ts --bundle --platform=node --format=cjs --outfile=$phase2
node $phase2

npx tsc --noEmit
npm run build

git diff --ignore-cr-at-eol --stat 394cee2..HEAD
git -c core.whitespace=cr-at-eol diff 394cee2..HEAD --check -- electron/main.ts electron/councilPrompt.ts src/types.ts src/App.tsx src/components/AccountsPanel.tsx src/components/CouncilChatPanel.tsx src/components/Toolbar.tsx src/councilModerator.ts scripts/verify-council-phase1.ts scripts/verify-council-phase3.ts scripts/verify-electron-phase2.ts docs/features/council-chat-phase3-defect-fixes
git ls-files --eol -- electron/main.ts electron/councilPrompt.ts src/types.ts src/App.tsx src/components/AccountsPanel.tsx src/components/CouncilChatPanel.tsx src/components/Toolbar.tsx src/councilModerator.ts scripts/verify-council-phase1.ts scripts/verify-council-phase3.ts scripts/verify-electron-phase2.ts
```

Expected automated results: Phase 3 `80 PASS`; Phase 1 `17 PASS`; Phase 2 `60 PASS`; typecheck exit 0; build transforms 50/9/1/1 with six outputs; actionable whitespace output 0.

## Requested Output

Return:

- Verdict: PASS or FAIL for the reviewed implementation range, separating automated source confidence from provider-dependent user evidence.
- Findings ordered by severity with file/line evidence.
- Whether exact retry data can leak or silently degrade after lifecycle loss.
- Whether Kimi primary invariance and no-auth-transfer claims are supported.
- Whether Gemini-only structure enforcement and bounded retry are justified by the actual evidence.
- Whether the `index.html` attribution is correct or should block closure.
- Any discrepancy between source, approved SPEC/PLAN revision 1, and `TEST_EVIDENCE.md`.
