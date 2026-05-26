# Project State — AI Council

> v5 Lean Field Test용 한 페이지 현재 상태 요약.
> 상세는 `PROJECT_SCOPE.md`, `PRODUCT_BLUEPRINT.md`, `DEV_LOG.md` 참조.

---

## Snapshot

- **App**: AI Council (Electron + Vite + React + TypeScript)
- **Version**: v1.0.8 (출시 상태, 정상 동작 중)
- **Branch**: `main`
- **Repo root**: `C:\Users\Sales01\Documents\AI-Council-Chat\`
- **Last meaningful change**: 2026-05-26 (Field Test #1 완료 — Log timestamp 추가, 문서 정비)

## Active Field Test

- **System under test**: Project Engineering OS v5 Lean
- **Mode**: Freeze (추가 시스템 설계 금지, 2주간)
- **Field Test #1**: ✅ 완료 — Log timestamp (2026-05-26, commit b41dbfe)
- **Field Test #2**: 대기 중 — History AI 필터 (`HistoryDrawer.tsx` 1개 파일)
- **Log**: `docs/PROJECT_ENGINEERING_OS_FIELD_TEST_LOG.md`

## Working / Not Working

- **Working**: `PROJECT_SCOPE.md` → "Must Preserve" 전체 (v1.0.8 기능 셋)
- **Not working**: (없음)
- **In flight (uncommitted, 2026-05-26 시점)**:
  - `electron/councilPrompt.ts`
  - `electron/telegram/api.ts`, `bridge.ts`, `commands.ts`
  - `src/components/TelegramSettings.tsx`
  - `.github/workflows/build.yml`
  - `package.json`, `package-lock.json`
  - → Field Test 시작 전 정리/커밋 권장

## Next Decision Points

1. **Field Test #2 시작** — History AI 필터 (`/spec → /plan → /build → /test → /review → /log`)
2. 운영 일지를 채우기 전까지 v6 / 추가 시스템 문서 만들지 않기
3. 의미 있는 변경마다 `DEV_LOG.md` + Field Test 일지 동시 업데이트

## Out of Scope (now)

- 새 Project Engineering OS 버전(v6, v5.1) 생성
- `SYSTEM_MAINTENANCE.md` 등 추가 메타 문서 생성
- `PROJECT_SCOPE.md`의 "Later Phase" 항목 (자동 워크플로, 8번째 AI provider,
  클라우드 동기화, 자동 채점, 모바일 네이티브)
