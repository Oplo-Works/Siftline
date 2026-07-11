# WF:BLUEPRINT / WF:PRD / WF:UX / WF:BACKEND / WF:DESIGN

> 담당 Runtime은 `MODEL_RUNTIME_PIN.md`에서 해당 역할의 승인 매핑을 선택한다.
> 코드는 작성하지 않는다. 승인 없이 다음 구현 단계의 근거로 쓰지 않는다.

| Stage | Output | Required content | Gate |
|---|---|---|---|
| `WF:BLUEPRINT` | `docs/PRODUCT_BLUEPRINT.md` | personas, pain points, value proposition, MVP/v1/later, core flow, monetization, UX·tech·business risks, out of scope | 방향·비범위 승인 |
| `WF:PRD` | `docs/product/PRD.md` | goals, non-goals, functional/non-functional requirements, success metrics, launch scope | 요구사항 충돌 해소 + 승인 |
| `WF:UX` | `docs/product/UX.md` | screen/flow, main action, empty/loading/error, CTA, microcopy, retention, accessibility, platform/form factor | 핵심·실패 흐름 검토 |
| `WF:BACKEND` | `docs/architecture/BACKEND.md` | entities, schema draft, auth/roles, API, integrations, storage, rate limits, audit, migration/rollback | 데이터·권한 경계 승인 |
| `WF:DESIGN` | `docs/design/DESIGN_SYSTEM.md` | tokens, typography, spacing, components, states, accessibility | 구현 가능한 token 승인 |

작은 프로젝트는 BLUEPRINT만으로 시작할 수 있다. 선택 단계 파일은 실제 stage가 시작될 때만 만든다.

## 공통 규칙

- 현재 product reality와 코드 reality를 구분한다.
- MVP, v1, later를 분리하고 out of scope를 명시한다.
- 결제·권한·개인정보·migration은 High 위험 후보로 표시한다.
- 외부 사실을 사용하면 source와 검증일을 기록한다.
- 사용자 승인 메시지 없이 문서 상태를 `APPROVED`로 바꾸지 않는다.

## 복붙 프롬프트

### WF:BLUEPRINT

```text
STAGE: WF:BLUEPRINT
OUTPUT: docs/PRODUCT_BLUEPRINT.md (DRAFT)

Act as the approved Product/Architecture role.
Create a product blueprint for [APP NAME] on [PLATFORM/FORM FACTOR].
Target users: [TARGET USERS]
Problem: [PROBLEM]

Include personas, pain points, value proposition, MVP/v1/later,
core user flow, monetization options, UX/technical/business risks,
and explicit out of scope. Do not write code. End with decisions needed.
```

### WF:PRD

```text
STAGE: WF:PRD
INPUT: approved Blueprint
OUTPUT: docs/product/PRD.md (DRAFT)

Write a concise PRD for [APP/FEATURE]. Include product overview,
user problem, goals, non-goals, target audience, functional and
non-functional requirements, edge cases, technical considerations,
success metrics, launch scope, and roadmap. Do not write code.
```

### WF:UX

```text
STAGE: WF:UX
INPUT: approved Blueprint/PRD
OUTPUT: docs/product/UX.md (DRAFT)

For [PLATFORM/FORM FACTOR], define each screen or flow: goal, main action,
UI elements, empty/loading/error state, CTA, microcopy, retention opportunity,
and accessibility note. Do not write code.
```

### WF:BACKEND

```text
STAGE: WF:BACKEND
INPUT: approved requirements
OUTPUT: docs/architecture/BACKEND.md (DRAFT)

Produce MVP-friendly backend requirements: data models, schema draft,
auth and roles, API endpoints, integrations, storage, payments/accounting
if relevant, rate limits, security/privacy risks, audit needs,
migration/rollback, and MVP vs later. Do not implement.
```

### WF:DESIGN

```text
STAGE: WF:DESIGN
INPUT: approved UX and brand direction
OUTPUT: docs/design/DESIGN_SYSTEM.md (DRAFT)

Create an implementation-ready design system: brand personality,
color and typography tokens, spacing, buttons, inputs, cards, navigation,
icons, empty/loading/error states, responsive behavior, and accessibility.
Do not write application code.
```
