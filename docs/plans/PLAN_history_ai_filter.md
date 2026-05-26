# Plan: History AI 필터

> Field Test #2 — 2026-05-26

---

## Slice 1 (파일 1개)

### `src/components/HistoryDrawer.tsx` 전체 교체

변경 내용:

1. `useState` import 추가
2. `AiName` import 추가 (기존 import에 병합)
3. 컴포넌트 내부에 `activeFilter` state 추가 (`'all' | AiName`)
4. 히스토리에서 실제 존재하는 AI 목록 추출 (`usedAis`)
5. 필터 버튼 UI — `All` + `usedAis` 순서로 렌더링
6. 필터 적용 — `activeFilter === 'all'` 이면 전체, 아니면 해당 AI만
7. 필터 결과 없을 때 "No results." 표시

### 핵심 로직

```ts
// 히스토리에 실제 있는 AI만 (순서 유지)
const AI_ORDER: AiName[] = ['chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'perplexity', 'kimi']
const usedAis = AI_ORDER.filter(ai => history.some(h => h.primaryAi === ai))

// 필터 적용
const filtered = activeFilter === 'all'
  ? history
  : history.filter(h => h.primaryAi === activeFilter)
```

### 버튼 스타일 (인라인)

- 비활성: 반투명 배경, 해당 AI 색상 테두리
- 활성: 해당 AI 색상 배경, 흰 텍스트
- `All` 활성: 중립 색상(흰색/회색)

## 파일 작성 방법

Field Test #1 교훈 — **HistoryDrawer.tsx는 73줄로 소형이지만 python으로 직접 작성**
(Edit 도구 truncate 재발 방지).

## 검증

1. `npx tsc --noEmit`
2. Windows: `build-and-run.bat` → History 패널 필터 동작 확인
