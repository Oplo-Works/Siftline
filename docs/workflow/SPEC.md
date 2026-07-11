# WF:SPEC — Feature Specification

> Output: `docs/features/<feature-id>/SPEC.md`
> Standard combined planning stage는 `WF:SPEC_PLAN`이며 SPEC과 PLAN playbook을 함께 읽는다.
> Runtime은 PIN의 Main Driver/Deep Reasoning/Volume Builder 허용 역할에서 선택한다.

## 위험도별 승인 구조

### Standard — 두 파일, 한 Approval Bundle

1. 같은 planning pass에서 `SPEC.md`와 `PLAN.md`를 작성한다.
2. 두 문서에 같은 `Bundle ID`와 substantive `Revision`을 기록한다.
3. 두 문서를 `READY_FOR_APPROVAL`로 제시한다.
4. 사용자가 한 메시지로 **SPEC revision + PLAN revision**을 함께 승인한다.
5. `PLAN.md`의 `Approval Bundle`이 유일한 승인 ledger다. `SPEC.md`는 그 ledger를 참조한다.
6. 상태·승인 메타데이터만 갱신하는 것은 substantive revision을 올리지 않는다.

### High — 승인 분리

1. SPEC을 먼저 승인받는다.
2. 승인된 SPEC을 근거로 PLAN을 작성한다.
3. PLAN을 별도 메시지로 승인받는다.

Low는 `WF:MICRO`를 사용한다.

## SPEC 규칙

- 모든 acceptance criterion은 `AC-1`, `AC-2`처럼 안정적인 ID를 가진다.
- 관찰 가능한 결과와 검증 방식을 쓴다.
- current behavior, desired behavior, in/out scope, data/permission impact를 분리한다.
- agent가 승인 문구를 만들어도 승인이 아니다.

## Template

```markdown
# SPEC: [FEATURE NAME]

- Feature ID: [feature-id]
- Risk: [Standard|High]
- Bundle ID: [feature-id]-R[revision]  # Standard; High는 N/A
- SPEC Revision: [integer]
- Status: [DRAFT|READY_FOR_APPROVAL|APPROVED|SUPERSEDED]
- Last Updated: [YYYY-MM-DD]

## Context / User / Goal
- Context: [왜 필요한가]
- User: [누가 쓰나]
- Goal: [목표]
- Current behavior: [현재 동작]
- Desired behavior: [원하는 동작]

## In Scope / Out of Scope
- In: [항목]
- Out: [항목]

## Affected Areas
- Screens/flows: [항목]
- Data/models: [항목]
- APIs/integrations: [항목]
- Roles/permissions: [항목]

## Security · Privacy · Data
- Data class: [Public|Internal|Confidential|Restricted]
- Retention/provider constraints: [항목]
- Risks and required approvals: [항목]

## Edge Cases / Failure Behavior
- [상황 → 기대 동작]

## Acceptance Criteria
| ID | Observable criterion | Verification | Status |
|---|---|---|---|
| AC-1 | [조건] | [test/manual] | Pending |

## Approval
- Mode: [STANDARD_BUNDLE_IN_PLAN|HIGH_SEPARATE]
- Standard ledger: [PLAN.md#approval-bundle | N/A]
- High decision: [PENDING|APPROVED|REJECTED|N/A]
- User message: [YYYY-MM-DD, 요지 | N/A]
```

## Prompt

```text
STAGE: [WF:SPEC|WF:SPEC_PLAN]
FEATURE: [feature-id]
RISK: [Standard|High]
OUTPUT: docs/features/[feature-id]/SPEC.md

Write the SPEC using docs/workflow/SPEC.md. Use stable AC IDs.
For Standard, prepare the matching PLAN in the same approval bundle only when
explicitly requested by the planning task. For High, do not write PLAN until
SPEC approval. Do not write code and do not self-approve.
```
