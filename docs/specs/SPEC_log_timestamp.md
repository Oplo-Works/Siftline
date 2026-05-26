# Spec: Log timestamp 추가

> Field Test #1 — Project Engineering OS v5 Lean
> Date: 2026-05-26

---

## 1. 문제 / 동기

현재 `📊 Logs` 패널의 각 로그 항목에는 메시지(`msg`)와 레벨(`info/warn/error`)만 있고,
**언제 발생했는지 알 수 없다.** Workflow 실행 중 타이밍 문제를 디버깅할 때 순서는
알지만 시각(時刻)을 알 수 없어 불편하다.

## 2. 목표 (Goal)

- 각 로그 항목에 `HH:MM:SS` 형식의 타임스탬프를 표시한다.
- 기존 로그 항목 렌더링 스타일을 유지하되, 타임스탬프를 앞쪽(또는 오른쪽 정렬)에 추가한다.

## 3. 범위 (Scope)

### In scope
- `LogEntry` 인터페이스에 `timestamp: number` 필드 추가 (optional → 기존 항목 backward compat)
- `electron/main.ts`의 로그 생성 코드에 `Date.now()` 주입
- `LogDrawer.tsx`에서 `HH:MM:SS` 포맷으로 렌더링

### Out of scope
- 날짜(YYYY-MM-DD) 표시 (같은 세션 내 사용이므로 불필요)
- 로그 필터링, 검색
- 로그 export

## 4. 변경 파일 (예상)

| 파일 | 변경 내용 |
|---|---|
| `src/types.ts` | `LogEntry`에 `timestamp?: number` 추가 |
| `electron/main.ts` | 로그 emit 시 `timestamp: Date.now()` 주입 |
| `src/components/LogDrawer.tsx` | 타임스탬프 렌더링 추가 |

총 3개 파일, Must Preserve 항목 미접촉.

## 5. 검증 기준 (Acceptance Criteria)

- [ ] `npm run build` 통과
- [ ] 앱 실행 후 Workflow 한 단계 진행 시 Logs 패널에 `[HH:MM:SS]` 타임스탬프가 각 항목 앞에 표시됨
- [ ] 기존 로그 항목(timestamp 없는 것)은 빈 자리 또는 `--:--:--`으로 graceful fallback
- [ ] 레벨 아이콘(ℹ / ⚠ / ✖)과 메시지는 기존과 동일하게 표시

## 6. 위험도

낮음 — UI 전용 변경, 데이터 저장 없음, IPC 인터페이스 추가 없음.
`LogEntry` 필드를 optional로 추가하므로 기존 코드 영향 없음.
