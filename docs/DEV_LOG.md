# Development Log — Siftline

## Project

Siftline — 7개 LLM 교차검증 + 자유토론 Electron 데스크톱 앱

## Current Status

v1.0.8 출시 상태. 모든 핵심 기능 정상 동작 중
(상세: `docs/PROJECT_SCOPE.md`의 "Must Preserve" 목록).

## Current MVP Scope

이 앱은 사실상 MVP + v1이 완료된 상태입니다. 범위는 `docs/PROJECT_SCOPE.md` 참조.

## Important Decisions

| Date | Decision | Reason |
|---|---|---|
| 2026-05-14 | AI Coding Agent Workflow Manual 도입 | 향후 기능 추가 시 안정성 확보. 코드는 미변경, 문서·프로세스만 추가 |

## Completed Work

| Date | Work | Notes |
|---|---|---|
| 2026-05-26 | **Field Test #3**: FinalResult 복사 알림 개선 (`FinalResultPanel.tsx`, `index.css`) | tsc 통과, Windows 앱 확인 완료. |
| 2026-05-26 | **Field Test #2**: History AI 필터 추가 (`src/components/HistoryDrawer.tsx`) | tsc 통과, Windows 앱 확인 완료. |
| 2026-05-26 | **Field Test #1**: Log timestamp 추가 (`src/types.ts`, `electron/main.ts`, `src/components/LogDrawer.tsx`) | tsc 통과, Windows 앱 확인 완료. |
| 2026-05-14 | `docs/` 워크플로 문서 4종 신설 (BLUEPRINT, SCOPE, AGENT_WORKFLOW, DEV_LOG) | 코드 변경 0줄. 추가만 수행 |

> v1.0.8 이전 개발 이력은 git log 참조 (`git log --oneline`).

## Open Issues

| ID | Issue | Priority | Status |
|---|---|---|---|
| — | (없음) | — | — |

## Build / Test Log

| Date | Command | Result | Notes |
|---|---|---|---|
| 2026-05-26 | `npx tsc --noEmit` | ✓ PASS | Field Test #1 코드 변경 후 타입 에러 없음 |
| 2026-05-26 | `npm run build` | Windows에서 확인 필요 | sandbox는 rollup native 모듈 호환 불가 |
| 2026-05-14 | (해당 없음) | — | 문서만 추가, 코드 빌드 불필요 |

## Risks / Follow-Ups

| Date | Risk or Follow-Up | Owner | Status |
|---|---|---|---|
| 2026-05-14 | AI 사이트 DOM 변경 시 `electron/selectors.json` 갱신 필요 | Minkyu | 상시 모니터링 |

## Next Steps

1. 앞으로 모든 기능 추가는 `/spec → /plan → /build → /test → /review → /log` 적용
2. 의미 있는 변경마다 이 파일 업데이트
3. 작업이 `PROJECT_SCOPE.md`의 "Must Preserve"에 영향을 주는지 매번 확인
## 2026-06-03 Update

- Work: Hybrid Focus Council Layout (`App.tsx`, `PanelGrid.tsx`, `TitleBar.tsx`, `Toolbar.tsx`, `index.css`, `electron/main.ts`)
- Notes: Council Chat now opens as the primary workspace, the top-level Workflow mode toggle is hidden, active AI BrowserViews use a left Focus pane plus center Compare grid, and chat mode hides Workflow-era final/handoff UI.
- Verification: `npm run build` PASS.

## 2026-06-03 Release Packaging

- Work: Prepared v1.0.9 installer release metadata and GitHub Actions packaging workflow.
- Notes: Windows installer builds locally with NSIS; macOS DMGs build on GitHub Actions macOS runners when tag `v1.0.9` is pushed.

---

> **2026-07-11부터 이 프로젝트는 AI Coding Agent Workflow v8.1.1-solo를 사용한다.**
> 현재 상태의 소유권은 `docs/HANDOFF.md`에 있으며, 이 파일은 append-only 이력이다.
> 위의 기존 항목들은 v5 Lean 시기의 원본 그대로 보존한다. 이후 이벤트 형식은
> `docs/workflow/CLOSE.md`를 따른다.

## 2026-07-11T12:47:15Z — workflow-adoption-v8.1.1

- Stage: WF:REVIEW  - Role/Runtime: Main Driver / Claude Code (observed `claude-fable-5`, PIN: CANDIDATE)  - Risk: Standard
- Implementation: `68a2700`..SELF (adoption artifact commit — Git history에서 해석)
- Review: `docs/migration/V8.1.1_ADOPTION_REVIEW.md` — advisory (동일 모델 fresh-context); PIN에 APPROVED Independent Reviewer 부재로 공식 독립 리뷰 대기
- Human Decision: N/A (대기)
- Detected source workflow: LEGACY_V5 — "Project Engineering OS v5 Lean"
- Summary: v8.1.1-solo 워크플로 번들(25파일 중 workflow-owned 19파일) 설치. 레거시
  CLAUDE.md/AGENT_WORKFLOW.md/PROJECT_SCOPE.md/DEV_LOG.md를
  `docs/archive/workflow/pre-v8.1.1-20260711T124715Z/`에 아카이브. CLAUDE.md/AGENTS.md
  bootstrap merge, AGENT_WORKFLOW.md는 SUPERSEDED pointer로 교체, PROJECT_SCOPE
  v8.1.1 schema 재구성(사실 보존), MODEL_RUNTIME_PIN/HANDOFF 신설,
  LEGACY_WORK_INDEX·ADOPTION_REPORT 작성, .gitignore 안전 병합, .env.example 신설.
  애플리케이션 소스·의존성·schema 변경 없음.
- Validation: `docs/migration/V8.1.1_ADOPTION_REPORT.md` 참조 — package 25/25 일치
  PASS, ZIP↔master 내용 일치 PASS, active-file 레거시 회귀 탐색 PASS,
  `npx tsc --noEmit` / `npm run build` 결과는 리포트 Validation 섹션에 기록
- Publish Intent/Target: AUTO_AT_CLOSE → `origin/chore/adopt-workflow-v8.1.1`
  (독립 리뷰 게이트 전 push 보류; main 직접 push는 NEVER)
- Decisions / Risks / Follow-ups: PROJECT_SCOPE(READY_FOR_APPROVAL)·MODEL_RUNTIME_PIN(DRAFT)
  사용자 승인 필요. 레거시 "항상 main 커밋" 규칙은 HUMAN-OWNED Push 정책으로 대체됨
  (유지 원하면 SCOPE §7-5). `v*` 태그 push는 릴리스 CI 트리거이므로 ASK_SEPARATELY.
- Next: READY_FOR_REVIEW + Independent Reviewer(또는 Human Approver)

## 2026-07-11T13:09:58Z — workflow-adoption-v8.1.1 / advisory review + remediation

- Stage: WF:REVIEW  - Role/Runtime: 4-lens advisory review + Main Driver remediation (Claude Code, observed `claude-fable-5`)  - Risk: Standard
- Implementation: `26937f4`..SELF (remediation + review-artifact commit)
- Review: `docs/migration/V8.1.1_ADOPTION_REVIEW.md` — advisory 4-렌즈 리뷰:
  P1 2건(리뷰 아티팩트 선참조 — 위 도입 이벤트의 "Review:" 행이 가리키던 파일이
  당시 미존재) 검출 → 이 커밋에서 아티팩트 생성 및 리포트/HANDOFF 문구 교정으로
  해결. remediation 검증 후 advisory PASS. 공식 독립 리뷰(APPROVED runtime)는
  여전히 대기.
- Human Decision: N/A (대기)
- Summary: 리뷰 findings remediation — REVIEW 아티팩트 생성, HANDOFF 재작성(자기모순
  제거·SHA 해석), 리포트 교정, MANIFEST에 CRLF/blob-OID 주석, SCOPE(Future
  candidates·npm start·stale 경로 주석), PIN 문구 완화. 앱 소스 변경 없음.
- Validation: 경로 실존 재검사 PASS, 레거시 회귀 grep PASS (상세: REVIEW 문서)
- Publish Intent/Target: AUTO_AT_CLOSE → `origin/chore/adopt-workflow-v8.1.1` (보류 유지)
- Decisions / Risks / Follow-ups: OPEN follow-ups 4건 — PROJECT_STATE 배너(사용자
  동의 필요), stale worktree prune, owner 이메일 공개 확인, v1.0.9 산출물 확인
- Next: READY_FOR_REVIEW + Independent Reviewer(또는 Human Approver)

## 2026-07-11T13:20:47Z — workflow-adoption-v8.1.1 / CLOSE

- Stage: WF:CLOSE  - Role/Runtime: Main Driver / Claude Code (observed `claude-fable-5`)  - Risk: Standard
- Implementation: `68a2700`..`a5a7254` (adoption `26937f4` + remediation/review `a5a7254`)
- Review: `docs/migration/V8.1.1_ADOPTION_REVIEW.md` — advisory PASS
- Human Decision: APPROVED — 2026-07-11 사용자 지시 "git push origin main"
  (publish-to-main 명시 승인; protected-main 기본값에 대한 1회 예외.
  기본 Push 정책 자체는 SCOPE §5 그대로 유지)
- Summary: 사용자 승인에 따라 main을 adoption head로 fast-forward(merge 커밋 없음)
  하고 close metadata commit 후 `origin/main`으로 1회 push. push 전 SCOPE의 owner
  이메일을 제거 (공개 레포 신규 노출 방지 — 리뷰 P3 follow-up 반영; 기존 커밋
  이력의 git identity는 placeholder라 실이메일 미노출 상태였음).
- Validation: 도입 검증 결과 유지 (tsc PASS / build PASS / 회귀·무결성 PASS —
  ADOPTION_REPORT 참조). CLOSE에서 앱 소스 추가 변경 없음.
- Publish Intent/Target: AUTO_AT_CLOSE (사용자 명시 예외) → `origin/main`,
  태그 push 없음. 실제 push 결과는 채팅 Output Block 기록 — 다음 START가 reconcile.
- Decisions / Risks / Follow-ups: PROJECT_SCOPE §7 확정 + PIN 승인 대기.
  follow-ups: PROJECT_STATE 배너(별도 task), stale worktree prune(사용자),
  v1.0.9 산출물 확인, package-lock.json 처리(사용자).
- Next: DONE + Human (정책 승인 후 다음 task 선택)

## 2026-08-03T15:34:50Z — council-chat-phase1-defect-fixes / review packet

- Stage: WF:TEST → WF:REVIEW  - Role/Runtime: Implementation Owner / Codex
  (`codex-sol-deep` requested; repository PIN: CANDIDATE)  - Risk: Standard
- Implementation: `b753232768f466f9130834c6e5a25b4d50c0cd1b`..`d88c4da0d36281544649d09d17efdc677adb6055`
- Review: pending Opus 5 CHAT_ONLY_READ_ONLY review;
  `docs/features/council-chat-phase1-defect-fixes/OPUS5_REVIEW_REQUEST.md`
- Human Decision: revision 4 APPROVED for BUILD/TEST/local commit packet; no CLOSE decision yet
- Summary: Council Chat Phase 1의 공용 text/image clipboard mutex, Gemini
  structure-preserving clipboard-primary, exact panel identity/readback gate, Kimi long-prompt
  protection, last answered-round discovery/null-bounds earlier-summary fallback, Korean
  moderator signals 및 Kimi speaker coverage를 구현했다. Phase 2/3, selector, dependency,
  schema, `.gitattributes`는 변경하지 않았다.
- Validation: `docs/features/council-chat-phase1-defect-fixes/TEST_EVIDENCE.md` — helper
  17/17, `npx tsc --noEmit`, `npm run build`, seven-provider identity, six image-capable
  panel mapping, Candidate Pin/Compare, Saved Sessions lifecycle, shared-path Workflow smoke
  PASS. Staged whitespace raw 290 / CR-only 290 / actionable 0; secret scan 0.
  Telegram은 사용자 승인 하에 별도 테스트 채널 미제공으로 BLOCKED.
- Publish Intent/Target: NOT_REQUIRED / none — push 금지 유지
- Decisions / Risks / Follow-ups: 사용자는 Siftline Chat을 주 기능으로 사용하며 Workflow를
  제품 우선순위로 보지 않음. npm audit 25건과 EOL policy/`.gitattributes`는 별도 bundle.
  합성 Saved Session 3개와 모든 temp artifact를 제거했고 app process를 정상 종료함.
- Next: READY_FOR_REVIEW + Opus 5 independent reviewer

## 2026-08-03T15:49:12Z — council-chat-phase1-defect-fixes / CLOSE

- Stage: WF:CLOSE  - Role/Runtime: Implementation Owner / Codex
  (`codex-sol-deep` requested; repository PIN: CANDIDATE)  - Risk: Standard
- Implementation: `b753232768f466f9130834c6e5a25b4d50c0cd1b`..`d88c4da0d36281544649d09d17efdc677adb6055`
- Review: Opus 5 CHAT_ONLY_READ_ONLY — **PASS**, user-reported 2026-08-03; no findings or remediation
- Human Decision: N/A — Standard review PASS satisfies the CLOSE entry gate
- Summary: Opus 5 independently confirmed Gemini multi-line preservation and `10034/44`
  truncation evidence, null-bounds earlier-context recovery, helper 17/17 plus independent 8/8,
  tsc, clean content diff, EOL preservation, and scope discipline. Phase 1 is closed locally.
- Validation: `docs/features/council-chat-phase1-defect-fixes/TEST_EVIDENCE.md` — PASS,
  independently reviewed; Telegram remains an explicitly accepted external BLOCKED check.
- Publish Intent/Target: NOT_REQUIRED / none; push, PR, tag, and release not attempted
- Decisions / Risks / Follow-ups: Phase 2 typecheck bundle proceeds to SPEC/PLAN only.
  Phase 3/4, `.gitattributes`, npm audit, dependency/selector changes remain excluded.
- Next: DONE for Phase 1; Main Driver → Phase 2 WF:SPEC_PLAN

## 2026-08-03T16:04:18Z — electron-typecheck-defect-fixes / SPEC_PLAN

- Stage: WF:SPEC_PLAN  - Role/Runtime: Main Driver / Codex
  (`codex-sol-deep` requested; repository PIN: CANDIDATE)  - Risk: Standard
- Baseline: `eb6eac2112cc390794833c73656d6a8da78a9b76` (Phase 1 local CLOSE)
- Human Decision: NEEDS_APPROVAL — SPEC revision 1 / PLAN revision 1; BUILD not started
- Summary: Electron-inclusive strict typecheck와 그로 드러난 S1-S4 결함 수정 번들을 작성했다.
  in-memory probe 33건, S1-only simulation residual 25건을 실측했다. Electron의 세 로컬
  `AiName` 선언을 canonical type-only import로 통일하고, Kimi Accounts login status를
  `AI_NAMES` 순회와 실측 `kimi-auth` 조건으로 채우며, legacy Saved Session persisted input을
  current sanitized record와 분리하는 안이다. Cookie.domain nullability, mainWindow narrowing,
  attachment snapshot typing도 진단별 불변식으로 처리한다.
- Investigation: Kimi status의 renderer 소비처는 AccountsPanel 하나이며 Council 활성화/라우팅에는
  직접 사용되지 않는다. 인증 세션에는 `www.kimi.com`의 `kimi-auth`가 있고 삭제한 isolated
  anonymous profile에는 없었다(값 미수집). 실제 store의 Saved Session count는 0이고 모든 read는
  sanitizer를 거치므로 eager migration 대신 isolated legacy fixture를 계획했다.
- Build Baseline: `npm run build` exit 0, transforms 50/8/1/1, 6개 산출물 same-source
  before/after size/SHA-256 완전 동일. root tsconfig include는 Vite entry discovery와 무관하며
  `tsconfig.node.json`의 vite.config 전용 참조도 유지한다.
- Scope: Phase 3/4, Gemini clipboard follow-ups, `.gitattributes`/EOL normalization,
  dependencies/audit/selectors, push/PR/tag/release 제외. `core.autocrlf=true`와 네 target별 EOL을 기록했다.
- Publish Intent/Target: NOT_REQUIRED / none — push/PR 금지
- Next: NEEDS_APPROVAL + Human Approver

## 2026-08-03 — electron-typecheck-defect-fixes / APPROVAL → BUILD

- Stage: WF:SPEC_PLAN → WF:BUILD  - Role/Runtime: Implementation Owner / Codex
  (`codex-sol-deep` requested; repository PIN: CANDIDATE)  - Risk: Standard
- Human Decision: APPROVED — revision 1 plus three BUILD-time conditions; revision 2 records
  those conditions and remains approved without another request
- Conditions: capture/fixture canonical provider order, canonicalize adjacent default-enabled list,
  and align only Kimi's `isLoginComplete()` branch with the exact shared `kimi-auth` predicate.
- Scope: existing exclusions and no-push rule unchanged. `_to_delete/` is task-external review trash;
  the agent will neither preserve it as user data nor modify/delete it.
- Next: BUILD Slice 1

## 2026-08-03T16:50:22Z — electron-typecheck-defect-fixes / review packet

- Stage: WF:TEST → WF:REVIEW  - Role/Runtime: Implementation Owner / Codex
  (`codex-sol-deep` requested; repository PIN: CANDIDATE)  - Risk: Standard
- Implementation: `4a95621c84e43faa6ada6e4f507631443d759975`..`9c5bf90c14606853551bf7e0b15dd01cf3783b31`
- Human Decision: revision 2 APPROVED; Kimi user-transition nonresponse must remain BLOCKED
- Summary: Electron-inclusive strict typecheck, canonical provider/default sources, exhaustive seven-provider
  login status, shared exact Kimi predicate, legacy snapshot persisted/current type split, and residual
  cookie/window/attachment strict fixes implemented. No Phase 3/4, dependency, selector, EOL-policy,
  package/lock, push, or PR change.
- Validation: `TEST_EVIDENCE.md` — tsc 0; focused 36/36; isolated Saved Sessions PASS and temp removed;
  build outputs 6 / transforms 50/9/1/1 / non-main five hashes identical; actual seven-boolean status and
  Kimi exact cookie metadata; user-confirmed Chat smoke; raw whitespace 116 all CR-only/actionable 0;
  secret/scope findings 0. Official PTY launcher exit 0. AC-4 remains BLOCKED.
- Review: pending Opus 5 CHAT_ONLY_READ_ONLY; `OPUS5_REVIEW_REQUEST.md`
- Publish Intent/Target: NOT_REQUIRED / none — push/PR prohibited
- Next: READY_FOR_REVIEW + Opus 5; afterward obtain Kimi manual transition before CLOSE

## 2026-08-03T17:58:12Z — electron-typecheck-defect-fixes / actual Kimi transition failure

- Stage: WF:REVIEW → WF:SPEC_PLAN  - Role/Runtime: Implementation Owner / Codex
  (`codex-sol-deep` requested; repository PIN: CANDIDATE)  - Risk: Standard pending revised auth design
- User Action: Kimi Logout and fresh Login completed in the running app.
- Actual Result: initial `kimi:true` with exact `kimi-auth`; Logout produced `kimi:false` and removed the
  cookie. Fresh Login produced non-empty `access_token`, `refresh_token`, and user-id storage-key presence
  with no login control, but did not recreate `kimi-auth`; Accounts IPC remained `kimi:false` after restart.
  No cookie/token values were read into evidence or recorded.
- Decision: AC-4 and AC-5 integration state FAIL; S2 and the bundle remain incomplete. The approved
  cookie-only predicate is not changed speculatively. Return to SPEC/PLAN approval for a safe renderer/main
  authentication-state contract and logout behavior.
- Publish Intent/Target: NOT_REQUIRED / none — push/PR prohibited
- Next: NEEDS_APPROVAL + Human Approver; independent review resumes after revised S2 approval/fix

## 2026-08-03T18:10:18Z — electron-typecheck-defect-fixes / SPEC+PLAN revision 3 ready

- Stage: WF:SPEC_PLAN  - Role/Runtime: Main Driver / Codex
  (`codex-sol-deep` requested; repository PIN: CANDIDATE)  - Risk: Standard status-display boundary
- User Direction: “승인이야. 다음 단계로 가자” authorizes preparing the next revision. It is not
  recorded as approval of substantive revision-3 content that had not yet been presented.
- SPEC/PLAN: revision 3 / bundle `electron-typecheck-defect-fixes-R3`, READY_FOR_APPROVAL.
- Proposed S2 Rule: exact-domain legacy `kimi-auth` OR a validated exact-origin renderer result where
  `access_token`, `refresh_token`, and `msh_user_id` presence are all true. Only booleans may cross to
  main; partial/malformed/unrelated-origin/error/timeout cases are false. Existing standalone Kimi login,
  Logout clearing, and the other six providers remain unchanged.
- Validation Gate: current fresh login must first report true without `kimi-auth`, then a repeated
  user-operated `true → false → true` cycle must pass. AC-14 prohibits auth values in IPC/logs/evidence.
- Scope: expected runtime/test changes are `electron/main.ts` and `scripts/verify-electron-phase2.ts`;
  no dependency, selector, `kimi-login.mjs`, preload/renderer, EOL-policy, Phase 3/4, push, or PR change.
- Next: READY_FOR_APPROVAL — explicit SPEC revision 3 + PLAN revision 3 approval required before BUILD

## 2026-08-03T18:12:55Z — electron-typecheck-defect-fixes / revision 3 APPROVAL → BUILD

- Stage: WF:SPEC_PLAN → WF:BUILD  - Role/Runtime: Implementation Owner / Codex
  (`codex-sol-deep` requested; repository PIN: CANDIDATE)  - Risk: Standard status-display boundary
- Human Decision: APPROVED — after the revision-3 SPEC/PLAN packet was presented, the user instructed
  “빌드 시작해줘,” explicitly authorizing revision-3 BUILD.
- Approved Slice: remaining S2 only — exact legacy cookie OR validated exact-origin boolean-only Kimi
  renderer-storage presence, bounded failure behavior, Kimi load refresh notification, focused fixtures,
  and repeated actual state cycle.
- Constraints: no auth values through the new probe/IPC/logs/evidence; no `kimi-login.mjs`, other-provider,
  renderer/preload, selector, dependency, EOL-policy, Phase 3/4, push, or PR change.
- Next: BUILD revision-3 Slice 2

## 2026-08-03T18:25:55Z — electron-typecheck-defect-fixes / revision 3 review packet

- Stage: WF:BUILD → WF:TEST → WF:REVIEW
- Role/Runtime: Implementation Owner / Codex (`codex-sol-deep` requested; repository PIN: CANDIDATE)
- Risk: Standard status-display boundary
- Implementation: revision-3 base `175617c` → head `d4e0a65`; full feature range
  `4a95621..d4e0a65`. Only `electron/main.ts` and `scripts/verify-electron-phase2.ts` changed.
- Summary: Kimi status retains exact `kimi-auth` legacy compatibility and otherwise accepts only a
  validated exact-origin boolean object requiring `access_token`, `refresh_token`, and `msh_user_id`
  presence. Partial/malformed/unrelated/destroyed/error/timeout states are false; Kimi load completion
  emits the existing Accounts refresh event. No storage value crosses the new probe.
- Validation: tsc exit 0; focused 60/60; isolated Saved Sessions PASS/profile removed; production build
  outputs 6 / transforms 50/9/1/1 / non-main five hashes identical / main 169306 `3F426EBB...`;
  actual current no-cookie Kimi true and user cycle true → false (18:18:53Z) → direct main-panel Login
  true (18:21:16Z), other six true; Chat smoke 1→3, idle/error false/pending false; raw CR 71,
  actionable 0, secret values 0, EOL preserved, official PTY launcher exit 0 and Siftline reopened.
- Separate Observation: Accounts' Kimi Login launcher did not complete authentication; direct embedded
  Kimi login worked. `kimi-login.mjs` was explicitly excluded and unchanged. Do not claim the launcher
  works; carry it as a visible follow-up unless independent review finds it blocks the approved scope.
- Publish Intent/Target: NOT_REQUIRED / none — push/PR/tag/release not attempted
- Next: READY_FOR_REVIEW + Opus 5 CHAT_ONLY_READ_ONLY

## 2026-08-03T18:41:32Z — electron-typecheck-defect-fixes / CLOSE

- Stage: WF:CLOSE
- Role/Runtime: Implementation Owner / Codex (`codex-sol-deep` requested; repository PIN: CANDIDATE)
- Risk: Standard status-display boundary
- Implementation: `4a95621c84e43faa6ada6e4f507631443d759975`..`d4e0a65f992d7d09885e2b3e8e380b0fdd9351c1`
- Review: Opus 5 `CHAT_ONLY_READ_ONLY` — **PASS**, user-delivered 2026-08-03; reproduced focused 60/60, typecheck exit 0, five original-baseline-identical non-main hashes, and expected main-only change.
- Human Decision: N/A — Standard review PASS satisfies the CLOSE entry gate.
- Summary: Reviewer confirmed the exact-origin boolean-only Kimi renderer signal, timeout/sanitizer/all-three-key boundary, default-disabled BrowserView availability, and load-completion Accounts refresh. The prior request to broaden a cookie predicate was explicitly withdrawn because AC-4 proved current Kimi authentication is renderer-storage based; the measured failure and revision-3 reapproval path were correct.
- Validation: `docs/features/electron-typecheck-defect-fixes/TEST_EVIDENCE.md` — PASS and independently reviewed; AC-1–AC-14 complete.
- Publish Intent/Target: NOT_REQUIRED / none — the approved bundle prohibits push, PR, tag, and release; none attempted.
- Decisions / Risks / Follow-ups: Accounts' standalone Kimi Login transfers cookies only and cannot carry current renderer-storage authentication. It is not a Phase 2 regression but is mandatory Phase 3 scope. Kimi page-load availability and cookie-domain matcher consistency remain Phase 3 planning candidates.
- Next: DONE for Phase 2; Main Driver → Phase 3 WF:SPEC_PLAN.

## 2026-08-03T18:51:54Z — council-chat-phase3-defect-fixes / SPEC_PLAN

- Stage: WF:SPEC_PLAN
- Role/Runtime: Main Driver / Codex (`codex-sol-deep` requested; repository PIN: CANDIDATE)
- Risk: Standard — Kimi scope is constrained to embedded-panel UI navigation; no authentication/session value transfer.
- Implementation: N/A — planning artifacts only, based at Phase 2 close `394cee2`.
- Review: N/A — independent review follows an approved BUILD/TEST packet.
- Human Decision: PENDING for bundle `council-chat-phase3-defect-fixes-R1`.
- Summary: SPEC revision 1 and PLAN revision 1 cover canonical roles/dead-code removal, exact runtime-only retry with attachments, recent-first summary selection, embedded Kimi-panel login navigation, and structure-aware Gemini insertion/readback. The shared clipboard mutex remains for fallbacks.
- Validation: current source call-site/EOL/build-evidence audit; planning diff check actionable 0. No product code changed and no baseline test result was reclassified.
- Publish Intent/Target: NOT_REQUIRED / none — no push, PR, tag, or release.
- Decisions / Risks / Follow-ups: automatic clipboard restoration and Kimi renderer-storage transfer are rejected for revision 1; mention-free default routing remains Phase 4. Kimi load-failure status and cookie-domain helper consistency are recorded as deferred candidates only.
- Next: READY_FOR_APPROVAL — Human approves or revises SPEC revision 1 + PLAN revision 1 together; no BUILD before approval.

## 2026-08-03T19:08:36Z — council-chat-phase3-defect-fixes / APPROVAL → BUILD

- Stage: WF:SPEC_PLAN → WF:BUILD
- Role/Runtime: Implementation Owner / Codex (`codex-sol-deep` requested; repository PIN: CANDIDATE)
- Risk: Standard — existing auth/storage/clipboard-content boundaries remain unchanged.
- Human Decision: APPROVED — SPEC revision 1 and PLAN revision 1; user directed BUILD without reapproval for three recorded conditions.
- Conditions: structural signatures are observation-only until all seven actual providers are measured and use ordered non-empty trimmed lines; Accounts `Open Kimi panel` preserves Council `primaryAi`; one canonical role object separates short UI `title` from long prompt `role` plus `focus`/`outputGuide`.
- Validation Boundary: provider structure cannot become blocking without measured evidence. The Phase 1 Kimi moderator assertion remains exact on the long prompt role. S4 requires an actual user Logout → Open panel → Login cycle; without it S4 is BLOCKED and other slices continue.
- Constraints: no auth predicate/storage transfer, clipboard read/restore, retry persistence, dependency/selector/schema/EOL-policy change, Phase 4 routing, push, PR, tag, release, or deploy.
- Next: BUILD S1 — canonical roles and dead-code removal.

## 2026-08-03T19:55:00Z — council-chat-phase3-defect-fixes / review packet

- Stage: WF:BUILD → WF:TEST → WF:REVIEW
- Role/Runtime: Implementation Owner / Codex (`codex-sol-deep` requested; repository PIN: CANDIDATE)
- Risk: Standard — no auth/storage-value, persisted retry path, or clipboard-content boundary expansion.
- Implementation: `394cee2`..`75a3eec`; S1 canonical roles/dead code, S2 newest-first context,
  S3 exact runtime-only retry with attachments, S4 embedded Kimi panel route with primary invariance,
  and S5 content-free structure observation plus Gemini bounded direct insertion are complete.
- Validation: focused Phase 3 80/80, Phase 1 17/17, Phase 2 60/60, `npx tsc --noEmit` exit 0,
  production outputs 6 / transforms 50/9/1/1. CSS/preload/spoof are byte-identical; renderer/main deltas
  are approved and attributed. HTML changes only in the content-hashed renderer filename reference and is
  disclosed because PLAN's literal byte-identical expectation conflicts with approved renderer changes.
- Actual App: user-confirmed Kimi `Logged in → Logout → Open panel → in-panel Login → Logged in`, no child
  popup, Focus/Council primary invariant. Final concurrent image-capable-panel `@all` mapping passed with
  DeepSeek excluded for its provider limitation. All seven structure verdicts matched; exact count/digest
  values are retained for Kimi/Gemini and equality verdicts only for the other five.
- Scope/EOL/Security: raw diff check 338 CR-only findings / actionable 0 under `core.autocrlf=true`;
  target EOLs preserved; forbidden paths and secret/value-transfer findings 0. `_to_delete/` and both
  unrelated untracked handoff-history files remain untouched and unstaged.
- Review: `docs/features/council-chat-phase3-defect-fixes/OPUS5_REVIEW_REQUEST.md`, mode
  `CHAT_ONLY_READ_ONLY`; independent verdict pending.
- Publish Intent/Target: NOT_REQUIRED / none — push/PR/tag/release not attempted.
- Next: READY_FOR_REVIEW + Opus 5; close only after independent PASS.

## 2026-08-03T20:09:08Z — council-chat-phase3-defect-fixes / CLOSE

- Stage: WF:REVIEW → WF:CLOSE
- Role/Runtime: Implementation Owner / Codex (`codex-sol-deep` requested; repository PIN: CANDIDATE)
- Risk: Standard — approved UI/Council reliability scope; no auth/storage-value boundary expansion.
- Implementation: `394cee2f5b42f26dfecc27548746e424ea6612a8..0b1336d1aa26aba433053ca49caf6da7e5a53924`; close metadata commit follows locally.
- Review: Opus 5 `CHAT_ONLY_READ_ONLY` — **PASS**, user-delivered 2026-08-03. Reviewer rebuilt and
  reproduced Phase 3 80/80, Phase 2 60/60, Phase 1 17/17, and `npx tsc --noEmit` exit 0; separately
  verified newest-first budgets and non-persistent guarded Retry behavior.
- Human Decision: N/A — Standard reviewer PASS satisfies the CLOSE entry gate.
- Summary: All three approved conditions passed: Gemini-only structural enforcement with safe observe mode
  for the other six, Kimi panel opening with Council primary unchanged, and canonical short UI title versus
  long prompt role. S1–S6 and AC-1–AC-15 are complete.
- Validation: `docs/features/council-chat-phase3-defect-fixes/TEST_EVIDENCE.md` — PASS and independently
  reviewed. Reviewer confirmed `index.html` changed only from the renderer asset reference
  `index-tey943na.js` → `index-C03ZazMl.js`; SPEC/PLAN now correct the inherited byte-identical expectation.
- Publish Intent/Target: NOT_REQUIRED / none — the approved bundle prohibits push, PR, tag, and release;
  none attempted.
- Decisions / Risks / Follow-ups: Gemini remains the only enforced provider. Expanding enforcement requires
  actual expected/observed line counts and digests for every target provider; verbal confirmation is not
  sufficient. Phase 4 candidates are recorded in HANDOFF, but SPEC work waits for the user's mention-free
  routing choice. `.gitattributes`, repository EOL normalization, and existing npm audit findings remain
  separate optional bundles.
- Next: DONE for Phase 3; Human/Main Driver waits for the routing decision before Phase 4 SPEC.

## 2026-08-03T20:24:20Z — council-chat-phase3-defect-fixes / portable publish handoff

- Stage: post-CLOSE portability and publish
- Role/Runtime: Main Driver / Codex (`codex-sol-deep` requested; repository PIN: CANDIDATE)
- Risk: Low metadata-only follow-up; no product code or behavior change.
- Implementation: Phase 1–3 cumulative branch through close `6e6aa02`; portability metadata commit SELF.
- Review: Phase 1–3 independently PASS; no new implementation review required for metadata-only handoff.
- Human Decision: user accepted the read-only necessity review, decided no Phase 4 bundle is needed, and
  explicitly requested commit and push for continuation on another PC or with another coding agent.
- Summary: mention-free messages remain transcript-only notes and the existing one-click `@all` route is the
  deliberate full-council action. HANDOFF now routes future agents to the cumulative task branch and a dated
  cross-machine snapshot records checkout commands, completed work, evidence, decisions, and local-only files.
- Validation: required typecheck/build and staged scope/EOL/secret checks must pass before the one authorized
  branch push. No code changed in this follow-up.
- Publish Intent/Target: AUTO_AT_CLOSE / `origin/codex/council-chat-phase3-defect-fixes`; expected remote head
  SELF. A normal branch push does not match the repository's `v*` release workflow trigger.
- Decisions / Risks / Follow-ups: no Phase 4 SPEC. Optional truthfulness copy, pending display, duplication,
  Kimi availability, auth-domain hardening, EOL policy, and npm audit work stay deferred and separately scoped.
- Next: DONE after verified push; future Main Driver starts only from a new explicit request.

## 2026-08-04T20:20:05Z — node-npm-ci-hardening / CLOSE

- Stage: WF:BUILD → WF:TEST → WF:CLOSE
- Role/Runtime: Main Driver / Codex (repository PIN remains CANDIDATE)
- Risk: Standard — CI toolchain, lockfile, production dependency security, and Actions runtime maintenance.
- Implementation: `bbcdd3adbcfd6a50f552e86694acb32a687d54a6..0242d42f0acecde2abf24ae5323282f2093b8051`;
  close metadata commit SELF.
- Review: N/A — user directly inspected the disclosed results and authorized commit plus protected-main push.
- Human Decision: APPROVED_WITH_RISK on 2026-08-04. The user accepted proceeding after disclosure that
  lint/test scripts are unavailable and the full dev-inclusive audit still has 21 findings.
- Summary: pinned Node `22.22.3` and npm `10.9.8`; regenerated lockfile with exact npm; removed all four
  production audit findings; upgraded JavaScript Actions to current Node 24 runtimes pinned by full SHA.
- Validation: `docs/features/node-npm-ci-hardening/TEST_EVIDENCE.md` — PASS. Exact-toolchain clean installs,
  typecheck, build, dependency-tree health, and production audit passed on Windows and WSL/Linux.
- Publish Intent/Target: AUTO_AT_CLOSE / `origin/main`; exact normal fast-forward push explicitly approved.
- Decisions / Risks / Follow-ups: lint/test SKIPPED_WITH_REASON because scripts do not exist. Twenty-one
  dev-inclusive audit findings and existing deprecation warnings remain for a separately approved major-upgrade bundle.
- Next: DONE after verifying `origin/main` equals the close metadata commit; no PR, tag, release, or deploy.

## 2026-08-13T19:20:00Z — council-broadcast-send-hardening / review packet

- Stage: WF:SPEC_PLAN → WF:BUILD → WF:TEST → READY_FOR_REVIEW
- Role/Runtime: Main Driver / this session (repository PIN: CANDIDATE — no APPROVED runtime)
- Risk: Standard — Council Chat injection/send internals; no auth/schema/dependency/external boundary.
- Human Decision: APPROVED — bundle `council-broadcast-send-hardening-R1`, SPEC rev 1 + PLAN rev 1 (2026-08-13).
- Implementation: `391b294`..`84c59dd` — native-input lock (outer) around clipboard lock (inner);
  unconditional send-ready wait in council turns; Perplexity trusted CDP submit with verification;
  Gemini per-line verified insertion plus focus-instrumented bounded clipboard retry.
- Validation: `docs/features/council-broadcast-send-hardening/TEST_EVIDENCE.md` — typecheck PASS,
  build PASS, diff/whitespace PASS with the known autocrlf CR-at-EOL note, secret/PII scan PASS.
  Actual-app AC-1..AC-5 NOT_RUN — owner interactive run with 7 logged-in sessions pending.
- Publish Intent/Target: AUTO_AT_CLOSE / `origin/kimi/council-broadcast-send-hardening` at WF:CLOSE only; no push attempted.
- Decisions / Risks / Follow-ups: lock ordering fixed (native-input outer, clipboard inner); Perplexity CDP probe
  is selector-independent; Gemini per-line path bounded at 200 lines/15s with clipboard fallback; checks ran under
  system Node v24.12.0 — pinned 22.22.3 not present on this machine; user-owned `package.json`/`package-lock.json`
  modifications and untracked icon/handoff files preserved untouched and unstaged.
- Next: owner actual-app run (steps in TEST_EVIDENCE), then independent REVIEW of `391b294..84c59dd`.

## 2026-08-13T19:40:00Z — log-drawer-copy-fix / MICRO

- Stage: WF:MICRO → inline CLOSE
- Risk: Low — Log drawer UI only; no data/contract/dependency change.
- Change: `src/index.css` `.log-list { user-select: text }` (root `#root` sets `user-select: none` globally, which blocked select & copy); `src/components/LogDrawer.tsx` adds a Copy button (navigator.clipboard with execCommand fallback).
- Validation: `npx tsc --noEmit` exit 0; `npm run build` exit 0.
- Note: committed on the in-flight `kimi/council-broadcast-send-hardening` branch; outside that bundle's fixed review range `391b294..84c59dd`.
- Publish: deferred — rides the same branch; push only at the broadcast task WF:CLOSE.

## 2026-08-13T20:05:00Z — council-broadcast-send-hardening / CLOSE

- Stage: WF:CLOSE
- Role/Runtime: Implementation Owner / this session (repository PIN: CANDIDATE)
- Risk: Standard — Council Chat injection/send internals.
- Implementation: `391b294..060cceb` (+ log-drawer MICRO `611d879`).
- Review: N/A — independent review skipped by explicit owner instruction; no P0 findings open.
- Human Decision: APPROVED — "commit & push 해줘" (2026-08-13), resolving the CLOSE entry gate.
- Summary: @all broadcast hardened — native-input lock serialization, unconditional send-ready wait,
  Perplexity trusted CDP inject+submit, Gemini per-line verified insertion with clipboard repair;
  Log drawer select/copy fixed. Owner-verified @all run: all 7 providers PASS.
- Validation: `docs/features/council-broadcast-send-hardening/TEST_EVIDENCE.md` — AC-1..4,6,7 PASS;
  AC-5 WAIVED_BY_APPROVAL; typecheck/build PASS (Node v24.12.0, pinned 22.22.3 absent).
- Publish Intent/Target: AUTO_AT_CLOSE / `origin/kimi/council-broadcast-send-hardening`.
- Decisions / Risks / Follow-ups: single @mention and Workflow modes remain must-preserve but unused;
  re-verify them if revived. Installer built locally at owner request; no tag/release/publish.
- Next: DONE after verifying remote head equals the close metadata commit.

## 2026-08-13T20:18:00Z — titlebar-version-display / MICRO

- Stage: WF:MICRO → inline CLOSE
- Risk: Low — titlebar label only; no data/contract/dependency change.
- Change: `src/components/TitleBar.tsx` renders `v{version}` (from package.json via Vite JSON
  named import, `resolveJsonModule` already enabled) next to the Siftline wordmark;
  `src/index.css` adds `.titlebar-version` pill styling.
- Validation: `npx tsc --noEmit` exit 0; `npm run build` exit 0.
- Publish: AUTO_AT_CLOSE to `origin/kimi/council-broadcast-send-hardening` (current task branch).

## 2026-08-13T20:25:00Z — installer-versioned-filename / MICRO

- Stage: WF:MICRO → inline CLOSE
- Risk: Low — packaging filename template only.
- Change: `package.json` nsis `artifactName` → `AI-Council-Setup-${version}.${ext}`
  (only this hunk committed; the owner's uncommitted siftline.ico rebrand hunks remain unstaged
  in the worktree). Rebuilt installer: `release/AI-Council-Setup-1.0.9.exe`.
- Validation: `npm run package:installer` exit 0; artifact verified in `release/`.
- Publish: AUTO_AT_CLOSE to `origin/kimi/council-broadcast-send-hardening`.

## 2026-08-14T13:20:00Z — ui-titlebar-branding-polish / MICRO

- Stage: WF:MICRO -> inline CLOSE
- Risk: Low — presentation/branding only; no behavior, schema, or data change.
- Change: titlebar logo text "AI" -> siftline icon image (`src/assets/siftline-icon.png`,
  `.titlebar-icon-img`); version pill tooltip now shows build date via Vite `__BUILD_DATE__`
  define (`vite.config.ts`, `src/vite-env.d.ts`); shared `.titlebar-pill` chrome for
  version/tagline pills (padding/height unified); LogDrawer Copy button shows
  "? Copied" feedback for 1.5s (`src/components/LogDrawer.tsx`); branding cleanup —
  artifact names -> `Siftline-*` (`package.json`, `build-installer.bat`,
  `make-portable.ps1`, `build-installer.sh`), mac icon -> `siftline.icns`
  (generated from siftline-icon.png), CI icon pipeline -> siftline names
  (`.github/workflows/build.yml`, `scripts/ico_to_png.py`, `.gitignore`).
  package.json `name`/`appId` intentionally unchanged (userData path + Windows app
  identity stability).
- Validation: `npx tsc --noEmit` exit 0; `npm run build` exit 0 (Node v24.12.0 —
  pinned 22.22.3 not installed; same recorded deviation as previous session).
  `git diff --check` reports CR-at-EOL on edited lines (autocrlf=true, pre-existing
  repo condition, recorded previously).
- Publish: AUTO_AT_CLOSE to `origin/kimi/ui-titlebar-branding-polish`.

## 2026-08-14T14:25:00Z — focus-split-draggable / MICRO+

- Stage: owner-directed UI improvement (proposal A only; tile-collapse rejected —
  owner noted inactive AIs already collapse tiles automatically).
- Risk: Low-Standard — layout bounds calculation now reads a persisted ratio;
  no schema/auth/external side effect. Broadcast/injection paths untouched.
- Change: Focus pane width is drag-adjustable (20%-65%) via a divider between the
  Focus pane and Compare grid; ratio persisted in electron-store `focusSplitRatio`
  (default 0.32 = previous fixed value). `computeHybridViewBounds` reads the store.
  IPC: `get-focus-split-ratio` / `set-focus-split-ratio` (main.ts, preload.ts,
  types.ts). During drag the BrowserViews are hidden via existing
  `set-views-visible` and restored on release (views render above the renderer and
  would swallow pointer events; `webContents.setIgnoreMouseEvents` is not available
  for BrowserView webContents in this Electron version).
- Validation: `npx tsc --noEmit` exit 0; `npm run build` exit 0 (Node v24.12.0 —
  pinned 22.22.3 not installed; same recorded deviation). Manual drag feel NOT_RUN
  (requires owner run via build-and-run.bat).
- Publish: AUTO_AT_CLOSE to `origin/kimi/ui-titlebar-branding-polish`.

## 2026-08-17T16:30:00Z — replace-kimi-with-zai / STANDARD

- Stage: owner-directed provider replacement (Kimi removed Google-login option
  site-side 2026-07~08, breaking the embedded login flow; owner chose Z.ai).
- Risk: Standard — provider selectors, login detection, and send path changed
  for one panel slot. Other 6 providers untouched. Version stays 1.0.9.
- Change: 7th provider slot `kimi` -> `zai` (Z.ai / GLM, https://chat.z.ai/ —
  an Open WebUI instance). `AiName` union, AI_NAMES, display names, colors
  (#3d5afe), icon (Z), role preset (Agentic Long-Context Analyst),
  mention aliases (@zai/@z.ai/@glm), council routing profile + prompts,
  apiKeyOrder/defaultOrder. main.ts: DEFAULT_SELECTORS rewritten for Open
  WebUI (`textarea#chat-input`, `[class*="sendMessageButton"]`,
  `.markdown-prose`/`[class*="response-content"]`); streaming overrides
  renamed (6s stable / 20s guard kept); kimi-only CDP clickSend path removed
  (~190 lines — z.ai uses a plain textarea + stable send button, generic
  selector path suffices); kimi 4000-byte paste guard removed; login
  detection replaced with Open WebUI signals (localStorage `token` key +
  `textarea#chat-input` composer presence, z.ai-domain auth cookies);
  `persist:zai` partition; Google-OAuth will-navigate interception extended
  to zai; OAUTH_ALLOWED_DOMAINS += z.ai; Z.ai API key entry added
  (https://api.z.ai/api/paas/v4, model glm-4.5-flash) for query-routing and
  session-relation calls. AccountsPanel: embedded-panel login flow reused
  ("Open panel"). Deleted `kimi-login.mjs` / `kimi-login.bat` (vestigial).
- Not changed (follow-up candidates): scripts/verify-electron-phase2.ts,
  verify-council-phase1/3.ts, probe-electron-login-status.mjs,
  verify-electron-phase2-snapshots.mjs still reference kimi (dev-only
  tooling, not part of tsc/build); README.md/README.html provider lists.
- Validation: `npx tsc --noEmit` exit 0; `npm run build` exit 0
  (Node v24.12.0 — pinned 22.22.3 not installed; same recorded deviation).
  Manual login/broadcast test NOT_RUN (requires owner run via
  build-and-run.bat; selectors may need fine-tuning via userData selectors.json).
- Publish: AUTO_AT_CLOSE to `origin/kimi/replace-kimi-with-zai`.

## 2026-08-17T17:10:00Z — v1.1.0 bump + z.ai follow-up / MICRO

- Change: version 1.0.9 -> 1.1.0 (`package.json`; TitleBar reads it via import).
  Owner judged the Kimi->Z.ai provider replacement a feature-level change.
  Follow-up fix included in this release line: Z.ai moved to the end of
  provider lists (after Perplexity) to keep chip rows alphabetical
  (`src/types.ts`, `src/components/AccountsPanel.tsx`).
- Owner test evidence: z.ai embedded-panel Google login succeeded (GLM-5.2
  chat UI confirmed). Google anti-bot warning page and a raw
  `{"detail":"invalid state"}` OAuth-callback render appeared in the popup
  during the flow — cosmetic; session cookie lands in persist:zai regardless.
  Popup auto-close on callback is a future polish candidate.
- Validation: `npx tsc --noEmit` exit 0; `npm run build` exit 0.
- Publish: AUTO_AT_CLOSE to `origin/kimi/replace-kimi-with-zai`.
  Installer rebuilt via `npm run package:installer` (release/Siftline-Setup-1.1.0.exe).


## 2026-08-19T14:40:00Z — gemini-prompt-focus-guard / Standard

- Change: Gemini 프롬프트 주입의 첫 시도 간헐 실패 수정. composer에 caret이
  없는 상태에서 document-wide `execCommand('selectAll')`/Ctrl+A가 body 전체를
  선택해 paste가 composer를 빗나갔고 readback 검증 실패
  (`Prompt injection verification failed for gemini`); retry는 첫 시도의
  click/focus 워밍업 덕에 성공했음. `scopeComposerSelection()` 헬퍼가
  Selection API로 selection을 composer contents로 한정(포커스 무관)하고,
  Gemini one-shot/per-line 클리어와 clipboard fallback(Ctrl+A 대체)에 적용.
  다른 6개 provider 경로는 미변경. `electron/main.ts` (+83/-5).
- SPEC/PLAN: `docs/features/gemini-prompt-focus-guard/` bundle R1 —
  2026-08-19 "어 승인할게. 수정 시작하자"로 승인.
- Validation: `npx tsc --noEmit` exit 0; `npm run build` exit 0;
  owner 실앱 검증 PASS (콜드 첫 전송 1회 성공, @all broadcast 회귀 없음,
  전체 페이지 선택 현상 소거) — `TEST_EVIDENCE.md` 참조.
- Review: independent review skipped — owner가 실앱 검증 PASS를 근거로
  "commit & push 해줘" 지시 (2026-08-19), council-broadcast-send-hardening
  close와 동일한 owner 선택.
- Publish: AUTO_AT_CLOSE to `origin/kimi/gemini-prompt-focus-guard`.
  Installer rebuilt: `release/Siftline-Setup-1.1.0.exe` (owner 요청 로컬
  빌드, publish/tag 없음).
