# Plan: Log timestamp 추가

> Field Test #1 — 2026-05-26

---

## Slice 1 (파일 3개, 단일 PR)

### Step 1 — `src/types.ts`

`LogEntry` 인터페이스에 `timestamp?: number` 추가 (optional — backward compat).

```ts
// Before
export interface LogEntry {
  level: 'info' | 'warn' | 'error'
  msg: string
}

// After
export interface LogEntry {
  level: 'info' | 'warn' | 'error'
  msg: string
  timestamp?: number
}
```

### Step 2 — `electron/main.ts` (line 1097-1099)

`sendLog` 함수에서 IPC 전송 시 `timestamp: Date.now()` 추가.

```ts
// Before
function sendLog(level: 'info' | 'warn' | 'error', msg: string) {
  mainWindow?.webContents.send('log', { level, msg })
}

// After
function sendLog(level: 'info' | 'warn' | 'error', msg: string) {
  mainWindow?.webContents.send('log', { level, msg, timestamp: Date.now() })
}
```

### Step 3 — `src/components/LogDrawer.tsx`

각 `log-entry`에 타임스탬프를 `[HH:MM:SS]` 형식으로 앞에 표시.
`timestamp`가 없으면 `--:--:--` fallback.

```tsx
// 헬퍼 함수 추가
function formatTime(ts?: number): string {
  if (!ts) return '--:--:--'
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':')
}

// log-entry 렌더링 변경
<div key={i} className={`log-entry log-${log.level}`}>
  <span className="log-time">{formatTime(log.timestamp)}</span>
  <span className="log-icon">{LEVEL_ICONS[log.level]}</span>
  <span className="log-msg">{log.msg}</span>
</div>
```

CSS는 인라인 style로 처리 (별도 CSS 파일 없음 — 파일 수 최소화).

## 검증

1. `npm run build` 통과
2. 앱 실행 → Workflow 진행 → Logs 패널 확인
3. 각 항목에 `[HH:MM:SS]` 표시 확인

## 영향 범위

- Must Preserve: 미접촉 (LogDrawer는 부가 UI, 핵심 플로우 아님)
- IPC 변경: `log` 채널에 필드 추가만 (기존 수신 코드 영향 없음)
- 파일 수: 3개
