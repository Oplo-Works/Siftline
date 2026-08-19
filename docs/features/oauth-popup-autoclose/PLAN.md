# PLAN: OAuth Popup Auto-Close (z.ai)

- Feature ID: `oauth-popup-autoclose`
- Risk: Standard
- Bundle ID: `oauth-popup-autoclose-R1`
- PLAN Revision: 2
- SPEC: `docs/features/oauth-popup-autoclose/SPEC.md` — SPEC Revision 1, APPROVED
- Status: APPROVED
- Base Branch/Commit: `kimi/oauth-popup-autoclose` @ `70f0d40` (main)

## Baseline

- Existing behavior: OAuth 팝업 auto-close의 `AI_RETURN_RE`가
  chatgpt/deepseek/perplexity 3개만 올바른 정규식을 가지며, `zai`는
  else 분기(perplexity 정규식)로 평가되어 return URL 미매칭 → 팝업 잔류.
- Existing failures: z.ai OAuth 후 팝업 미종료 (DEV_LOG 2026-08-17).
- Commands: `npx tsc --noEmit`, `npm run build`; 동작 변경이므로
  `build-and-run.bat` 실액 체크 필요.

## Slices

| Slice | User-visible goal | AC IDs | Expected paths | Data/API impact | Validation | Rollback | Status |
|---|---|---|---|---|---|---|---|
| S1 | z.ai OAuth 완료 시 팝업 자동 종료 | AC-1..AC-3 | `electron/main.ts` (AI_RETURN_RE 1줄 분기) | 없음 | tsc, build, 실액 | revert commit | APPROVED |

### S1 구현 상세

`AI_RETURN_RE` 삼항 체인에 `name === 'zai'` 분기 추가:
`/^https?:\/\/([^/]*\.)?z\.ai/` — 다른 3개 정규식은 그대로 유지.

## Dependencies / Assumptions

- z.ai OAuth 콜백은 z.ai 도메인으로 돌아온다 (2026-08-17 owner 관측:
  콜백 JSON이 팝업에 렌더됨 = z.ai 도메인 도달).

## Non-Goals

- Google anti-bot 경고 페이지 제거 (제어 불가)
- 다른 provider의 OAuth 플로우 변경

## Approval Bundle

- Mode: STANDARD_BUNDLE
- Bundle ID: `oauth-popup-autoclose-R2`
- SPEC Revision approved: 2
- PLAN Revision approved: 2
- Decision: APPROVED
- User message: 2026-08-19, "둘다 순서대로 진행해서 완료해" (R1);
  R2 범위 추가(z.ai 로그인 감지 오탐 수정)는 같은 날 owner의
  "분명히 z.ai 에서 log out 해놨는데도 말이야. 확인해줘" 요청으로 승인
- Constraints / expiry: `zai` OAuth/로그인 감지 분기만; 다른 provider 불변
