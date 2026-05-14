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
| 2026-05-14 | `docs/` 워크플로 문서 4종 신설 (BLUEPRINT, SCOPE, AGENT_WORKFLOW, DEV_LOG) | 코드 변경 0줄. 추가만 수행 |

> v1.0.8 이전 개발 이력은 git log 참조 (`git log --oneline`).

## Open Issues

| ID | Issue | Priority | Status |
|---|---|---|---|
| — | (없음) | — | — |

## Build / Test Log

| Date | Command | Result | Notes |
|---|---|---|---|
| 2026-05-14 | (해당 없음) | — | 문서만 추가, 코드 빌드 불필요 |

## Risks / Follow-Ups

| Date | Risk or Follow-Up | Owner | Status |
|---|---|---|---|
| 2026-05-14 | AI 사이트 DOM 변경 시 `electron/selectors.json` 갱신 필요 | Minkyu | 상시 모니터링 |

## Next Steps

1. 앞으로 모든 기능 추가는 `/spec → /plan → /build → /test → /review → /log` 적용
2. 의미 있는 변경마다 이 파일 업데이트
3. 작업이 `PROJECT_SCOPE.md`의 "Must Preserve"에 영향을 주는지 매번 확인
