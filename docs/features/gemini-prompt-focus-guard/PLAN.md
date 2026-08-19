# PLAN: Gemini Prompt Focus Guard

- Feature ID: `gemini-prompt-focus-guard`
- Risk: Standard
- Bundle ID: `gemini-prompt-focus-guard-R1`
- PLAN Revision: 1
- SPEC: `docs/features/gemini-prompt-focus-guard/SPEC.md` — SPEC Revision 1, APPROVED
- Status: APPROVED
- Base Branch/Commit: `kimi/gemini-prompt-focus-guard` @ `443d3c7`
  (base branch: `kimi/replace-kimi-with-zai`)

## Baseline

- Existing behavior: Gemini 주입은 execCommand 라인 삽입 → per-line 검증 삽입
  → 직렬화 clipboard fallback(Ctrl+A/Ctrl+V) 순. 클리어는
  `document.execCommand('selectAll')` + `delete`에 의존.
- Existing failures: composer selection 미확보 상태에서 selectAll/Ctrl+A가
  body 전체를 선택 → paste가 composer에 적용되지 않음 → readback 검증 실패 →
  `Prompt injection verification failed for gemini`. retry 시에는 첫 시도의
  focus/click이 워밍업되어 성공.
- Commands: `npx tsc --noEmit`, `npm run build` (PROJECT_SCOPE §4);
  동작 변경이므로 `build-and-run.bat` 실앱 수동 체크 필요.

## Slices

| Slice | User-visible goal | AC IDs | Expected paths | Data/API impact | Validation | Rollback | Status |
|---|---|---|---|---|---|---|---|
| S1 | Gemini 첫 시도 주입이 페이지 전체 선택 없이 1회에 성공 | AC-1, AC-2, AC-3, AC-4 | `electron/main.ts` (pasteText Gemini 경로 + selection 헬퍼) | 없음 | tsc, build, 실앱 수동 테스트 | `git revert` of implementation commit | APPROVED |

단일 slice — 하나의 응집된 안전 변경(3개 함수가 같은 selection semantics를
공유)이므로 억지로 쪼개지 않는다.

### S1 구현 상세

1. `setComposerSelectionToContents` 헬퍼 추가: `window.getSelection()`에
   `range.selectNodeContents(target)`을 설정해 selection을 composer로 한정.
2. `insertComposerTextWithLineCommands`: `execCommand('selectAll')` → scoped
   selection + `execCommand('delete')`로 교체. caret이 composer 안에 있는지
   확인하고 아니면 click/focus 재시도 후 warn 로그.
3. `insertComposerTextLineByLineVerified` 클리어 단계: 동일 교체.
4. `pasteText` clipboard fallback: `aiName === 'gemini'`(contenteditable)일
   때 Ctrl+A 대신 scoped selection을 JS로 설정한 뒤 Ctrl+V. 다른 provider는
   기존 Ctrl+A 유지.

## Dependencies / Assumptions

- Chromium의 editing command는 focus보다 현재 selection 기준으로 editing
  host를 결정한다 (per-line 경로가 이미 동일 패턴으로 동작 중).
- Gemini composer는 `contenteditable` (selectors.json의
  `rich-textarea .ql-editor[contenteditable='true']`).

## Non-Goals

- Gemini direct path truncation 자체의 근본 수정
- 다른 provider의 주입 방식 변경
- selection 실패 시 자동 retry 횟수/타이밍 조정

## Approval Bundle

- Mode: STANDARD_BUNDLE
- Bundle ID: `gemini-prompt-focus-guard-R1`
- SPEC Revision approved: 1
- PLAN Revision approved: 1
- Decision: APPROVED
- User message: 2026-08-19, "어 승인할게. 수정 시작하자" — 진단에서 합의된
  scoped-selection 기반 수정 범위를 그대로 승인
- Constraints / expiry: Gemini 주입 경로만 변경; 다른 6개 provider 동작과
  must-preserve flows 불변; 실패 시 기존 명시적 에러 동작 유지
