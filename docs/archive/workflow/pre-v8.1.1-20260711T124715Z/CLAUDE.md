# AI Council — Claude Code Rules

## 코드 수정 및 커밋 규칙

### 항상 main 브랜치에서 작업할 것

- 모든 파일 편집과 커밋은 반드시 메인 레포 경로 기준으로 수행한다:
  **`C:\Users\Sales01\Documents\AI-Council-Chat\`**
- 탐색 에이전트(Explore/general-purpose)가 워크트리 경로
  (`.claude\worktrees\...`)를 반환하더라도, 실제 편집은 메인 경로의
  파일에 직접 수행한다.
- 커밋 전 `git status` 로 현재 브랜치가 `main` 인지 반드시 확인한다.

### 앱 빌드 및 실행

- 빌드 및 실행: `build-and-run.bat` (메인 레포 루트에서 실행)

## 작업 워크플로 규칙

- 모든 기능 추가/수정은 `docs/AGENT_WORKFLOW.md`의 절차를 따른다:
  - 큰 기능: `/blueprint → /spec → /plan → /build → /test → /review → /log`
  - 간단한 수정: `/spec → /plan → /build → /test → /review → /log`
- 구현 전 반드시 spec과 plan을 먼저 작성한다. spec 없이 큰 기능 코딩 금지.
- 한 slice는 파일 3~5개 이하로 작게. broad rewrite 금지.
- `docs/PROJECT_SCOPE.md`의 "Must Preserve" 목록(현재 정상 동작 중인 기능)을
  깨지 않는다. 영향이 있으면 사전 확인.
- 마무리 전 `npm run build` 통과를 확인한다.
- 의미 있는 변경 후 `docs/DEV_LOG.md`를 업데이트한다.
- 미완성 기능은 placeholder/mock/demo로 명확히 표시하고, 빌드·테스트 전까지
  "완료"라고 주장하지 않는다.
