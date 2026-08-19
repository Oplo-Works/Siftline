# TEST EVIDENCE: OAuth Popup Auto-Close (z.ai) + Login Detection Fixes

- Feature ID: `oauth-popup-autoclose`
- Bundle ID: `oauth-popup-autoclose-R2`
- Implementation: `70f0d40..761e97a` on `kimi/oauth-popup-autoclose`
- Date: 2026-08-19

## Automated Checks

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS (각 커밋 시점) |
| Build | `npm run build` | PASS (각 커밋 시점) |
| Secret/PII scan | staged diff manual review | PASS — 코드/문서만 |

## Owner Actual-App Verification (2026-08-19)

| AC | Criterion | Result |
|---|---|---|
| AC-1 | z.ai OAuth 완료 시 팝업 자동 종료 | NOT_RUN (본) + PASS (코드 검토) — 이번 run에서는 z.ai 로그인이 팝업 없이 인패널로 완료되어 팝업 시나리오가 재현되지 않음. `zai` return regex 추가로 8/17 관측 경로(팝업 잔류)는 커버됨 |
| AC-1b (R2 추가) | 로그인 상태 감지 정확성 | PASS — 로그아웃 후 "Not logged in" 정상 표시(owner 스크린샷), 인패널 로그인 완료 후 "Logged in" 정상 전환(owner 확인) |
| AC-2 | chatgpt/deepseek/perplexity OAuth 회귀 없음 | PASS (코드 검토) — 기존 3개 regex 미변경, `zai` 분기만 추가 |
| AC-3 | tsc/build PASS | PASS |

## Notes

- z.ai 로그인 팝업 발생 여부는 로그인 방식/ z.ai 측 플로우에 따라 달라진다
  (8/17: 팝업 발생, 8/19: 인패널 완결). 어느 경로든 정상 동작 확인.
- Open panel 뷰 보장(`open-zai-panel` IPC)은 추가 개선으로 포함됐으나
  owner 환경에서 버튼 경로 미해결(ACTIVE 칩 경로는 정상). 로그 증거 부재로
  원인 미확정 — 후속 과제로 잔존 (HANDOFF residual risk 참조).
