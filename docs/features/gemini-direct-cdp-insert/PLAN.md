# PLAN: Gemini Direct CDP Insert

- Feature ID: `gemini-direct-cdp-insert`
- Risk: Standard
- Bundle ID: `gemini-direct-cdp-insert-R1`
- PLAN Revision: 1
- SPEC: `docs/features/gemini-direct-cdp-insert/SPEC.md` — SPEC Revision 1, APPROVED
- Status: APPROVED
- Base Branch/Commit: `kimi/gemini-direct-cdp-insert` @ `70f0d40` (main)

## Baseline

- Existing behavior: Gemini 주입 체인 = execCommand 라인 → per-line 검증 →
  clipboard fallback. truncation 발생 시 clipboard이 수리.
- Existing failures: owner 머신에서 direct path truncation 지속
  (HANDOFF 2026-08-13/19 residual risk).
- Commands: `npx tsc --noEmit`, `npm run build`; 동작 변경이므로
  `build-and-run.bat` 실액 체크 필요.

## Slices

| Slice | User-visible goal | AC IDs | Expected paths | Data/API impact | Validation | Rollback | Status |
|---|---|---|---|---|---|---|---|
| S1 | Gemini 주입이 CDP 1차 경로로 clipboard 없이 성공 | AC-1..AC-4 | `electron/main.ts` | 없음 | tsc, build, 실앱 | revert commit | APPROVED |

### S1 구현 상세

1. `insertComposerTextViaCDP`에 선택적 `aiName` 파라미터 추가 —
   `gemini`일 때 준비 단계의 `execCommand('selectAll')` 대신
   `scopeComposerSelection` 사용. Perplexity 호출부는 인자 생략으로 기존
   동작 그대로.
2. `pasteText`의 gemini 분기 맨 앞에 CDP 시도 추가:
   CDP → verify → (실패 시) 기존 execCommand 라인 → per-line → clipboard.
   각 시도는 기존 `logComposerVerification`으로 관측.

## Dependencies / Assumptions

- CDP `Input.insertText`는 Chromium 실제 입력 파이프라인을 거치므로 Quill이
  re-render 없이 처리한다 (Perplexity에서 검증된 동일 메커니즘).

## Non-Goals

- clipboard fallback/per-line 경로 제거 또는 변경
- 다른 provider의 주입 경로 변경

## Approval Bundle

- Mode: STANDARD_BUNDLE
- Bundle ID: `gemini-direct-cdp-insert-R1`
- SPEC Revision approved: 1
- PLAN Revision approved: 1
- Decision: APPROVED
- User message: 2026-08-19, "둘다 순서대로 진행해서 완료해"
- Constraints / expiry: Gemini 경로만; 다른 6개 provider 불변; 기존
  fallback 체인과 명시적 에러 동작 유지
