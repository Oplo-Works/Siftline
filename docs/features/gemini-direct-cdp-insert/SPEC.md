# SPEC: Gemini Direct CDP Insert

- Feature ID: `gemini-direct-cdp-insert`
- Risk: Standard
- Bundle ID: `gemini-direct-cdp-insert-R1`
- SPEC Revision: 1
- Status: APPROVED
- Last Updated: 2026-08-19

## Context / User / Goal

- Context: Residual risk carried in two HANDOFFs — Gemini direct(DOM) 주입이
  owner 머신에서 여전히 truncation을 일으키고, per-line 검증 삽입까지 실패하면
  최종적으로 직렬화 clipboard fallback이 이를 수리한다. Clipboard 경로는
  OS 포커스/네이티브 입력 lock에 의존해 비용이 크고 근본 수정에는 live
  composer 계측이 필요하다고 기록됐다.
- User: 데스크톱 앱 단일 사용자(Owner)
- Goal: Gemini 프롬프트 주입이 clipboard fallback 없이 direct path에서
  1차로 성공하고, 각 경로의 성공/실패가 로그로 관측 가능하다.
- Current behavior: Gemini 체인은 `execCommand 라인 삽입 → per-line 검증 삽입
  → clipboard fallback` 순. execCommand 기반 삽입은 Quill composer의
  중간 re-render로 라인을 유실할 수 있다(2026-08-13 관측).
- Desired behavior: Gemini 체인의 첫 시도로 trusted CDP `Input.insertText`
  (Chromium 실제 입력 파이프라인 경유 — Quill이 실제 타이핑처럼 처리)을
  사용하고, 실패 시 기존 execCommand/per-line/clipboard 체인이 그대로
  fallback으로 동작한다. CDP 준비 단계의 selection은
  `scopeComposerSelection`으로 composer에 한정한다.

## In Scope / Out of Scope

- In: `electron/main.ts` — Gemini 주입 체인에 CDP 1차 경로 추가,
  `insertComposerTextViaCDP`에 Gemini용 scoped-selection 준비 분기
- Out: 다른 6개 provider 경로(Perplexity CDP 준비 동작 포함) 변경,
  selector 변경, clipboard fallback 제거(유지)

## Affected Areas

- Screens/flows: Council Chat/Workflow/Telegram 경유 Gemini 발신
- Data/models: 없음 / APIs: Gemini composer DOM 조작 방식 추가 / Roles: 없음

## Security · Privacy · Data

- Data class: Internal. secret/PII/외부 발신 없음.

## Edge Cases / Failure Behavior

- CDP debugger attach 실패 → false → 기존 execCommand 체인으로 fallthrough.
- CDP 삽입 후 readback 불일치 → 다음 경로로 fallthrough (silent 위장 없음).
- 모든 경로 실패 → 기존 verification-failed 에러 유지.

## Acceptance Criteria

| ID | Observable criterion | Verification | Status |
|---|---|---|---|
| AC-1 | Gemini 주입이 `method=cdp-insertText verified=true` 로그와 함께 clipboard fallback 없이 성공 | 실앱 수동 테스트 + Logs | Pending |
| AC-2 | CDP 실패 시 기존 체인(execCommand→per-line→clipboard)이 fallback으로 동작 | 로그 검토 (또는 강제 실패 시나리오) | Pending |
| AC-3 | `@all` broadcast 회귀 없음 (7 provider) | 실앱 수동 테스트 | Pending |
| AC-4 | tsc/build PASS | 명령 실행 | Pending |

## Approval

- Mode: STANDARD_BUNDLE_IN_PLAN
- Standard ledger: PLAN.md#approval-bundle
- High decision: N/A
- User message: 2026-08-19, "둘다 순서대로 진행해서 완료해" — HANDOFF에
  기록된 follow-up 2건(Gemini direct path 근본 수정, OAuth 팝업
  auto-close)의 순차 진행을 승인
