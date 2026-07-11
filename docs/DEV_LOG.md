# Development Log — AI Council

## Project

AI Council — 7개 LLM 교차검증 + 자유토론 Electron 데스크톱 앱

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
