# Opus 5 Review Request: Electron Typecheck Defect Fixes

## Review Mode

- Mode: `CHAT_ONLY_READ_ONLY`
- Review range: `4a95621c84e43faa6ada6e4f507631443d759975..9c5bf90c14606853551bf7e0b15dd01cf3783b31`
- Implementation head: `9c5bf90c14606853551bf7e0b15dd01cf3783b31`
- SPEC/PLAN: revision 2, approved
- Evidence: `docs/features/electron-typecheck-defect-fixes/TEST_EVIDENCE.md`
- Do not edit files, commit, push, run login/logout, or expose cookie values.

## What Changed

1. Root typecheck now includes `electron`.
2. Electron `AiName` declarations use canonical `src/types.ts`; main also imports canonical ordered `AI_NAMES` and `DEFAULT_ENABLED_AIS`.
3. `getLoginStatus()` derives every boolean through canonical `AI_NAMES` iteration. Kimi generic completion and persisted status share exact `kimi-auth` on a Kimi domain.
4. Optional Electron cookie domains are handled explicitly; the other six provider predicates retain their defined-domain behavior.
5. Legacy Saved Session input is typed separately from the required sanitized output; no eager migration was added.
6. Mutable-global window narrowing and attachment snapshot boundary typing remove the remaining strict diagnostics without suppressions.
7. Three focused scripts verify pure/source contracts, actual isolated Saved Session behavior, and non-secret actual-app status/Chat smoke metadata.

## Required Review Questions

- Does importing canonical `AI_NAMES`/`DEFAULT_ENABLED_AIS` preserve the exact order contract and avoid preload runtime contamination?
- Is `Object.fromEntries(AI_NAMES.map(...)) as Record<AiName, boolean>` justified by the exhaustive canonical loop, with no missing-provider path?
- Does the shared Kimi predicate reject anonymous/generic cookie names and unrelated domains without changing the other six provider rules?
- Does the persisted/current snapshot type split honestly model legacy records while preserving sanitizer defaults and avoiding an unnecessary migration?
- Are TS18048/TS18047/TS7006 fixed by real invariants rather than `any`, ignores, non-null assertions, or silent optional chaining?
- Does build evidence support the required 50/9/1/1 and five byte-identical non-main outputs?
- Are there any scope, EOL, secret, data-mutation, or test-harness issues in `4a95621..9c5bf90`?

## Known Failure — Do Not Reclassify as PASS

- AC-4 was performed after this packet was first written. Initial Kimi status was `true`; user Logout produced `false` and removed `kimi-auth`; user-completed fresh Login established non-secret renderer storage signals but did not recreate `kimi-auth`, so Accounts remained `false` even after app restart.
- AC-4 and the cookie-only portion of AC-5 are FAIL, not merely unperformed. S2 and the bundle are incomplete. Review the implementation range as written, and identify the predicate mismatch explicitly; do not infer that the newly observed storage keys authorize a fix without a revised SPEC/PLAN.

## Reproduction Commands

```powershell
npx tsc --noEmit

$out = Join-Path $env:TEMP 'verify-electron-phase2-review.cjs'
node_modules/.bin/esbuild.cmd scripts/verify-electron-phase2.ts --bundle --platform=node --format=cjs --outfile=$out
node $out

node scripts/verify-electron-phase2-snapshots.mjs
npm run build

git diff 4a95621..9c5bf90 --ignore-cr-at-eol --stat
git -c core.whitespace=cr-at-eol diff 4a95621..9c5bf90 --check -- electron/main.ts electron/councilPrompt.ts electron/preload.ts tsconfig.json scripts/verify-electron-phase2.ts scripts/verify-electron-phase2-snapshots.mjs scripts/probe-electron-login-status.mjs
git ls-files --eol -- electron/main.ts electron/councilPrompt.ts electron/preload.ts tsconfig.json
```

Expected focused result: 36 assertions PASS. Expected snapshot result: PASS and isolated profile removed. Expected typecheck: exit 0. Expected build transforms: 50/9/1/1.

## Requested Output

Return:

- Verdict: PASS or FAIL for the reviewed implementation range.
- Findings ordered by severity with file/line evidence.
- Whether the actual AC-4 failure and resulting AC-5 predicate mismatch are accurately classified.
- Any discrepancy between source, SPEC/PLAN revision 2, and `TEST_EVIDENCE.md`.
