# SPEC: OAuth Popup Auto-Close (z.ai)

- Feature ID: `oauth-popup-autoclose`
- Risk: Standard
- Bundle ID: `oauth-popup-autoclose-R2`
- SPEC Revision: 2
- Status: APPROVED
- Last Updated: 2026-08-19

> Rev 2 (2026-08-19): owner 검증 중 발견된 blocker — z.ai 로그인 감지가
> `tokenPresent || composerPresent` OR 조건이라 signed-out 랜딩 페이지의
> composer 때문에 "Logged in" 오탐. 판정을 `tokenPresent AND !signInVisible`로
> 강화하는 수정을 본 작업 범위에 추가 (owner 메시지 "확인해줘").

## Context / User / Goal

- Context: v1.1.0 owner 테스트에서 z.ai 임베디드 패널 Google 로그인은 성공하지만,
  OAuth 팝업이 콜백(raw `{"detail":"invalid state"}` JSON 렌더)에서 닫히지
  않고 남는다 (DEV_LOG 2026-08-17 — cosmetic, follow-up 후보로 기록).
  원인: OAuth 팝업 auto-close의 return URL 정규식(`AI_RETURN_RE`)이
  chatgpt/deepseek/perplexity만 분기하고 `zai` 케이스가 없어, z.ai는
  perplexity 정규식으로 평가되어 return URL이 절대 매칭되지 않는다.
- User: 데스크톱 앱 단일 사용자(Owner)
- Goal: z.ai Google OAuth 완료 시 팝업이 자동으로 닫히고 패널이 새 세션으로
  리로드된다.
- Current behavior: z.ai OAuth 콜백 후 팝업이 열린 채로 남음 (세션 쿠키는
  `persist:zai`에 정상 저장됨). 수동으로 닫으면 `closed` 핸들러가
  login-status-changed를 본창에 본냄.
- Desired behavior: 콜백 URL이 z.ai 도메인으로 돌아오면 `reloadHomeView()`가
  실행되어 팝업 자동 종료 + BrowserView 리로드 (기존 3개 provider와 동일).

## In Scope / Out of Scope

- In: `electron/main.ts`의 OAuth return 정규식에 `zai` 분기 추가
  (`/^https?:\/\/([^/]*\.)?z\.ai/`)
- Out: 팝업 구조/타이밍 변경, 다른 provider 정규식 변경, Google anti-bot
  경고 페이지 자체의 제거(Google 측 정책 — 제어 불가)

## Affected Areas

- Screens/flows: Accounts 패널 z.ai Google 로그인 플로우
- Data/models: 없음 / APIs: 없음 / Roles: 없음

## Security · Privacy · Data

- Data class: Internal. 세션 쿠키는 기존과 동일하게 `persist:` 파티션에만.
  secret/PII/외부 발신 없음.

## Edge Cases / Failure Behavior

- `invalid state` 콜백 JSON도 z.ai 도메인 URL이므로 return 정규식에
  매칭되어 팝업이 닫힌다 (세션은 이미 저장된 상태 — 기존 관측과 동일).
- 팝업을 사용자가 먼저 닫아도 기존 `closed` 핸들러가 동작한다.
- 정규식 오매칭 방지: `([^/]*\.)?z\.ai`는 z.ai와 그 서브도메인만 허용.

## Acceptance Criteria

| ID | Observable criterion | Verification | Status |
|---|---|---|---|
| AC-1 | z.ai 임베디드 패널 Google 로그인 완료 시 팝업이 자동 종료되고 패널이 로그인된 홈으로 리로드 | 실액 수동 테스트 | Pending |
| AC-2 | chatgpt/deepseek/perplexity OAuth auto-close 회귀 없음 (정규식 미변경 확인) | 코드 검토 | Pending |
| AC-3 | tsc/build PASS | 명령 실행 | Pending |

## Approval

- Mode: STANDARD_BUNDLE_IN_PLAN
- Standard ledger: PLAN.md#approval-bundle
- High decision: N/A
- User message: 2026-08-19, "둘다 순서대로 진행해서 완료해" — follow-up
  2건(Gemini direct path, OAuth 팝업 auto-close)의 순차 진행을 승인
