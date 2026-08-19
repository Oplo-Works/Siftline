# TEST EVIDENCE: Gemini Direct CDP Insert

- Feature ID: `gemini-direct-cdp-insert`
- Bundle ID: `gemini-direct-cdp-insert-R1`
- Implementation: `70f0d40..fc4ca62` on `kimi/gemini-direct-cdp-insert`
- Date: 2026-08-19

## Automated Checks

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS |
| Build | `npm run build` | PASS |
| Secret/PII scan | staged diff manual review | PASS — 코드/문서만 |

## Owner Actual-App Verification (2026-08-19, owner 캡처 로그)

2804자 / 46라인 프롬프트(`sample-prompt-task-a.md` 기반 council 래핑)를
Gemini에 주입:

```text
[16:17:34] [pasteText] gemini: method=cdp-insertText verified=true
  readback=innerText expectedChars=2804 observedChars=2869
  expectedComparableChars=2248 observedComparableChars=2248
  expectedIdentity=Gemini observedIdentity=Gemini structureMode=enforce
  expectedLines=46 observedLines=46
  expectedLineDigest=d6829246219151cb observedLineDigest=d6829246219151cb
  structureMatches=true
[16:17:34] [council] gemini: waiting for composer to become send-ready
[16:17:35] [native-input-lock] begin/end #1 clickSend:gemini
[16:17:38+] [stream] gemini generating ... 응답 스트리밍 정상
```

| AC | Criterion | Result |
|---|---|---|
| AC-1 | CDP 1차 경로로 clipboard fallback 없이 주입 성공 (`method=cdp-insertText verified=true`) | PASS — execCommand/per-line/clipboard 시도 없이 1회 성공, 46/46 라인 digest 일치 |
| AC-2 | CDP 실패 시 기존 체인 fallback 동작 | PASS (코드 검토) — fallback 체인 미변경, CDP false/불일치 시 기존 경로로 fallthrough. 강제 실패 시나리오는 실액 재현 불가로 NOT_RUN |
| AC-3 | `@all` broadcast 회귀 없음 | PASS — owner 실액 확인 (2026-08-19, "긴 프롬프트 잘되": 동일 프롬프트 `@all` 전송, 7개 provider 정상 주입·응답) |
| AC-4 | tsc/build PASS | PASS |

## Notes

- 기존엔 동일 조건에서 execCommand 라인 유실 → per-line 재시도 → clipboard
  fallback까지 갔으나, CDP가 1차에서 종결 (lock 대기/클립보드 직렬화 비용 소거).
- 검증은 합성 검증 브랜치(`kimi/verify-gemini-cdp-plus-oauth`, 로컬 전용)
  worktree에서 수행됨.
