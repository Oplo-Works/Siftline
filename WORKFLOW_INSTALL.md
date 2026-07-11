# AI Coding Agent Workflow v8.1.1 Solo — Installation

이 디렉터리는 **앱 소스 scaffold가 아니라 workflow bundle**입니다. 프로젝트에 복사할 때
기존 파일을 덮어쓰지 말고 먼저 비교·merge합니다.

## 포함 범위

- runner bootstrap: `CLAUDE.md`, `AGENTS.md`
- 항상 읽는 핵심 규칙: `docs/AGENT_WORKFLOW_CORE.md`
- 단계별 playbook: `docs/workflow/`
- 프로젝트별 승인 원본: `docs/PROJECT_SCOPE.md`, `docs/MODEL_RUNTIME_PIN.md`
- 최신 상태·기록: `docs/HANDOFF.md`, `docs/DEV_LOG.md`
- 외부 사실 스냅숏: `docs/MODEL_RUNTIME_SNAPSHOT.md`
- 안전한 merge용 예시: `templates/`

## 설치 순서

1. 대상 저장소의 현재 branch, HEAD, dirty paths를 기록합니다.
2. 이 bundle의 파일을 복사하되, 동일 경로가 있으면 자동 overwrite하지 않습니다.
3. `templates/gitignore.workflow-snippet`을 기존 `.gitignore`에 안전하게 merge합니다.
4. `.env.example`이 없으면 `templates/env.example.workflow-template`을 참고해 만듭니다.
5. 사람이 `docs/PROJECT_SCOPE.md`의 HUMAN-OWNED 정책을 채웁니다.
6. 사람이 `docs/MODEL_RUNTIME_PIN.md`의 관찰값·예산·권한을 채우고 `APPROVED`로 바꿉니다.
7. 작은 실제 작업 하나로 START → stage → TEST → REVIEW/CLOSE 흐름을 smoke test합니다.

`README.md`, 기존 `.gitignore`, 기존 `.env.example`은 프로젝트 고유 파일이므로 이 bundle이
완성본을 강제로 제공하지 않습니다. 대신 안전한 merge용 template을 제공합니다.

## 매 세션 읽기 순서

```text
CORE → MODEL_RUNTIME_PIN → PROJECT_SCOPE → HANDOFF
→ HANDOFF/현재 요청으로 stage 결정 → stage map의 playbook set
→ 파일 변경·commit·push가 있으면 GIT_SAFETY
→ 해당 기능의 승인된 SPEC/PLAN
```

전체 마스터 문서는 사람의 검토·버전 관리용이며 agent에게 매 세션 읽히지 않습니다.
