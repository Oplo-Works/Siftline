# Model & Runtime External Snapshot

> Human reference only. `MODEL_RUNTIME_PIN.md`를 자동으로 승인하지 않는다.
> Fact Status: CURRENT AS OF VERIFICATION
> Verified: 2026-07-10
> Review Due: 2026-08-10 또는 provider 변경 공지 시 즉시

## Anthropic

- Claude Code 공식 model IDs에는 `claude-opus-4-8`, `claude-fable-5`가 포함된다.
- Fable 5는 2026-07-01 복구됐고, Pro/Max/Team 및 일부 Enterprise의 임시 포함 구간은
  2026-07-07까지였다. 그 이후에는 usage credits로 제공된다고 공지됐다. 실제 계정 UI를 관찰한다.
- paid Claude plans의 usage credits는 plan 한도 이후 standard API rate 기반 추가 과금이며,
  monthly cap과 auto-reload 설정을 지원한다.
- Fable 5는 Covered Model이며 최소 30일 retention이 요구되고 ZDR 환경에서 사용할 수 없다.
- Fable safeguard에 걸린 요청은 설정에 따라 Opus 계열로 자동 switch될 수 있으므로
  결과의 Observed Active Model을 확인한다.

Official sources:
- https://support.claude.com/en/articles/11940350-claude-code-model-configuration
- https://www.anthropic.com/news/redeploying-fable-5
- https://support.claude.com/en/articles/12429409-manage-usage-credits-for-paid-claude-plans
- https://support.claude.com/en/articles/15425695-covered-models
- https://support.claude.com/en/articles/15363606-why-claude-switched-models-in-your-conversation-with-fable-5

## OpenAI / Codex

- GPT-5.6 model IDs: `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`.
- Sol은 복잡·개방형·고가치 작업, Terra는 일상적 all-round work, Luna는 명확한 반복·대량 작업에 권장된다.
- Codex의 reasoning level은 Low, Medium, High, Extra High, Max, Ultra로 subscription tier와 별개다.
- ChatGPT Pro는 $100과 $200 두 tier가 있으며 차이는 주로 usage allowance다.
- Codex는 token/credit meter를 사용하므로 실제 usage panel과 rate card를 확인한다.
- non-interactive write는 승인된 경우 `--sandbox workspace-write`; review는 `--sandbox read-only`를 사용한다.

Official sources:
- https://developers.openai.com/codex/models
- https://developers.openai.com/codex/noninteractive
- https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers
- https://help.openai.com/en/articles/20001106-codex-rate-card

## z.ai / GLM Coding Plan

- Lite, Pro, Max에서 GLM-4.7과 GLM-5.2 계열을 지원한다고 안내한다.
- 공식 안내는 routine/general work에 GLM-4.7, complex/large-scale work에 GLM-5.2를 권장한다.
- GLM-5.2 계열은 시간대에 따라 standard보다 큰 quota multiplier가 적용될 수 있으며,
  프로모션은 시한부이므로 PIN에 고정하지 않고 현재 Usage/FAQ를 재검증한다.
- 공식 latest-model 안내의 1M context 설정은 model ID에 `[1m]` suffix를 붙이는 형태다
  (예: `glm-5.2[1m]`). 실제 runner가 이 ID와 context 설정을 지원하는지 smoke test한다.
- subscription은 공식 지원 coding tools와 policy 범위 안에서 사용한다.

Official sources:
- https://docs.z.ai/devpack/overview
- https://docs.z.ai/devpack/faq
- https://docs.z.ai/devpack/latest-model

## Snapshot Use Rule

```text
Official snapshot < observed account/runtime state < approved project PIN
```

새 모델·요금·quota가 나오면 이 스냅숏을 갱신한 뒤 smoke test를 거쳐 PIN을 수정한다.
