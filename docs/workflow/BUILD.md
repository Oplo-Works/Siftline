# WF:BUILD — One Approved Slice

> 담당 Runtime은 PIN의 승인된 routing을 따른다.
> Input: 승인된 PLAN의 slice 하나. Output: 작은 task-owned code/test change.

## 규칙

- 승인된 slice 하나만 구현한다.
- 기존 동작과 시작 전 사용자 변경을 보존한다.
- broad rewrite, 승인 안 된 기능, 새 dependency/schema/permission, 실제 고객 데이터,
  secret hardcoding, assertion 삭제를 금지한다.
- 승인된 paths를 벗어나야 하면 중단하고 `NEEDS_APPROVAL`로 올린다.
- 변경 후 targeted checks를 실행한다.
- BUILD 단계에서는 remote push하지 않는다. review 가능한 local commit의 최종 시점은 TEST와
  GIT_SAFETY가 정한다.

## 에러 전달 형식 — raw log 금지

```text
Goal: [원래 목표]
Command: [실패한 정확한 명령]
Environment: [runtime/library versions]
Redacted error excerpt: [secret/PII/customer data/private path 제거]
Minimal reproduction: [최소 단계]
Attempts already made: [시도]
Allowed files: [공유 가능한 파일]
```

마스킹을 확신할 수 없으면 전송하지 않고 사용자에게 확인한다.

## Escalation

1. 구현자 자가수정: 재현된 같은 오류에 최대 2회의 의미 있는 시도.
2. Runtime Specialist: compile/runtime, current SDK/API, framework/tooling.
3. Deep Reasoning: architecture, business rule, data model, security boundary.

## Slice Prompt

```text
STAGE: WF:BUILD
FEATURE: [feature-id]
SLICE: [S1]
RISK: [Standard|High]
SPEC/PLAN: [paths + revisions]
AC IDs: [IDs]
BASE: [sha]
ALLOWED PATHS: [paths]
PRESERVED USER CHANGES: [paths or none]

Implement approved slice [S1] only. Add or update tests for the mapped AC IDs.
Run targeted checks. Do not broaden scope. Do not push. Follow GIT_SAFETY for
any local commit, and respect HOLD_FOR_REVIEW.
```

## Runtime Escalation Prompt

```text
This is a runnability or current-SDK escalation.
[redacted error block]
Return the smallest runnable fix for the approved slice. Do not redesign.
If the root cause needs architecture, schema, permission, dependency, or wider
scope, stop and request a Deep/Human decision.
```

## Deep Escalation Prompt

```text
This is a design/logic/security escalation, not volume coding.
Read the approved SPEC/PLAN, redacted evidence, attempts, and relevant files.
Return: root cause, decision, alternatives, invariants, required document
updates, exact acceptance checks, and recommended implementation role.
```
