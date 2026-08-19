# SPEC: Gemini Prompt Focus Guard

- Feature ID: `gemini-prompt-focus-guard`
- Risk: Standard
- Bundle ID: `gemini-prompt-focus-guard-R1`
- SPEC Revision: 1
- Status: APPROVED
- Last Updated: 2026-08-19

## Context / User / Goal

- Context: Gemini 프롬프트 주입의 첫 시도가 간헐적으로 실패한다. 실패 시
  Gemini 대화창 전체가 선택(전체 페이지 selection)되고, 최종적으로
  `Prompt injection verification failed for gemini` 에러가 발생한다.
  사용자가 retry를 누르면 정상 입력된다. 원인 진단(2026-08-19): composer에
  selection/caret이 잡히지 않은 상태에서 `document.execCommand('selectAll')`
  및 Ctrl+A가 실행되어 document body 전체가 선택되고, paste/insertText가
  composer에 적용되지 않아 readback 검증이 실패한다. 첫 시도의
  focus/click 시도가 "워밍업" 역할을 해서 retry는 성공한다.
- User: 데스크톱 앱 단일 사용자(Owner)
- Goal: Gemini 첫 시도에서도 composer 외부(페이지 전체)가 선택되지 않고
  프롬프트가 한 번에 안정적으로 주입된다.
- Current behavior:
  - Gemini one-shot 삽입(`insertComposerTextWithLineCommands`)과 per-line
    클리어 단계가 `document.execCommand('selectAll')`을 사용 — caret이
    composer 밖이면 전체 페이지 선택.
  - Clipboard fallback이 무조건 Ctrl+A를 전송 — 동일하게 전체 페이지 선택
    가능. `document.hasFocus()` 체크는 warn 로그만 남기고 paste 진행.
  - 모든 경로 실패 시 throw → UI에 "Failed to get a reply from Gemini:
    Prompt injection verification failed for gemini".
- Desired behavior:
  - composer 범위로 한정된 Selection API(`range.selectNodeContents(target)`)
    로 기존 내용을 선택·삭제 — 포커스 상태와 무관하게 페이지 전체 선택이
    원천 차단된다.
  - Clipboard fallback에서 Gemini(contenteditable)는 Ctrl+A 대신 scoped
    selection을 설정한 뒤 Ctrl+V한다.
  - 기존 검증(readback digest/구조 검증)과 실패 시 에러 동작은 유지.

## In Scope / Out of Scope

- In:
  - `electron/main.ts`의 Gemini 프롬프트 주입 경로
    (`insertComposerTextWithLineCommands`, `insertComposerTextLineByLineVerified`
    클리어 단계, `pasteText` clipboard fallback의 Gemini 분기)
  - selection 범위 한정 헬퍼 추가
- Out:
  - 다른 6개 provider의 주입 경로 (기존 동작 보존)
  - Gemini 응답 수신/파싱 로직
  - selector 변경 (`electron/selectors.json` 그대로)
  - Gemini direct path truncation 자체의 근본 수정(live composer
    instrumentation 필요 — 이전 HANDOFF의 residual risk로 기록됨)

## Affected Areas

- Screens/flows: Council Chat `@gemini`/`@all`, Workflow 모드의 Gemini 발신,
  Telegram 경유 Gemini 발신 (모두 `pasteText`를 공유)
- Data/models: 없음
- APIs/integrations: Gemini 웹 composer DOM 조작 방식만 변경
- Roles/permissions: 없음

## Security · Privacy · Data

- Data class: Internal (로컬 앱 내부 동작)
- Retention/provider constraints: 없음
- Risks and required approvals: 없음 — secret/PII/외부 발신 없음

## Edge Cases / Failure Behavior

- composer element를 찾지 못함 → 기존과 동일하게 삽입 false → 다음 경로로
  fallthrough.
- scoped selection 설정 실패(JS 예외) → false 반환, clipboard fallback으로
  fallthrough.
- clipboard fallback에서도 검증 실패 → 기존 재시도(최대 3회) 후 동일한
  verification-failed 에러 유지 (silent 성공 위장 없음).
- parallel broadcast 중 다른 패널이 OS 포커스를 보유 → scoped selection은
  in-page selection만 사용하므로 포커스 무관하게 동작해야 함 (AC-3).

## Acceptance Criteria

| ID | Observable criterion | Verification | Status |
|---|---|---|---|
| AC-1 | Gemini 주입 경로의 어느 단계에서도 `execCommand('selectAll')`/Ctrl+A가 페이지 body에 적용되지 않는다 (selection은 항상 composer 범위로 한정) | 코드 검토 + 실앱 첫 시도에서 전체 페이지 선택 현상 부재 | Pending |
| AC-2 | 새 대화 첫 전송(콜드 상태)에서 Gemini 프롬프트가 retry 없이 1회에 주입·검증 통과 | 실앱 수동 테스트 (`build-and-run.bat`) | Pending |
| AC-3 | `@all` broadcast에서 Gemini 포함 7개 provider 주입이 기존과 동일하게 동작 (회귀 없음) | 실앱 수동 테스트 | Pending |
| AC-4 | `npx tsc --noEmit` 및 `npm run build` PASS | 명령 실행 | Pending |

## Approval

- Mode: STANDARD_BUNDLE_IN_PLAN
- Standard ledger: PLAN.md#approval-bundle
- High decision: N/A
- User message: 2026-08-19, "어 승인할게. 수정 시작하자" — 진단 메시지에
  제시된 3개 수정 방향(scoped selection, 포커스 선제 확인, clipboard
  fallback 포커스 게이트)의 구현을 승인
