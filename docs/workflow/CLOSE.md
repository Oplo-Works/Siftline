# WF:CLOSE — Finalize, Record, and Publish

> 담당: Implementation Owner 또는 명시된 Release Owner. Independent Reviewer는 CLOSE하지 않는다.
> Standard/High의 기본 remote push는 이 stage에서 한 번만 수행한다.

## Entry Gate

| Risk | CLOSE 진입 조건 |
|---|---|
| Low | MICRO targeted checks PASS 또는 승인된 waiver |
| Standard | Reviewer `PASS`, 또는 `NEEDS_HUMAN_APPROVAL`이 유효한 Human `APPROVED`/`APPROVED_WITH_RISK`로 해결됨 |
| High | Reviewer `PASS` 또는 `NEEDS_HUMAN_APPROVAL` 이후 Human `APPROVED`/유효한 `APPROVED_WITH_RISK` |

P0 open finding 또는 Reviewer `CHANGES_REQUESTED`가 남아 있으면 CLOSE 금지.
`CHAT_ONLY_READ_ONLY`는 이 playbook을 실행하지 않는다.

## Procedure

1. 최종 status를 정한다: `READY`, `DONE`, `READY_FOR_REVIEW`, `NEEDS_APPROVAL`, `BLOCKED`, `CANCELLED`.
2. 실제 branch, implementation head, review result, Human decision, required checks를 재확인한다.
3. push target, protected-branch rule, deploy/release/notification/paid trigger를 확인한다.
4. `DEV_LOG.md`에 최종 event를 append한다.
5. `HANDOFF.md`를 갱신한다. Context Summary 3~5줄, Next Role을 포함한다. close metadata
   commit 자신이 push 대상이면 `Expected Remote Head: SELF — resolve close metadata commit`을 쓴다.
6. handoff를 읽을 때의 Updated At/Task/branch와 다시 비교한다. 바뀌었으면 stale conflict로 중단한다.
7. close metadata commit을 만든다. task-owned code를 이 commit에 섞지 않는다.
8. 정책이 `AUTO_AT_CLOSE`이고 모든 gate가 충족되면 exact allowlisted target으로 push한다.
9. remote head를 확인한다. 실패하면 `BLOCKED / PUBLISH_FAILED`로 보고한다.
10. 실제 push 결과는 채팅 Output Block에 기록한다. 다음 START가 durable remote reconciliation을 한다.

Milestone·병렬 task·감사 요구가 있을 때만 이전 HANDOFF를
`docs/handoff_history/YYYYMMDDTHHMMSSZ-<task-id>.md`로 복사한다. 평상시엔 Git history가 이력이다.

## DEV_LOG Event

```markdown
## YYYY-MM-DDTHH:mm:ssZ — [TASK ID]
- Stage: [WF:...]  - Role/Runtime: [value]  - Risk: [Low|Standard|High]
- Implementation: [base..head | explicit diff | N/A]
- Review: [path + decision | N/A]
- Human Decision: [APPROVED|APPROVED_WITH_RISK|REJECTED|N/A]
- Summary: [무엇이 왜 바뀌었나]
- Validation: [evidence path + result]
- Publish Intent/Target: [enum + remote/branch]
- Decisions / Risks / Follow-ups: [항목]
- Next: [status + owner]
```

## Output Block

```text
STATUS: [READY|IN_PROGRESS|READY_FOR_REVIEW|NEEDS_APPROVAL|BLOCKED|DONE|CANCELLED]
TASK: [task-id]   STAGE: [WF:...]   RISK: [Low|Standard|High]
IMPLEMENTATION: [base..head | explicit diff | N/A]
VERIFICATION: [summary]
REVIEW: [PASS|CHANGES_REQUESTED|NEEDS_HUMAN_APPROVAL|N/A]
HUMAN DECISION: [APPROVED|APPROVED_WITH_RISK|REJECTED|N/A]
PUSH INTENT: [NOT_REQUIRED|AUTO_AT_CLOSE|HOLD_FOR_REVIEW|NEEDS_APPROVAL]
PUSH RESULT: [VERIFIED remote/branch@sha|NOT_ATTEMPTED|FAILED|N/A]
NEXT ROLE: [role|Human|None]   RUNTIME: [PIN id|Unassigned]
NEXT ACTION: [one action]
WORKTREE: [REPO_CLEAN|USER_DIRTY_ONLY|TASK_DIRTY_ONLY|MIXED_DIRTY|UNKNOWN]
BLOCKER/APPROVAL: [value|None]
```
