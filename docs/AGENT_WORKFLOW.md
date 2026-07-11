# Superseded Workflow Pointer

- Status: SUPERSEDED
- Previous Workflow: LEGACY_V5 — "Project Engineering OS v5 Lean"
  (`/blueprint → /spec → /plan → /build → /test → /review → /log`)
- Active Workflow: docs/AGENT_WORKFLOW_CORE.md
- Stage Playbooks: docs/workflow/
- Runtime Source: docs/MODEL_RUNTIME_PIN.md
- Policy Source: docs/PROJECT_SCOPE.md
- Current State: docs/HANDOFF.md

This file exists only for old links. Do not use it as an active instruction
source for new work.

Archived original:
`docs/archive/workflow/pre-v8.1.1-20260711T124715Z/docs/AGENT_WORKFLOW.md`

Migrated unique project facts:
- 검증 명령·보안 규칙 → `docs/PROJECT_SCOPE.md` (§3 데이터 정책, §4 Validation Commands)
- selector 집중 규칙, electron-store 비밀정보 규칙, Edit 도구 truncate 주의,
  Later Phase 금지 목록 → `CLAUDE.md` / `AGENTS.md`의 Project-Specific Instructions
- "항상 main 브랜치에서 커밋" 레거시 Git 규칙 → `docs/PROJECT_SCOPE.md`의
  HUMAN-OWNED Repository Policy로 대체됨 (task branch + WF:CLOSE 단일 push)
