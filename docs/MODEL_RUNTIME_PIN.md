# Model & Runtime Pin (v8.1.1-solo)

- Status: `DRAFT` → 사용자가 실제 계정·runner·모델·권한·예산을 확인한 뒤 `APPROVED`.
- 이 파일이 역할↔Runtime↔모델 매핑의 **유일한 원본**이다.
- 전략: 승인된 Claude, OpenAI, z.ai 구독을 모두 강점대로 사용해 품질과 총 사용량을 극대화한다.
- 외부 사실은 `docs/MODEL_RUNTIME_SNAPSHOT.md`를 참고하되, observed account state와 smoke test가 우선한다.
- 2026-07-11 도입 시점 기준: 아직 어떤 Runtime도 `APPROVED`가 아니다. 아래 관찰
  기록 외의 값은 template이며 사용자 확인 전까지 사실로 취급하지 않는다.

## 0. Observed Session Evidence (adoption, 2026-07-11)

실제로 관찰된 사실만 기록한다. 이것만으로 `APPROVED`가 되지 않는다.

| Date (UTC) | Observation |
|---|---|
| 2026-07-11 | workflow-adoption-v8.1.1 작업이 Claude Code 세션에서 실행됨. 세션이 보고한 active model ID: `claude-fable-5`. permission: workspace-write. runner 버전·구독 tier·billing meter는 미관찰. |
| (이전) | 이 레포의 과거 작업은 Claude(Claude Code / Cowork)로 수행된 기록이 있음 (`docs/DEV_LOG.md`, Field Test 로그). 당시 모델 ID·버전은 기록되지 않아 미상. |

Codex(OpenAI)와 z.ai runner는 이 프로젝트에서 아직 관찰된 적 없음 — 접근 여부 미확인.

## 1. Approved Role Routing

> 아래 routing의 Runtime은 해당 Registry row가 `APPROVED`일 때만 실제 작업에 사용한다.
> 현재는 전 항목 `CANDIDATE`이므로 이 표는 **의도된 기본 배정**이다.

| Role | Primary Runtime ID | Fallback Runtime ID | Notes |
|---|---|---|---|
| Main Driver | `claude-main-opus` | `codex-sol-deep` | 일반 설계·명세·구현 중심 |
| Deep Reasoning | `claude-deep-fable` | `claude-main-opus` 또는 `codex-sol-deep` | 최고 난도; data/credit gate 적용 |
| Runtime Specialist | `codex-terra-runtime` | `codex-sol-deep` | SDK·framework·compile/runtime |
| Volume Builder — routine | `glm-routine` | `codex-luna-volume` | 명확한 반복·문서·boilerplate |
| Volume Builder — complex/long context | `glm-complex` | `codex-terra-runtime` | 큰 저장소·복잡한 구현 |
| Independent Reviewer — artifact | `codex-sol-review-artifact` | `claude-fable-review-artifact` | source는 read-only, REVIEW/HANDOFF routing만 제한 쓰기 |
| Independent Reviewer — chat-only | `codex-sol-review-ro` | `claude-fable-review-ro` | 저장소 전체 read-only |

## 2. Runtime Registry

> 아래 값은 template이다. Exact Model, runner version, active model, subscription tier,
> billing meter, permission을 실제 UI/CLI로 관찰해 채운다.

| Runtime ID | Allowed Roles | Provider | Runner / Version | Exact Model | Subscription Tier | Billing Meter | Reasoning / Effort | Permission | Data / Retention | Status | Last Verified |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `claude-main-opus` | Main Driver, Builder | Anthropic | Claude Code [ver] | `claude-opus-4-8` [observe] | Claude Max [5x/20x observe] | plan quota; overage credits per policy | [effort] | workspace-write | project policy | CANDIDATE | [date] |
| `claude-deep-fable` | Deep Reasoning, critical implementation | Anthropic | Claude Code [ver 미관찰] | `claude-fable-5` (observed 2026-07-11, 세션 self-report) | Claude Max [observe] | **usage credits unless observed inclusion** | [effort] | workspace-write | Covered Model; min 30-day retention; no ZDR | CANDIDATE | 2026-07-11 (model ID만) |
| `claude-fable-review-ro` | Independent Reviewer — chat-only | Anthropic | Claude Code [ver] | `claude-fable-5` [observe] | Claude Max [observe] | **usage credits unless observed inclusion** | [effort] | read-only | Covered Model; min 30-day retention; no ZDR | CANDIDATE | [date] |
| `claude-fable-review-artifact` | Independent Reviewer — artifact | Anthropic | Claude Code [ver] | `claude-fable-5` [observe] | Claude Max [observe] | **usage credits unless observed inclusion** | [effort] | artifact-write-limited | Covered Model; min 30-day retention; no ZDR | CANDIDATE | [date] |
| `codex-sol-deep` | Deep alternative, difficult implementation | OpenAI | Codex [surface/ver] | `gpt-5.6-sol` [observe] | ChatGPT Pro [$100/$200 observe] | agentic credits | [surface-observed] | workspace-write | project policy | CANDIDATE | [date] |
| `codex-sol-review-ro` | Independent Reviewer — chat-only | OpenAI | Codex [surface/ver] | `gpt-5.6-sol` [observe] | ChatGPT Pro [$100/$200 observe] | agentic credits | [surface-observed] | read-only | project policy | CANDIDATE | [date] |
| `codex-sol-review-artifact` | Independent Reviewer — artifact | OpenAI | Codex [surface/ver] | `gpt-5.6-sol` [observe] | ChatGPT Pro [$100/$200 observe] | agentic credits | [surface-observed] | artifact-write-limited | project policy | CANDIDATE | [date] |
| `codex-terra-runtime` | Runtime Specialist, general builder | OpenAI | Codex [surface/ver] | `gpt-5.6-terra` [observe] | ChatGPT Pro [$100/$200 observe] | agentic credits | [surface-observed] | workspace-write | project policy | CANDIDATE | [date] |
| `codex-luna-volume` | Volume Builder | OpenAI | Codex [surface/ver] | `gpt-5.6-luna` [observe] | ChatGPT Pro [$100/$200 observe] | agentic credits | [surface-observed] | workspace-write | project policy | CANDIDATE | [date] |
| `glm-routine` | Volume Builder — routine | z.ai | [supported runner/ver] | `glm-4.7` [observe] | z.ai Lite [observe] | standard quota | [setting] | workspace-write | project policy | CANDIDATE | [date] |
| `glm-complex` | Volume Builder — complex/long context | z.ai | [supported runner/ver] | `glm-5.2` or `glm-5.2[1m]` [observe] | z.ai Lite [observe] | advanced-model quota multiplier | [setting] | workspace-write | project policy | CANDIDATE | [date] |

Routing table의 Runtime은 해당 row가 `APPROVED`일 때만 실제 작업에 사용한다.
`CANDIDATE`는 smoke test와 사용자 확인 전용이며 production/data authority를 갖지 않는다.

## 3. Subscription and Reasoning Are Separate

```text
OpenAI Subscription Tier:
- ChatGPT Pro $100 or ChatGPT Pro $200 — exact account label observed

Codex Reasoning Level:
- Low | Medium | High | Extra High | Max | Ultra

“Max reasoning”은 subscription 이름이 아니다.
```

## 4. Paid-Use and Data Gates

```text
Fable usage credits:
- Policy: ASK_EACH_TIME (미설정 기본값 — 사용자가 cap을 정하면 변경)
- Monthly cap: 미설정
- Auto-reload: 미관찰

OpenAI extra credits / auto-reload:
- Policy: ASK_EACH_TIME
- Monthly cap: 미설정

z.ai plan upgrade:
- Current: 미관찰 (구독 여부 자체가 미확인)
- Upgrade: ASK_EACH_TIME
```

Fable Runtime은 Public/Internal만 기본 허용한다. Confidential은 PROJECT_SCOPE의 구체적 허용이
있을 때만, Restricted/secret/PII/production payload는 금지한다. Fable safeguard가 요청을
Opus 4.8로 switch할 수 있으므로 Observed Active Model을 결과와 함께 기록한다.

`artifact-write-limited`는 source/config/test를 수정할 권한이 아니다. 해당 review task의
ALLOWED_PATHS를 `REVIEW.md`와 최소 HANDOFF routing fields로 제한하고, 그 밖의 write는 금지한다.
CHAT_ONLY mode는 반드시 `*-review-ro` Runtime을 사용한다.

## 5. Runtime Detail Block — 각 행마다 채움

```text
Runtime ID:
Configured Model ID:
Observed Active Model ID:
Runner / Version / Surface:
Authentication Type: [secret 금지]
Subscription Tier:
Billing Meter:
Reasoning / Effort:
Instruction Discovery:
Headless Command: [verified command | N/A — manual only]
Permission Profile:
Allowed Data Classes:
Retention / Training Setting:
Official Sources:
Smoke Test Result:
Fallback Runtime ID:
Approved By / Date:
Status: CANDIDATE | APPROVED | SUSPENDED | RETIRED
```

### claude-deep-fable — 부분 관찰 (2026-07-11)

```text
Runtime ID: claude-deep-fable
Configured Model ID: claude-fable-5
Observed Active Model ID: claude-fable-5 (2026-07-11, 세션 self-report)
Runner / Version / Surface: Claude Code (desktop 세션; 정확한 버전 미관찰)
Authentication Type: Claude 구독 로그인 (secret 미노출)
Subscription Tier: 미관찰
Billing Meter: 미관찰 (snapshot 기준 usage credits 가능성 — 계정 UI 확인 필요)
Reasoning / Effort: 미관찰
Instruction Discovery: CLAUDE.md bootstrap 읽음 (이 세션에서 확인)
Headless Command: N/A — manual only (미검증)
Permission Profile: workspace-write
Allowed Data Classes: Public/Internal (Fable 기본 gate)
Retention / Training Setting: Covered Model; min 30-day retention; no ZDR (snapshot 기준)
Official Sources: docs/MODEL_RUNTIME_SNAPSHOT.md 참조
Smoke Test Result: NOT_RUN (별도 benchmark 미실행; 이 도입 작업 수행 사실만 기록)
Fallback Runtime ID: claude-main-opus
Approved By / Date: 미승인
Status: CANDIDATE
```

## 6. Model Change Checklist

1. 같은 작은 benchmark 2~3개 실행.
2. instruction loading, tool use, patch 정확성, build/test 확인.
3. 품질·속도·credit/quota·data policy 비교.
4. exact observed model과 날짜 기록.
5. 회귀면 이전 Runtime으로 rollback.
