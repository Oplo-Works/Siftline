# Legacy Work Index — pre-v8.1.1 완료 작업 정리

- Created: 2026-07-11 (workflow-adoption-v8.1.1)
- 목적: v8.1.1 도입 이전에 완료·진행된 의미 있는 작업의 실용적 색인.
  소급 SPEC/PLAN/승인/증거를 만들지 않는다. 이 인덱스의 미래 수정 작업은
  새 v8.1.1 task로 시작한다.
- 증거 원천: git log/tags, `docs/DEV_LOG.md`, `docs/PROJECT_ENGINEERING_OS_FIELD_TEST_LOG.md`,
  `docs/specs/`, `docs/plans/`, GitHub release tag (ls-remote 확인)

## Classifications

`VERIFIED_BY_EXISTING_EVIDENCE` | `VERIFIED_DURING_ADOPTION` | `COMPLETED_BUT_UNVERIFIED` |
`PARTIAL_OR_IN_PROGRESS` | `SUPERSEDED` | `UNKNOWN` | `NOT_APPLICABLE`

## Index

| Legacy item | Existing status | Relevant commits | Existing artifacts | Verification class | Evidence basis | Adoption action | Follow-up |
|---|---|---|---|---|---|---|---|
| AI Council 코어 앱 v1.0.0–v1.0.8 (7 AI 패널, Workflow 3단계, Council Chat, Saved Sessions, Moderator, Pinning/Merge, 파일첨부+CDP, 추천엔진, 언어감지, Telegram 연동, Win/mac 패키징) | completed (출시) | tags `v1.0.0`..`v1.0.8` (다수 커밋) | `README.md`, `docs/PRODUCT_BLUEPRINT.md`, 구 `PROJECT_SCOPE.md` Must Preserve | VERIFIED_BY_EXISTING_EVIDENCE | 릴리스 태그 존재 + 사용자 작성 문서의 "정상 동작 중" 명시 + 배포 파이프라인 | preserved / Must-preserve flows로 신 SCOPE에 승계 | 없음 |
| v5 Lean 워크플로 문서 도입 (2026-05-14) | completed | `a4e3133` | 구 `AGENT_WORKFLOW.md`, `PROJECT_SCOPE.md`, `PRODUCT_BLUEPRINT.md`, `DEV_LOG.md` | VERIFIED_BY_EXISTING_EVIDENCE | 커밋·문서 실존, 코드 변경 0줄 기록 | v8.1.1로 SUPERSEDED; 원본은 archive에 보존 | 없음 |
| Field Test #1 — Log timestamp (HH:MM:SS) | completed | `b41dbfe` | `docs/specs/SPEC_log_timestamp.md`, `docs/plans/PLAN_log_timestamp.md`, DEV_LOG·Field Test 로그 | VERIFIED_BY_EXISTING_EVIDENCE | DEV_LOG: tsc PASS + Windows 앱 확인 완료 기록 | preserved / indexed | 없음 |
| Field Test #2 — History AI 필터 | completed | `6c82455` | `docs/specs/SPEC_history_ai_filter.md`, `docs/plans/PLAN_history_ai_filter.md` | VERIFIED_BY_EXISTING_EVIDENCE | DEV_LOG: tsc PASS + Windows 앱 확인 완료 기록 | preserved / indexed | 없음 |
| Field Test #3 — FinalResult 복사 알림 (inline toast) | completed | `df38705` | DEV_LOG·Field Test 로그 | VERIFIED_BY_EXISTING_EVIDENCE | DEV_LOG: tsc PASS + Windows 앱 확인 완료 기록 | preserved / indexed | 없음 |
| 문서 레포 경로 정정 (Minkyu → Sales01) | completed | `4164b3b` | 문서 다수 | SUPERSEDED | 커밋 존재; 현재 실제 경로는 `C:\Users\parkm\...`로 재변경됨 | 신 bootstrap에 현재 경로 반영 | 사용자: 경로 이동 시 bootstrap 갱신 |
| Grok 로그인 세션 경로 수정 (AI_COUNCIL_USERDATA) | completed | `179e0ca` | `grok-login.mjs`, `grok-login.bat` | COMPLETED_BUT_UNVERIFIED | 커밋만 존재; 테스트 증거 기록 없음 | preserved / indexed | 필요 시 새 task로 검증 |
| Reviewer 프롬프트 AI identity 주입 (impersonation 방지) | completed | `aff1975` | `electron/` 워크플로 엔진 | COMPLETED_BUT_UNVERIFIED | 커밋만 존재; 테스트 증거 기록 없음 | preserved / indexed | 필요 시 새 task로 검증 |
| Hybrid Focus Council Layout (v1.0.9 핵심 기능) | completed | `68a2700` (릴리스 커밋) | `docs/specs/SPEC_hybrid_focus_council_layout.md`, `docs/plans/PLAN_hybrid_focus_council_layout.md`, DEV_LOG 2026-06-03 | VERIFIED_BY_EXISTING_EVIDENCE | DEV_LOG: `npm run build` PASS 기록 | preserved / indexed | 없음 |
| v1.0.9 릴리스 발행 (installer 패키징) | completed(태그) / 산출물 미확인 | tag `v1.0.9` → `68a2700` | `docs/specs/SPEC_release_installers_v109.md`, `docs/plans/PLAN_release_installers_v109.md`, `.github/workflows/build.yml` | COMPLETED_BUT_UNVERIFIED | `git ls-remote`로 원격 태그 v1.0.9 확인(2026-07-11); CI 빌드 성공·installer 산출물은 로컬에서 미확인 | preserved / indexed | 사용자: GitHub Release 산출물 확인 |
| package-lock.json 미커밋 수정 (도입 시점 dirty) | in progress (사용자 소유) | uncommitted | `package-lock.json` | PARTIAL_OR_IN_PROGRESS | `git status` 관찰 (2026-07-11); 의도 미상 | preserved untouched | 사용자: 커밋 또는 폐기 결정 |

## Notes

- 현재 전체 빌드가 통과하더라도 그것이 위 개별 항목 각각의 소급 검증이 되지는 않는다.
- `COMPLETED_BUT_UNVERIFIED`는 정직한 결과이며 결함 주장이 아니다.
- 레거시 spec/plan 문서(`docs/specs/`, `docs/plans/`)는 역사적 아티팩트로 보존한다.
  새 기능 문서는 `docs/features/<feature-id>/`를 사용한다.
