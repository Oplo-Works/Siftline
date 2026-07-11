# GIT_SAFETY — Ownership, Local Commits, and Publish

## 1. 변경 소유권

- 세션 시작 전에 존재한 dirty/untracked/staged 변경은 사용자 소유다.
- 읽을 수는 있지만 stage·commit·stash·reset·checkout·restore·clean·삭제·이동하지 않는다.
- `git add .` 금지. task-owned paths만 명시한다.
- 기존 staged 변경이 있으면 같은 index에서 agent commit을 만들지 않는다. 사용자 확인 또는
  별도 worktree를 사용한다.
- task path와 사용자 dirty path가 겹치면 중단하고 범위를 합의한다.

```text
Worktree State:
REPO_CLEAN | USER_DIRTY_ONLY | TASK_DIRTY_ONLY | MIXED_DIRTY | UNKNOWN
```

`TASK_DIRTY_ONLY`, `MIXED_DIRTY`, `UNKNOWN`은 unattended handoff 불가. 단, 사용자가 명시적으로
HOLD_FOR_REVIEW를 요청한 task-owned diff는 `READY_FOR_REVIEW`로 사람에게 직접 넘길 수 있다.

## 2. Commit 종류와 경계

```text
Implementation commit
- task-owned code/test/config 중 승인 범위의 구현만
- Standard/High review 전에 local로 생성 가능

Review-packet metadata commit
- TEST_EVIDENCE + READY_FOR_REVIEW HANDOFF routing
- TEST 완료 경계에서 local로 생성

Review-artifact metadata commit
- REVIEW.md + 최소 HANDOFF routing
- reviewer session 종료 또는 owner 교체 시 local로 생성
- 같은 orchestrated session에서 즉시 CLOSE하면 close metadata commit에 합칠 수 있음

Close metadata commit
- 최종 DEV_LOG, HANDOFF, 승인·evidence 상태
- WF:CLOSE에서 생성하고 그 뒤 exact head를 push

MICRO atomic commit
- Low task change + 한 줄 DEV_LOG
- 별도 metadata commit을 생략할 수 있음
```

같은 owner가 같은 연속 세션 안에서 수행하는 내부 step은 commit 경계가 아니다. 다음은 경계다:
`READY_FOR_REVIEW`, owner/session 교체, `NEEDS_APPROVAL`, `BLOCKED`, `DONE`, milestone.

기록 필드:

```text
Implementation Base
Implementation Head
Implementation Commits (optional)
Verified Target
Review Range: base..head
Review Packet Metadata State: SELF | <prior sha> | N/A
Review Artifact Metadata State: SELF | <prior sha> | N/A
Close Metadata State: SELF | N/A
```

HANDOFF에 현재 metadata commit 자신의 SHA를 넣지 않는다. 해당 boundary 문서에는 `SELF`를
기록하고 다음 START가 관련 path의 Git history에서 실제 SHA를 해석한다.

## 3. Risk별 순서

### Low / MICRO

```text
change → targeted check → MICRO atomic commit → inline CLOSE → allowed push
```

### Standard

```text
change → TEST → local implementation commit → re-test if hooks changed
→ local review-packet metadata commit → independent REVIEW
→ local review-artifact metadata commit if used
→ WF:CLOSE close metadata commit → one push
```

### High

```text
change → TEST → local implementation commit → review packet
→ independent REVIEW → Human APPROVED/APPROVED_WITH_RISK
→ WF:CLOSE close metadata commit → one push
```

HOLD_FOR_REVIEW는 local commit도 금지한다. explicit diff를 review target으로 사용한다.

## 4. Push — WF:CLOSE only

- 기본 policy는 `PROJECT_SCOPE.md`의 `Push Policy`와 allowlist를 따른다.
- Standard/High의 BUILD/TEST/REVIEW에서는 push하지 않는다.
- CLOSE 전에 remote, branch, upstream, protected-branch rule, exact local head를 확인한다.
- 허용 target이 아니면 `NEEDS_APPROVAL`.
- force-push와 history rewrite는 구체적 승인 없이는 금지.
- push가 deploy, release, 외부 메시지, 알림, 유료 workflow를 직접 유발하면 별도 domain 승인이
  없이는 push하지 않는다. 일반 `AUTO_AT_CLOSE`는 그 side effect를 승인하지 않는다.
- push 성공 후 remote head를 확인한다.
- push 성공 결과를 같은 metadata commit에 다시 쓰는 자기참조 loop를 만들지 않는다.
  close metadata commit을 포함해 push할 때 HANDOFF의 `Expected Remote Head`는
  `SELF — resolve close metadata commit`으로 둔다. Output Block에는 실제 SHA를 기록한다.
- 다음 START가 HANDOFF path history와 upstream을 비교해 `Last Reconciled Remote Head`를 갱신한다.

```text
Push Intent: NOT_REQUIRED | AUTO_AT_CLOSE | HOLD_FOR_REVIEW | NEEDS_APPROVAL
Push Result: NOT_ATTEMPTED | VERIFIED | FAILED | N/A
```

push가 required인데 실패하면 `BLOCKED`이며 blocker code를 `PUBLISH_FAILED`로 기록한다.

## 5. Pre-push Gate

- required build/test/lint/typecheck PASS
- required secret scan PASS
- required security scan PASS 또는 명시적 NOT_RUN/approval
- staged diff에 secret/PII 없음
- task-owned paths만 포함
- exact target allowlisted
- protected branch와 side-effect trigger 확인

## 6. Headless Permission Examples

```text
read-only analysis/review:
  codex exec --sandbox read-only --model [exact-model-from-PIN] "[TASK]"

approved workspace modification:
  codex exec --sandbox workspace-write --model [exact-model-from-PIN] "[TASK]"
```

명령은 Runtime ID의 Permissions와 일치해야 하며 검증하지 않은 명령은 PIN에
`N/A — manual only`로 둔다.

## 7. Non-Git Project

Git을 임의로 초기화하지 않는다. commit/push는 `N/A`로 두고 변경 manifest나 도구의 버전
이력을 기록한다.
