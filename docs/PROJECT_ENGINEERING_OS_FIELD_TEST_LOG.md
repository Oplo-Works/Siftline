# Project Engineering OS — Field Test Log (Siftline)

> v5 Lean을 Siftline에 실제 적용하면서 발견한 마찰·도움·무시된 규칙을
> 기록한다. 이 일지 없이는 v6, v5.1, 추가 메타 문서를 만들지 않는다.

---

## Rule of Engagement

1. v5 Lean을 기준으로 삼되, 새 버전을 만들지 않는다.
2. 한 번에 실제 기능 1개만 선택한다.
3. 기능은 작고 위험도가 낮아야 한다 (DB/auth/payment/integration 변경 없음).
4. 작업 시작 전 `PROJECT_STATE.md`와 `VERIFICATION.md`만 최소 보강한다.
5. 기능 완료 후 이 일지를 작성한다.
6. 이 일지 업데이트 없이 시스템(워크플로/문서/규칙)을 수정하지 않는다.

## 기능 선택 기준 (체크 후 시작)

- [ ] 실제 비즈니스 진행에 도움이 되는가?
- [ ] 1~3개 slice로 끝낼 수 있는가? (slice당 파일 3~5개 이하)
- [ ] DB / auth / payment / integration이 없는가?
- [ ] 기존 demo flow / `PROJECT_SCOPE.md` Must Preserve를 깨뜨릴 위험이 낮은가?
- [ ] `VERIFICATION.md`의 검증 명령으로 검증 가능한가?
- [ ] 미완성이면 placeholder/mock/demo로 명확히 표시할 수 있는가?

---

## Field Test #1

Project: Siftline
Feature: Log timestamp 추가 — Logs 패널 각 항목에 HH:MM:SS 표시
Date range: 2026-05-26
Agents used: Claude (Cowork mode)
Starting state: a4e3133 (docs: add AI coding agent workflow docs and rules)
Ending state: 변경 파일 3개 — `src/types.ts`, `electron/main.ts`, `src/components/LogDrawer.tsx` + spec/plan 문서 2개 신설. npm run build는 Windows에서 수동 확인 필요.

### What Helped

| Rule / Document | How it helped | Keep / Modify / Remove |
|---|---|---|
| PROJECT_STATE.md | "In flight" 항목과 시작 상태를 한눈에 파악 가능. uncommitted 변경이 CRLF뿐임을 빠르게 확인. | Keep |
| AGENT_WORKFLOW.md | spec → plan → build → test → review → log 순서 덕분에 무엇을 만들지 명확히 정의한 후 코딩 시작. 범위 creep 없음. | Keep |
| PROJECT_SCOPE.md (Must Preserve) | 변경할 3개 파일이 Must Preserve와 교차하지 않음을 사전 확인. 안심하고 진행. | Keep |
| CLAUDE.md | main 브랜치 유지, `npm run build` 통과 원칙 명시 → tsc로 대체 가능한 범위 인식. | Keep |

### What Slowed Us Down

| Rule / Document | Friction observed | Suggested change |
|---|---|---|
| Build 검증 규칙 | sandbox에서 `npm run build` 불가 (rollup native 모듈). tsc로 대체했지만 "빌드 통과" 기준이 모호해짐. | VERIFICATION.md에 "sandbox 환경에서는 tsc --noEmit으로 대체 가능" 명시 |
| Edit 도구 동작 | Edit 도구가 대형 파일 교체 시 truncate 발생 (LogDrawer 44행, main.ts 7252행, types.ts 344행). python으로 수동 복구 필요. | 큰 파일 편집 시 Write 또는 python 직접 쓰기로 대체. CLAUDE.md에 주의 추가 검토. |

### What Was Ignored

| Rule | Why it was ignored | Should it remain? |
|---|---|---|
| VERIFICATION.md 검증 명령 | VERIFICATION.md가 아직 빈 템플릿 상태라 실제 체크리스트 없음. | YES — 다음 Field Test 전 최소한 "tsc + build" 항목 채울 것 |

### Problems Caught by the System

| Problem caught | Which rule caught it | Impact |
|---|---|---|
| CRLF uncommitted 변경이 실제 코드 변경처럼 보임 | PROJECT_STATE.md의 "In flight" 메모 + git diff 분석 | 혼란 없이 빠르게 "CRLF만 다름" 판정, 불필요한 stash/clean 방지 |
| Edit 도구 truncate 버그 | tsc --noEmit 실행 → 즉시 에러 발견 | python으로 3개 파일 복구. 테스트 단계가 없었다면 깨진 코드 커밋 뻔함 |

### Agent Behavior Notes

| Agent | What it followed well | What it missed |
|---|---|---|
| Claude (Cowork) | spec → plan → build → test 순서 엄수. 파일 범위 3개 이하 유지. Must Preserve 미접촉. | Edit 도구 한계 인지 부족 — 대형 파일 교체에 Write/python 우선 사용했어야 함 |

### Decision

Was v5 Lean useful for this slice?
- [x] YES
- [ ] PARTLY
- [ ] NO

What should change before the next field test?

1. **VERIFICATION.md 채우기** — `npx tsc --noEmit` + `npm run build`(Windows) 체크리스트 최소 기재
2. **CLAUDE.md 또는 AGENT_WORKFLOW.md에 Edit 도구 주의사항 추가** — 100줄 이상 교체 시 python/Write 사용 권장
3. **다음 Field Test 후보 미리 1개 선정** — 이번처럼 기능 선택 단계가 별도 세션이 되지 않도록

> Do not create v6 (or v5.1, or new meta docs) unless at least 3 repeated
> real issues across multiple field tests justify it.

---

## Field Test #2

Project: Siftline
Feature: History AI 필터 — History 패널 상단에 AI별 필터 버튼 추가
Date range: 2026-05-26
Agents used: Claude (Cowork mode)
Starting state: 4396c03 (docs: update PROJECT_STATE.md)
Ending state: HistoryDrawer.tsx 1개 파일 변경. tsc 통과, Windows 앱 확인 완료.

### What Helped

| Rule / Document | How it helped | Keep / Modify / Remove |
|---|---|---|
| SPEC 문서 | "usedAis.length > 1일 때만 필터 바 표시" 조건을 미리 명시 → 구현 중 판단 불필요 | Keep |
| PLAN 문서 | Field Test #1 교훈("python으로 직접 작성") 기록 덕분에 truncate 재발 없음 | Keep |
| PROJECT_SCOPE.md (Must Preserve) | 파일 1개, props 인터페이스 미변경 → 리스크 제로 확인 | Keep |

### What Slowed Us Down

| Rule / Document | Friction observed | Suggested change |
|---|---|---|
| — | 특이 사항 없음. 1파일, python 작성, tsc 통과까지 매끄러웠음 | — |

### What Was Ignored

| Rule | Why it was ignored | Should it remain? |
|---|---|---|
| — | — | — |

### Problems Caught by the System

| Problem caught | Which rule caught it | Impact |
|---|---|---|
| (없음) | — | — |

### Agent Behavior Notes

| Agent | What it followed well | What it missed |
|---|---|---|
| Claude (Cowork) | Field Test #1 교훈 즉시 적용 (python 작성). spec 범위 엄수. | — |

### Decision

Was v5 Lean useful for this slice?
- [x] YES
- [ ] PARTLY
- [ ] NO

What should change before the next field test?

1. 이 규모(파일 1개, 단순 UI)에서는 spec/plan이 오버헤드일 수 있음 — 다음 Field Test에서 체감 확인
2. Field Test #3 후보 미리 선정

> Do not create v6 (or v5.1, or new meta docs) unless at least 3 repeated
> real issues across multiple field tests justify it.

---

## Field Test #3

(다음 기능 적용 시 위 구조를 복사해서 채울 것)
