# TEST EVIDENCE: Gemini Prompt Focus Guard

- Feature ID: `gemini-prompt-focus-guard`
- Bundle ID: `gemini-prompt-focus-guard-R1`
- Implementation: `443d3c7..92e9c07` on `kimi/gemini-prompt-focus-guard`
- Date: 2026-08-19

## Automated Checks

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS (exit 0) |
| Build | `npm run build` | PASS (exit 0) |
| Diff/whitespace scan | `git diff --check` | PASS — CR-at-EOL lines are the repo's known autocrlf condition (same as recorded in council-broadcast-send-hardening close) |
| Secret/PII scan | staged diff manual review | PASS — code/docs only, no keys·tokens·PII |

## Owner Actual-App Verification (2026-08-19)

Owner ran the app via `build-and-run.bat` and confirmed "좋아 잘 되" /
"테스트는 이미 해봤고 문제 없이 잘되".

| AC | Criterion | Result |
|---|---|---|
| AC-1 | selection이 페이지 body가 아닌 composer로 한정 (전체 대화창 선택 현상 부재) | PASS (owner actual-app) |
| AC-2 | 콜드 첫 전송에서 Gemini 주입 1회 성공 | PASS (owner actual-app) |
| AC-3 | `@all` broadcast 회귀 없음 (7 provider 정상 주입·전송) | PASS (owner actual-app) |
| AC-4 | tsc/build PASS | PASS |

## Notes

- `scopeComposerSelection()` helper가 selectAll/Ctrl+A의 body-wide 적용을
  원천 차단; 다른 6개 provider 경로는 미변경.
- Windows installer `release/Siftline-Setup-1.1.0.exe`를 `92e9c07` worktree에서
  로컬 빌드 (owner 요청, 2026-08-19). publish/tag/release 없음.
