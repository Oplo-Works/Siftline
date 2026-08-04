# Handoff

## Identity

- Status: DONE
- Task ID: `node-npm-ci-hardening`
- Stage: WF:CLOSE
- Risk: Standard — CI toolchain, lockfile, production dependency security, and Actions runtime maintenance
- Updated At: 2026-08-04T20:20:05Z

## Context Summary

Node.js and npm are now an exact cross-platform contract: Node `22.22.3` and npm `10.9.8`.
The lockfile installs cleanly on Windows and WSL/Linux, production audit is zero, and all GitHub Actions
references use current Node 24 runtimes pinned to full commit SHAs. Four production dependency findings
were removed with minimum safe versions, including SheetJS `0.20.3` from its official CDN.

## Ownership

- Outgoing Role / Runtime: Main Driver / Codex (repository Runtime PIN remains CANDIDATE)
- Next Role: Future Main Driver
- Next Runtime ID: read `docs/MODEL_RUNTIME_PIN.md`; no repository runtime is currently APPROVED
- Next Action: no active implementation task; wait for a new explicit request

## Git and Worktree

- Working branch: `codex/council-chat-phase3-defect-fixes`
- Main integration base: `b753232768f466f9130834c6e5a25b4d50c0cd1b`
- Task implementation base: `bbcdd3adbcfd6a50f552e86694acb32a687d54a6`
- Implementation head: `0242d42f0acecde2abf24ae5323282f2093b8051`
- Close metadata head: SELF — resolve this close metadata commit
- Expected worktree after close: USER_DIRTY_ONLY
- Preserved unrelated untracked paths:
  - `docs/handoff_history/COWORK_SESSION_HANDOFF_council_chat_review.md`
  - `docs/handoff_history/HANDOFF_PROMPT_council_chat_fixes.md`
  - `docs/handoff_history/HANDOFF_siftline_council_phases_1to3.md`

## Publish

- Human approval: explicit commit and direct `git push origin main` instruction on 2026-08-04
- Push Intent: AUTO_AT_CLOSE
- Approved Target: `origin/main`
- Protected branch exception: explicitly approved for this exact normal fast-forward push
- Expected Remote Head: SELF — resolve this close metadata commit
- Push Result: PENDING until the remote SHA is verified
- Prohibited without new approval: force-push, merge, rebase, tag, release, deploy, or PR creation

## Validation

- Evidence: `docs/features/node-npm-ci-hardening/TEST_EVIDENCE.md`
- Windows exact Node/npm `npm ci`: PASS
- WSL/Linux clean checkout exact Node/npm `npm ci`: PASS
- Windows and Linux typecheck/build: PASS
- Production audit: PASS, 0 vulnerabilities
- Full audit: 21 dev-inclusive findings remain (2 low, 3 moderate, 14 high, 2 critical)
- Dependency tree: PASS, no Missing/Invalid entries
- Workflow YAML and full-SHA action references: PASS
- Task-scoped diff/whitespace and secret/PII scan: PASS
- Lint/test: SKIPPED_WITH_REASON; neither script exists and PROJECT_SCOPE marks both unavailable

## Key Decisions and Residual Risk

- Toolchain contract: `.nvmrc=22.22.3`, `packageManager=npm@10.9.8`, engines limited to Node 22/npm 10.
- CI invokes the exact npm version because `actions/setup-node` pins Node but does not independently pin npm.
- SheetJS uses the official `0.20.3` CDN tarball because the public npm registry package is stale.
- Exact overrides hold `@xmldom/xmldom=0.8.13` and `fast-uri=3.1.5` within existing parent ranges.
- Dev-only security debt remains. Fixing it requires separately approved major upgrades, notably
  electron-builder 24 to 26 and Vite 5 to 8, with packaging and application compatibility review.
- Existing packaging dependency deprecation warnings and Vite's CJS Node API warning remain.
- The release workflow was validated statically and through local cross-platform commands. It was not
  dispatched because that external action is outside this close and main pushes do not match the `v*` trigger.
