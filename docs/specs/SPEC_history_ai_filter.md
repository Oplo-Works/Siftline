# Spec: History AI 필터

> Field Test #2 — Project Engineering OS v5 Lean
> Date: 2026-05-26

---

## 1. 문제 / 동기

현재 📋 History 패널은 모든 항목을 시간 역순으로 나열할 뿐이다.
세션이 쌓이면 "ChatGPT로 했던 것만 보고 싶다" 같은 요구를 스크롤로만 해결해야 한다.

## 2. 목표 (Goal)

History 패널 상단에 AI별 필터 버튼을 추가해, 선택한 AI의 항목만 표시한다.
`All` 버튼으로 전체 복귀 가능.

## 3. 범위 (Scope)

### In scope
- `HistoryDrawer.tsx` 내부에 `useState`로 필터 상태 관리
- 필터 버튼: `All` + 히스토리에 실제 존재하는 AI만 표시 (없는 AI 버튼 숨김)
- 선택된 버튼 강조 (해당 AI의 color 사용)
- 필터 적용 시 해당 `primaryAi` 항목만 렌더링

### Out of scope
- 복수 AI 동시 선택
- 텍스트 검색
- 날짜 범위 필터
- 필터 상태 영속화 (패널 닫으면 All로 초기화)

## 4. 변경 파일 (예상)

| 파일 | 변경 내용 |
|---|---|
| `src/components/HistoryDrawer.tsx` | useState 추가, 필터 버튼 UI, 필터 적용 렌더링 |

총 **1개 파일**. Must Preserve 미접촉.

## 5. 검증 기준 (Acceptance Criteria)

- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과 (Windows)
- [ ] 히스토리 항목이 없을 때: "No history yet." 그대로
- [ ] 히스토리가 있을 때: 실제 존재하는 AI 버튼만 상단에 표시
- [ ] AI 버튼 클릭 → 해당 AI 항목만 표시, 버튼 강조
- [ ] `All` 클릭 → 전체 항목 복귀
- [ ] 필터 후 결과 없으면 "No results." 표시
- [ ] 기존 항목 클릭(onSelect)·Clear All 동작 정상

## 6. 위험도

낮음 — 단일 파일, 외부 상태 변경 없음, IPC 없음.
`useState`만 추가하므로 기존 props 인터페이스 미변경.
