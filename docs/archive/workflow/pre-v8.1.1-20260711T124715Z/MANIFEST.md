# Legacy Workflow Archive Manifest — pre-v8.1.1

- Archive created: 2026-07-11T12:47:15Z (UTC)
- Task: workflow-adoption-v8.1.1
- Detected source workflow: **LEGACY_V5** — "Project Engineering OS v5 Lean"
  (`/blueprint → /spec → /plan → /build → /test → /review → /log`, 단일
  `docs/AGENT_WORKFLOW.md`를 활성 워크플로 원본으로 사용)
- Adoption base HEAD: `68a2700b03d75b325a52f8fc7665ad1c07325b02` (branch `main`)
- Git history가 1차 이력이며, 이 아카이브는 도입 시점 스냅숏이다.

## Archived Files

> SHA256은 **CRLF working-tree serialization**(core.autocrlf=true 체크아웃) 기준이다.
> `git show <sha>:<path> | sha256sum`(LF blob)과는 다를 수 있으므로, serialization과
> 무관한 신원 증명은 아래 Git blob OID를 사용한다 (base `68a2700` 기준):
> `CLAUDE.md` = `4477824c632e0ef0365601b775ce7de9f49041e7`,
> `docs/AGENT_WORKFLOW.md` = `41efefe4a882ad6b123901dedc9c00d20f33b829`,
> `docs/PROJECT_SCOPE.md` = `8a7444e1f3078aa821b95cbb8dd92167e582ae16`,
> `docs/DEV_LOG.md` = `8cc7a2c78d0bf67c114c962b8e4583fd300b3b13`

| Original path | Archive path | Pre-adoption SHA256 | Git status at adoption | Reason |
|---|---|---|---|---|
| `CLAUDE.md` | `CLAUDE.md` | `fc06e2bed5a998f540394e9ea6ef6d2d11ad2c886145456ff353eb2f50c02922` | tracked, clean | v8.1.1 bootstrap block으로 merge/교체됨 (레거시 워크플로 부트스트랩 포함) |
| `docs/AGENT_WORKFLOW.md` | `docs/AGENT_WORKFLOW.md` | `815c63a46172621c5cf86b8d39d9f479ed46cc63dfa4a9b38ed8fe8957109573` | tracked, clean | SUPERSEDED compatibility pointer로 교체됨 |
| `docs/PROJECT_SCOPE.md` | `docs/PROJECT_SCOPE.md` | `65d65f07523a5b5e6f1b06319fc42230b7e0145cf5c8c1a145da897b1e73ea78` | tracked, clean | v8.1.1 schema로 구조 변환됨 (프로젝트 사실은 보존) |
| `docs/DEV_LOG.md` | `docs/DEV_LOG.md` | `1528b7c9ded1cbb990c9027501b6c91b0f3bd027463047c44d914fe3b2b9e909` | tracked, clean | append-only 보존 + 도입 이벤트 1건 append 전의 스냅숏 |

## Not Archived (unchanged, preserved in place as history)

- `docs/PROJECT_STATE.md` — 레거시 v5 상태 문서. 변경하지 않음. 현재 상태의 소유권은
  `docs/HANDOFF.md`로 이동함.
- `docs/VERIFICATION.md` — 레거시 검증 체크리스트. 변경하지 않음. 검증 명령의 활성 원본은
  `docs/PROJECT_SCOPE.md` §4.
- `docs/PRODUCT_BLUEPRINT.md`, `docs/PROJECT_ENGINEERING_OS_FIELD_TEST_LOG.md`,
  `docs/plans/*`, `docs/specs/*` — 역사적 제품/기능 아티팩트. 변경하지 않음.
- 애플리케이션 소스는 아카이브 대상이 아니며 이 작업에서 변경되지 않음.
