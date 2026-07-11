# WF:MICRO — Low-Risk Fast Path

> 사용자의 현재 채팅 요청이 곧 범위와 승인이다. 별도 SPEC/PLAN과 독립 리뷰는 생략한다.
> 모든 entry condition이 참일 때만 사용한다.

## Entry Conditions

- [ ] 사용자 관찰 동작이 변하지 않는다.
- [ ] schema, API contract, persisted data, dependency 변화가 없다.
- [ ] 인증·권한·보안·개인정보 영향이 없다.
- [ ] production·외부 side effect가 없다.
- [ ] diff가 작고 명확하다.
- [ ] 테스트 파일명·테스트명 변경이라면 discovery, filter, CI selection에 영향이 없음을 확인했다.
- [ ] 로그 문구 변경이라면 structured key, parser, alert, audit, support contract에 영향이 없음을 확인했다.

하나라도 불확실하면 Standard로 올린다.

## Procedure

1. GIT_SAFETY preflight로 사용자 변경을 분리한다.
2. task-owned 변경만 수행한다.
3. targeted check를 실행한다.
4. `DEV_LOG.md`에 한 줄 append한다.
5. 기본 정책에서는 task change와 이 한 줄 DEV_LOG를 **하나의 atomic commit**에 넣을 수 있다.
   별도 metadata commit은 필요 없다.
6. HANDOFF는 owner, status, blocker가 바뀌거나 다음 세션이 별도 맥락을 필요로 할 때만 갱신한다.
7. inline `WF:CLOSE` gate를 확인한 뒤, side-effect 없는 허용 target이면 자동 push한다.
8. 사용자가 HOLD_FOR_REVIEW를 지정하면 commit/push하지 않고 `READY_FOR_REVIEW`로 종료한다.

## Prompt

```text
STAGE: WF:MICRO
REQUEST: [사용자 요청]

Confirm every MICRO condition. If uncertain, stop and propose Standard.
Make the smallest task-owned change, run targeted checks, append one DEV_LOG
line, and follow the MICRO atomic commit + inline CLOSE rule. Never push if
that push triggers an unapproved deploy, release, notification, or paid action.
```
