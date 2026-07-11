# WF:REVIEW — Independent Review

> Reviewer는 구현에 참여하지 않은 승인 Runtime 또는 사람이다.
> 먼저 SPEC → diff → TEST_EVIDENCE를 읽고, 구현자 요약은 마지막에 읽는다.
> CHAT_ONLY는 PIN의 `*-review-ro`, ARTIFACT는 `*-review-artifact` profile을 사용한다.

## Review Mode — 둘 중 하나

```text
CHAT_ONLY_READ_ONLY
- 저장소 파일, HANDOFF, DEV_LOG, Git을 전혀 변경하지 않는다.
- 결과는 채팅으로만 반환한다.
- CORE의 일반 FINISH보다 이 규칙이 우선한다.

ARTIFACT_READ_ONLY  (기본)
- source code, config, tests를 수정하지 않는다.
- REVIEW.md와 최소 HANDOFF routing fields만 갱신할 수 있다.
- Runtime permission은 `artifact-write-limited`이고 ALLOWED_PATHS가 위 두 artifact로 제한되어야 한다.
- owner/session이 여기서 바뀌면 이 두 artifact를 local metadata commit한다.
- 같은 orchestrated session에서 Implementation Owner가 즉시 CLOSE하는 경우에만
  REVIEW.md를 close metadata commit에 합칠 수 있다.
- push하지 않는다.
```

수정 요청은 review mode가 아니다. Review decision 뒤의 transition은 다음과 같다.

```text
PASS                       → CLOSE 또는 High Human Decision
CHANGES_REQUESTED          → REMEDIATION_REQUESTED (새 WF:BUILD task)
NEEDS_HUMAN_APPROVAL       → HUMAN_DECISION_REQUIRED
```

## Severity

| Sev | Meaning | Waiver |
|---|---|---|
| P0 | 데이터 손상, 심각한 보안, production 장애 위험 | 불가. 해결 또는 취소 |
| P1 | 완료 전 고칠 중대한 기능·보안·범위 문제 | 사용자에게 범위·기한·보완책·재검토일을 받아야 함 |
| P2 | 계획된 후속 수정이 필요한 일반 문제 | owner와 due date 필수 |
| P3 | 선택적 개선 | 기록 가능 |

## Decision Routing

| Risk | Reviewer Decision | Next Status | Next Role |
|---|---|---|---|
| Standard | PASS | READY | Implementation Owner → WF:CLOSE |
| High | PASS | NEEDS_APPROVAL | Human Approver — `APPROVED` 또는 `APPROVED_WITH_RISK` 필요 |
| Any | CHANGES_REQUESTED | READY | Implementation Owner → remediation BUILD |
| Standard | NEEDS_HUMAN_APPROVAL | NEEDS_APPROVAL | Human 결정 후, no-P0와 waiver 조건 충족 시 Implementation Owner → WF:CLOSE |
| High | NEEDS_HUMAN_APPROVAL | NEEDS_APPROVAL | Human 결정 후, no-P0와 waiver 조건 충족 시 Implementation Owner → WF:CLOSE |

Reviewer는 CLOSE를 수행하지 않는다. `CHANGES_REQUESTED`는 Human approval만으로 건너뛸 수 없다.
High는 PASS만으로 push 또는 DONE이 될 수 없다.

## Human Decision

```text
APPROVED             — 잔여 위험 없이 진행 승인
APPROVED_WITH_RISK   — 구체적 residual risk, 보완책, owner, due/review date 포함
REJECTED             — 종료 또는 재설계
```

P0는 어떤 Human Decision으로도 waive할 수 없다.

## REVIEW Template

```markdown
# Review: [feature/task]

- Mode: [CHAT_ONLY_READ_ONLY|ARTIFACT_READ_ONLY]
- Reviewer: [runtime/person]
- Review Range: [base..head or explicit diff]
- SPEC/PLAN/EVIDENCE: [paths + revisions]
- Risk: [Standard|High]
- Decision: [PASS|CHANGES_REQUESTED|NEEDS_HUMAN_APPROVAL]

## Findings
| Sev | Location | Impact | Evidence | AC | Recommended fix | Status | Owner | Due |
|---|---|---|---|---|---|---|---|---|
| P1 | path:line | [impact] | [evidence] | AC-1 | [fix] | OPEN | [owner] | [date] |

## Checks run directly
- [command and result]

## Evidence read but not re-run
- [item]

## Scope / Regression / Security / Permission
- [assessment]

## Residual Risk and Transition
- Next transition: [CLOSE|REMEDIATION_REQUESTED|HUMAN_DECISION_REQUIRED]
- Required action: [one action]
```

CHAT_ONLY_READ_ONLY에서는 위 내용을 채팅으로만 반환하고 파일을 쓰지 않는다.

## Prompt

```text
STAGE: WF:REVIEW
MODE: [CHAT_ONLY_READ_ONLY|ARTIFACT_READ_ONLY]
RANGE: [base..head or explicit diff]
SPEC: [path/revision]
PLAN: [path/revision]
EVIDENCE: [path]

Perform a findings-first independent review. Read SPEC, diff, and evidence
before implementer commentary. Return only PASS, CHANGES_REQUESTED, or
NEEDS_HUMAN_APPROVAL. Follow the risk-specific routing table.
In CHAT_ONLY mode, modify nothing. In ARTIFACT mode, write REVIEW.md and update
only HANDOFF routing fields using an artifact-write Runtime profile; do not modify
source/config/tests and do not push.
```
