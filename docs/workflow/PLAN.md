# WF:PLAN — Implementation Plan

> Output: `docs/features/<feature-id>/PLAN.md`
> Standard combined planning stage는 `WF:SPEC_PLAN`이며 SPEC과 같은 bundle로 한 번 승인한다.
> High는 승인된 SPEC 뒤에 별도 승인한다.

## 입력 Gate

- **Standard:** 같은 Bundle ID의 SPEC과 PLAN을 함께 DRAFT/READY_FOR_APPROVAL로 만들 수 있다.
- **High:** SPEC Status가 `APPROVED`이고 승인 메시지가 기록되어야 PLAN을 작성한다.

## Vertical Slice 원칙

- 사용자가 관찰할 수 있는 작은 end-to-end 결과를 만든다.
- 파일 3~5개는 heuristic이며, 응집된 안전한 변경을 억지로 쪼개지 않는다.
- 각 slice는 AC IDs, validation, rollback, expected paths를 가진다.
- dependency/schema/permission/production 영향은 High 후보로 올린다.

## Template

```markdown
# PLAN: [FEATURE NAME]

- Feature ID: [feature-id]
- Risk: [Standard|High]
- Bundle ID: [feature-id]-R[revision]  # Standard; High는 N/A
- PLAN Revision: [integer]
- SPEC: [path + SPEC revision + status]
- Status: [DRAFT|READY_FOR_APPROVAL|APPROVED|IN_PROGRESS|DONE|SUPERSEDED]
- Base Branch/Commit: [value]

## Baseline
- Existing behavior: [요약]
- Existing failures: [요약]
- Commands: [PROJECT_SCOPE의 명령]

## Slices
| Slice | User-visible goal | AC IDs | Expected paths | Data/API impact | Validation | Rollback | Status |
|---|---|---|---|---|---|---|---|
| S1 | [목표] | AC-1 | [경로] | [영향] | [명령] | [방법] | DRAFT |

## Dependencies / Assumptions
- [항목]

## Non-Goals
- [항목]

## Approval Bundle  # Standard의 유일한 approval ledger
- Mode: [STANDARD_BUNDLE|HIGH_SEPARATE]
- Bundle ID: [id | N/A]
- SPEC Revision approved: [value]
- PLAN Revision approved: [value]
- Decision: [PENDING|APPROVED|REJECTED]
- User message: [YYYY-MM-DD, 요지]
- Constraints / expiry: [범위·금지·만료]

## High PLAN Approval  # High만 사용
- Decision: [PENDING|APPROVED|REJECTED|N/A]
- User message: [YYYY-MM-DD, 요지 | N/A]
- Constraints: [범위·금지]
```

## Standard Approval 절차

```text
SPEC rev N + PLAN rev M을 함께 READY_FOR_APPROVAL
→ 사용자: “[feature-id]의 SPEC rev N과 PLAN rev M을 승인”
→ PLAN Approval Bundle에 메시지 날짜·요지 기록
→ SPEC/PLAN Status를 APPROVED로 갱신
→ substantive 내용이 바뀌면 새 revision으로 다시 승인
```

## Prompt

```text
STAGE: [WF:PLAN|WF:SPEC_PLAN]
FEATURE: [feature-id]
RISK: [Standard|High]
INPUT: [SPEC path/revision]
OUTPUT: docs/features/[feature-id]/PLAN.md

Break the work into reviewable vertical slices. Map every slice to AC IDs.
Include baseline, expected paths, validation commands, rollback, and non-goals.
For Standard, use the same Bundle ID and prepare one Approval Bundle.
For High, require separate PLAN approval. Do not implement.
```
