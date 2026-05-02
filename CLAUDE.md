# AI Council — Claude Code Rules

## 코드 수정 및 커밋 규칙

### 항상 main 브랜치에서 작업할 것

- 모든 파일 편집과 커밋은 반드시 메인 레포 경로 기준으로 수행한다:
  **`C:\Users\Minkyu\Documents\AI-Council-Chat\`**
- 탐색 에이전트(Explore/general-purpose)가 워크트리 경로
  (`.claude\worktrees\...`)를 반환하더라도, 실제 편집은 메인 경로의
  파일에 직접 수행한다.
- 커밋 전 `git status` 로 현재 브랜치가 `main` 인지 반드시 확인한다.

### 앱 빌드 및 실행

- 빌드 및 실행: `build-and-run.bat` (메인 레포 루트에서 실행)
