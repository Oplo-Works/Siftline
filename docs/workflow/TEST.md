# WF:TEST — Verification and Review Packet

> Output: `docs/features/<feature-id>/TEST_EVIDENCE.md`
> Standard/High의 목적은 검증된 local implementation target과 review packet을 만드는 것이다.
> 이 단계에서는 remote push하지 않는다.

## 증거 원칙

- 실행하지 않은 검사를 PASS로 쓰지 않는다.
- 최종 code target, command, cwd, environment, timestamp, exit, duration을 기록한다.
- 검증 후 formatter/hook/code가 바뀌면 영향받는 검사를 다시 실행한다.
- test가 없는 프로젝트에서 build만으로 기능 정확성을 주장하지 않는다.
- 실제 명령의 원본은 `PROJECT_SCOPE.md`다.

## Evidence Template

```markdown
# Test Evidence: [feature/task]

- Overall Result: [PASS|FAIL|NOT_RUN|BLOCKED|FLAKY|SKIPPED_WITH_REASON|WAIVED_BY_APPROVAL]
- Implementation Base: [sha]
- Implementation Head: [sha or explicit diff]
- Verified Target: [sha or explicit diff]
- Environment: [OS/runtime/framework versions]

| Timestamp UTC | Target | Command | CWD | Exit | Duration | Result | AC IDs | Notes |
|---|---|---|---|---:|---:|---|---|---|
| [time] | [sha/diff] | [command] | [path] | 0 | [s] | PASS | AC-1 | [notes] |

## Manual Checks
- Result: [PASS|FAIL|NOT_RUN]
- Steps/evidence: [내용]
- Missing tool/environment: [내용]

## Skipped / Flaky / Blocked
- [검사, 이유, owner, 재개 조건]

## Residual Risk
- [남은 위험]
```

## 최소 Gate

| 변경 유형 | 최소 검증 |
|---|---|
| 문서 | 링크·펜스·형식 + 사실 확인 |
| 단순 UI | typecheck/lint + component/smoke + empty/loading/error |
| API·비즈니스 | unit + integration + error path + authorization |
| schema/migration | forward/rollback dry run + 정합성 + 복구 계획 |
| 인증·권한 | positive/negative permission + 경계 격리 |
| 결제·회계 | sandbox + idempotency + reconciliation + Human approval |
| dependency | build/test + lockfile + breaking/security/license |

## Standard/High Review Packet 절차

HOLD_FOR_REVIEW가 아닌 경우:

1. 최종 task-owned code/test를 검증한다.
2. implementation change만 local commit한다.
3. hook/formatter가 내용을 바꿨으면 implementation head 기준으로 재검증한다.
4. `TEST_EVIDENCE.md`와 HANDOFF의 `READY_FOR_REVIEW` routing을 갱신한다.
5. 이 review packet metadata를 local commit한다. 이 경계 commit에는 code를 섞지 않는다.
6. `Review Range = Implementation Base..Implementation Head`를 고정한다.
7. **push하지 않고** Independent Reviewer에게 넘긴다.

HOLD_FOR_REVIEW인 경우 local commit도 만들지 않고 명시된 working-tree diff를 review target으로
사용한다. 사용자 변경과 안전하게 분리할 수 없으면 중단한다.

## Prompt

```text
STAGE: WF:TEST
FEATURE: [feature-id]
SLICE: [S1]
AC IDs: [IDs]
TARGET: [candidate sha or explicit diff]

Verify against AC IDs and write TEST_EVIDENCE.md. Record exact command, cwd,
exit, duration, and target. After PASS, create the local review packet only if
GIT_SAFETY and PROJECT_SCOPE authorize it. Do not push.
```
